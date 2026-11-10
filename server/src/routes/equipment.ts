import { BookingStatus, EquipmentCategory, EquipmentStatus, Prisma, UserRole } from '@prisma/client';
import { Router } from 'express';

import { HttpError } from '../lib/http-error';
import { parseDateOnly, toDateOnly, utcStartOfToday } from '../lib/date-only';
import { authenticate, currentUser, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
const equipmentInclude = {
  owner: { select: { id: true, name: true } },
  images: { select: { id: true, url: true, altText: true, sortOrder: true }, orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.EquipmentInclude;

type JsonRecord = Record<string, unknown>;
const maxSearchRadiusKm = 500;

type NearbyEquipmentDistance = {
  id: string;
  distanceKm: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(body: JsonRecord, key: string, minLength: number, maxLength: number) {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length < minLength || value.trim().length > maxLength) {
    throw new HttpError(`${key} must be between ${minLength} and ${maxLength} characters`, 400);
  }
  return value.trim();
}

function parseCategory(value: unknown) {
  if (typeof value !== 'string' || !Object.values(EquipmentCategory).includes(value as EquipmentCategory)) {
    throw new HttpError('Unknown equipment category', 400);
  }
  return value as EquipmentCategory;
}

function parsePrice(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    throw new HttpError('pricePerDay must be a positive number', 400);
  }
  return value;
}

function parseAvailability(value: unknown) {
  if (typeof value !== 'string' || !Object.values(EquipmentStatus).includes(value as EquipmentStatus)) {
    throw new HttpError('Unknown availability status', 400);
  }
  return value as EquipmentStatus;
}

function parseCoordinate(value: unknown, key: 'latitude' | 'longitude') {
  if (value === null) return null;
  const max = key === 'latitude' ? 90 : 180;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -max || value > max) {
    throw new HttpError(`${key} must be between ${-max} and ${max}`, 400);
  }
  return value;
}

function parseImageUrls(value: unknown) {
  if (!Array.isArray(value) || value.length > 10) {
    throw new HttpError('imageUrls must be an array of up to 10 Cloudinary image URLs', 400);
  }
  return value.map((item) => parseCloudinaryImageUrl(item, 'imageUrls'));
}

function parseLegacyImageUrl(value: unknown) {
  if (value === null || value === '') return null;
  return parseCloudinaryImageUrl(value, 'imageUrl');
}

function parseSpecifications(value: unknown) {
  if (!Array.isArray(value) || value.length > 20 || value.some((item) => typeof item !== 'string' || item.length > 100)) {
    throw new HttpError('specifications must contain up to 20 text items of at most 100 characters', 400);
  }
  return value.map((item) => (item as string).trim()).filter(Boolean);
}

function validateCoordinatePair(body: JsonRecord) {
  const hasLatitude = Object.hasOwn(body, 'latitude');
  const hasLongitude = Object.hasOwn(body, 'longitude');
  if (hasLatitude !== hasLongitude) {
    throw new HttpError('latitude and longitude must be provided together', 400);
  }
  return {
    ...(hasLatitude ? { latitude: parseCoordinate(body.latitude, 'latitude') } : {}),
    ...(hasLongitude ? { longitude: parseCoordinate(body.longitude, 'longitude') } : {}),
  };
}

function configuredCloudinaryCloudName() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new HttpError('Cloudinary uploads are not configured on this server', 503);
  }
  return cloudName;
}

function parseCloudinaryImageUrl(value: unknown, fieldName: 'imageUrls' | 'imageUrl') {
  if (typeof value !== 'string') {
    throw new HttpError(`${fieldName} must contain a Cloudinary image URL`, 400);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(`${fieldName} must contain a valid Cloudinary HTTPS URL`, 400);
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'res.cloudinary.com' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new HttpError('Equipment images must be hosted by Cloudinary over HTTPS', 400);
  }
  const cloudName = configuredCloudinaryCloudName();
  if (!url.pathname.startsWith(`/${cloudName}/image/upload/`)) {
    throw new HttpError('Equipment images must belong to this Cloudinary account', 400);
  }
  return url.toString();
}

function parseQueryCoordinate(value: unknown, key: 'latitude' | 'longitude', max: number) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(`${key} is required`, 400);
  }
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < -max || coordinate > max) {
    throw new HttpError(`${key} must be between ${-max} and ${max}`, 400);
  }
  return coordinate;
}

function parseSearchText(value: unknown) {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new HttpError('search must be a single text value', 400);
  const search = value.trim();
  if (search.length > 120) throw new HttpError('search must be at most 120 characters', 400);
  return search;
}

function parseSearchRadius(value: unknown): number {
  const radiusKm = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > maxSearchRadiusKm) {
    throw new HttpError(
      `radiusKm must be a whole number between 1 and ${maxSearchRadiusKm}`,
      400,
    );
  }
  return radiusKm;
}

router.get('/search', async (request, response, next) => {
  try {
    const latitude = parseQueryCoordinate(request.query.latitude, 'latitude', 90);
    const longitude = parseQueryCoordinate(request.query.longitude, 'longitude', 180);
    const radiusKm = parseSearchRadius(request.query.radiusKm);
    const category = request.query.category === undefined
      ? undefined
      : parseCategory(request.query.category);
    const search = parseSearchText(request.query.search);

    const distanceExpression = Prisma.sql`(
      6371.0088 * 2 * ASIN(SQRT(LEAST(1.0,
        POWER(SIN(RADIANS(e."latitude" - ${latitude}) / 2), 2)
        + COS(RADIANS(${latitude})) * COS(RADIANS(e."latitude"))
          * POWER(SIN(RADIANS(e."longitude" - ${longitude}) / 2), 2)
      )))
    )`;
    const categoryFilter = category
      ? Prisma.sql`AND e."category" = ${category}::"EquipmentCategory"`
      : Prisma.empty;
    const searchFilter = search
      ? Prisma.sql`AND (
          e."name" ILIKE ${`%${search}%`}
          OR e."description" ILIKE ${`%${search}%`}
          OR e."location" ILIKE ${`%${search}%`}
        )`
      : Prisma.empty;

    const distances = await prisma.$queryRaw<NearbyEquipmentDistance[]>(Prisma.sql`
      SELECT e."id", ${distanceExpression} AS "distanceKm"
      FROM "Equipment" e
      WHERE e."latitude" IS NOT NULL
        AND e."longitude" IS NOT NULL
        AND ${distanceExpression} <= ${radiusKm}
        ${categoryFilter}
        ${searchFilter}
      ORDER BY "distanceKm" ASC
    `);

    if (distances.length === 0) {
      response.json([]);
      return;
    }

    const distanceById = new Map(distances.map(({ id, distanceKm }) => [id, distanceKm]));
    const equipment = await prisma.equipment.findMany({
      where: { id: { in: distances.map(({ id }) => id) } },
      include: equipmentInclude,
    });
    const sortedEquipment = equipment
      .sort((left, right) => (distanceById.get(left.id) ?? Infinity) - (distanceById.get(right.id) ?? Infinity))
      .map((item) => ({
        ...item,
        distanceKm: Number((distanceById.get(item.id) ?? 0).toFixed(2)),
      }));

    response.json(sortedEquipment);
  } catch (error) {
    next(error);
  }
});

router.get('/mine', authenticate, requireRole(UserRole.EQUIPMENT_OWNER), async (request, response, next) => {
  try {
    const equipment = await prisma.equipment.findMany({
      where: { ownerId: currentUser(request).id },
      include: equipmentInclude,
      orderBy: { createdAt: 'desc' },
    });
    response.json(equipment);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/availability', async (request, response, next) => {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError('Equipment not found', 404);
    const equipment = await prisma.equipment.findUnique({ where: { id }, select: { id: true } });
    if (!equipment) throw new HttpError('Equipment not found', 404);

    const monthValue = request.query.month;
    const month = monthValue === undefined
      ? new Date().toISOString().slice(0, 7)
      : typeof monthValue === 'string' && /^\d{4}-\d{2}$/.test(monthValue)
        ? monthValue
        : '';
    if (!month || Number(month.slice(5, 7)) < 1 || Number(month.slice(5, 7)) > 12) {
      throw new HttpError('month must use YYYY-MM format', 400);
    }

    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const [windows, bookings] = await Promise.all([
      prisma.equipmentAvailability.findMany({
        where: {
          equipmentId: id,
          startsAt: { lt: nextMonthStart },
          endsAt: { gt: monthStart },
        },
        orderBy: { startsAt: 'asc' },
      }),
      prisma.booking.findMany({
        where: {
          equipmentId: id,
          requestedDate: { gte: monthStart, lt: nextMonthStart },
          status: BookingStatus.CONFIRMED,
        },
        select: { requestedDate: true },
      }),
    ]);

    const statusByDate = new Map<string, { date: string; isAvailable: boolean; note: string | null }>();
    for (const window of windows) {
      const start = new Date(Math.max(window.startsAt.getTime(), monthStart.getTime()));
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(Math.min(window.endsAt.getTime(), nextMonthStart.getTime()));
      for (let day = start; day < end; day = new Date(day.getTime() + 86_400_000)) {
        const date = toDateOnly(day);
        const prior = statusByDate.get(date);
        if (!prior || (!window.isAvailable && prior.isAvailable)) {
          statusByDate.set(date, { date, isAvailable: window.isAvailable, note: window.note });
        }
      }
    }

    response.json({
      windows: [...statusByDate.values()],
      bookedDates: bookings.map((booking) => toDateOnly(booking.requestedDate)),
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/availability',
  authenticate,
  requireRole(UserRole.EQUIPMENT_OWNER),
  async (request, response, next) => {
    try {
      const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
      if (!id) throw new HttpError('Equipment not found', 404);
      const body: unknown = request.body;
      if (
        !isRecord(body) ||
        !Array.isArray(body.dates) ||
        body.dates.length < 1 ||
        body.dates.length > 31 ||
        body.dates.some((date) => typeof date !== 'string') ||
        typeof body.isAvailable !== 'boolean' ||
        (body.note !== undefined && typeof body.note !== 'string')
      ) {
        throw new HttpError('dates (1-31 YYYY-MM-DD values), isAvailable, and optional note are required', 400);
      }
      const dates = [...new Set(body.dates.map((date) => parseDateOnly(date, 'date').toISOString()))]
        .map((date) => new Date(date))
        .sort((left, right) => left.getTime() - right.getTime());
      const isAvailable = body.isAvailable;
      if (dates.length !== body.dates.length) throw new HttpError('dates must not contain duplicates', 400);
      if (dates.some((date) => date < utcStartOfToday())) {
        throw new HttpError('Past dates cannot be changed', 400);
      }
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null;

      const updatedWindows = await prisma.$transaction(async (transaction) => {
        const equipment = await transaction.equipment.findFirst({
          where: { id, ownerId: currentUser(request).id },
          select: { id: true },
        });
        if (!equipment) throw new HttpError('Equipment not found', 404);

        const confirmedDates = await transaction.booking.findMany({
          where: {
            equipmentId: id,
            status: BookingStatus.CONFIRMED,
            OR: dates.map((startsAt) => ({
              requestedDate: {
                gte: startsAt,
                lt: new Date(startsAt.getTime() + 86_400_000),
              },
            })),
          },
          select: { id: true },
        });
        if (confirmedDates.length > 0) {
          throw new HttpError('Availability cannot be changed for dates with confirmed bookings', 409);
        }

        for (const startsAt of dates) {
          const endsAt = new Date(startsAt.getTime() + 86_400_000);
          await transaction.equipmentAvailability.upsert({
            where: {
              equipmentId_startsAt_endsAt: { equipmentId: id, startsAt, endsAt },
            },
            create: { equipmentId: id, startsAt, endsAt, isAvailable, note },
            update: { isAvailable, note },
          });
        }
        return transaction.equipmentAvailability.findMany({
          where: { equipmentId: id, startsAt: { in: dates } },
          orderBy: { startsAt: 'asc' },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 15_000,
      });

      response.json(updatedWindows.map((window) => ({
        date: toDateOnly(window.startsAt),
        isAvailable: window.isAvailable,
        note: window.note,
      })));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        next(new HttpError('A concurrent availability update occurred; please retry', 409));
        return;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
        next(new HttpError('The availability update timed out; please retry', 503));
        return;
      }
      next(error);
    }
  },
);

router.get('/', async (request, response, next) => {
  try {
    const category = request.query.category;
    if (category !== undefined) parseCategory(category);
    const search = parseSearchText(request.query.search);
    const available = request.query.available;
    if (available !== undefined && available !== 'true' && available !== 'false') {
      throw new HttpError('available must be true or false', 400);
    }
    const equipment = await prisma.equipment.findMany({
      where: {
        ...(typeof category === 'string' ? { category: category as EquipmentCategory } : {}),
        ...(available === 'true' ? { availability: EquipmentStatus.AVAILABLE } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { location: { contains: search, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      include: equipmentInclude,
      orderBy: { createdAt: 'desc' },
    });
    response.json(equipment);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError('Equipment not found', 404);
    const equipment = await prisma.equipment.findUnique({ where: { id }, include: equipmentInclude });
    if (!equipment) throw new HttpError('Equipment not found', 404);
    response.json(equipment);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, requireRole(UserRole.EQUIPMENT_OWNER), async (request, response, next) => {
  try {
    if (!isRecord(request.body)) throw new HttpError('A JSON request body is required', 400);
    const body = request.body;
    const imageUrls = body.imageUrls === undefined ? [] : parseImageUrls(body.imageUrls);
    const legacyImageUrl = body.imageUrl === undefined ? null : parseLegacyImageUrl(body.imageUrl);
    const coordinates = validateCoordinatePair(body);
    const user = currentUser(request);
    const equipment = await prisma.equipment.create({
      data: {
        name: requiredText(body, 'name', 2, 120),
        category: parseCategory(body.category),
        description: requiredText(body, 'description', 10, 2000),
        pricePerDay: parsePrice(body.pricePerDay),
        location: requiredText(body, 'location', 2, 200),
        imageUrl: imageUrls[0] ?? legacyImageUrl,
        specifications: body.specifications === undefined ? [] : parseSpecifications(body.specifications),
        availability: body.availability === undefined ? EquipmentStatus.AVAILABLE : parseAvailability(body.availability),
        ...coordinates,
        ownerId: user.id,
        images: {
          create: imageUrls.map((url, sortOrder) => ({ url, sortOrder })),
        },
      },
      include: equipmentInclude,
    });
    response.status(201).json(equipment);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, requireRole(UserRole.EQUIPMENT_OWNER), async (request, response, next) => {
  try {
    if (!isRecord(request.body)) throw new HttpError('A JSON request body is required', 400);
    const body = request.body;
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const ownerId = currentUser(request).id;
    if (!id) throw new HttpError('Equipment not found', 404);
    const existing = await prisma.equipment.findFirst({ where: { id, ownerId }, select: { id: true } });
    if (!existing) throw new HttpError('Equipment not found', 404);
    if (Object.keys(body).length === 0) throw new HttpError('At least one equipment field is required', 400);

    const coordinates = validateCoordinatePair(body);
    const imageUrls = Object.hasOwn(body, 'imageUrls') ? parseImageUrls(body.imageUrls) : undefined;
    const legacyImageUrl = Object.hasOwn(body, 'imageUrl')
      ? parseLegacyImageUrl(body.imageUrl)
      : undefined;
    const data: Prisma.EquipmentUpdateInput = {
      ...(Object.hasOwn(body, 'name') ? { name: requiredText(body, 'name', 2, 120) } : {}),
      ...(Object.hasOwn(body, 'category') ? { category: parseCategory(body.category) } : {}),
      ...(Object.hasOwn(body, 'description') ? { description: requiredText(body, 'description', 10, 2000) } : {}),
      ...(Object.hasOwn(body, 'pricePerDay') ? { pricePerDay: parsePrice(body.pricePerDay) } : {}),
      ...(Object.hasOwn(body, 'location') ? { location: requiredText(body, 'location', 2, 200) } : {}),
      ...(Object.hasOwn(body, 'availability') ? { availability: parseAvailability(body.availability) } : {}),
      ...(Object.hasOwn(body, 'specifications') ? { specifications: parseSpecifications(body.specifications) } : {}),
      ...coordinates,
      ...(imageUrls !== undefined
        ? {
            imageUrl: imageUrls[0] ?? legacyImageUrl ?? null,
            images: {
              deleteMany: {},
              create: imageUrls.map((url, sortOrder) => ({ url, sortOrder })),
            },
          }
        : legacyImageUrl !== undefined
          ? { imageUrl: legacyImageUrl }
          : {}),
    };

    const equipment = await prisma.equipment.update({
      where: { id },
      data,
      include: equipmentInclude,
    });
    response.json(equipment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError('Equipment not found', 404));
      return;
    }
    next(error);
  }
});

router.delete('/:id', authenticate, requireRole(UserRole.EQUIPMENT_OWNER), async (request, response, next) => {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError('Equipment not found', 404);
    const existing = await prisma.equipment.findFirst({
      where: { id, ownerId: currentUser(request).id },
      select: { id: true },
    });
    if (!existing) throw new HttpError('Equipment not found', 404);
    await prisma.equipment.delete({ where: { id } });
    response.status(204).end();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      next(new HttpError('Equipment with booking history cannot be deleted', 409));
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError('Equipment not found', 404));
      return;
    }
    next(error);
  }
});

export default router;
