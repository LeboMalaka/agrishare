import { BookingStatus, EquipmentStatus, NotificationType, Prisma, UserRole } from '@prisma/client';
import { Router, type Request, type Response, type NextFunction } from 'express';

import { HttpError } from '../lib/http-error';
import { parseDateOnly, utcStartOfToday } from '../lib/date-only';
import { createNotification } from '../lib/notifications';
import { authenticate, currentUser, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
const bookingInclude = {
  farmer: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  equipment: { select: { id: true, name: true, imageUrl: true } },
} satisfies Prisma.BookingInclude;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dateForBooking(value: unknown) {
  const date = parseDateOnly(value, 'requestedDate');
  if (date < utcStartOfToday()) throw new HttpError('requestedDate cannot be in the past', 400);
  return date;
}

async function assertDateCanBeBooked(
  transaction: Prisma.TransactionClient,
  equipmentId: string,
  requestedDate: Date,
  exceptBookingId?: string,
) {
  const unavailableWindow = await transaction.equipmentAvailability.findFirst({
    where: {
      equipmentId,
      isAvailable: false,
      startsAt: { lte: requestedDate },
      endsAt: { gt: requestedDate },
    },
    select: { id: true },
  });
  if (unavailableWindow) {
    throw new HttpError('This equipment is unavailable on the selected date', 409);
  }

  const conflict = await transaction.booking.findFirst({
    where: {
      equipmentId,
      requestedDate: {
        gte: requestedDate,
        lt: new Date(requestedDate.getTime() + 86_400_000),
      },
      status: BookingStatus.CONFIRMED,
      ...(exceptBookingId ? { id: { not: exceptBookingId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) throw new HttpError('Another booking is already confirmed for that date', 409);
}

function handleTransactionError(error: unknown, next: NextFunction) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034' || error.code === 'P2002') {
      next(new HttpError('A conflicting booking update occurred; please refresh and try again', 409));
      return true;
    }
    if (error.code === 'P2028') {
      next(new HttpError('The booking operation timed out; please try again', 503));
      return true;
    }
  }
  next(error);
  return false;
}

router.post(
  '/',
  authenticate,
  requireRole(UserRole.FARMER),
  async (request, response, next) => {
    try {
      const body: unknown = request.body;
      if (
        !isRecord(body) ||
        typeof body.equipmentId !== 'string' ||
        body.equipmentId.trim() === '' ||
        (body.notes !== undefined && typeof body.notes !== 'string')
      ) {
        throw new HttpError('equipmentId, requestedDate, and optional notes are required', 400);
      }

      const requestedDate = dateForBooking(body.requestedDate);
      if (typeof body.notes === 'string' && body.notes.length > 1000) {
        throw new HttpError('notes must be at most 1000 characters', 400);
      }
      const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
      const equipmentId = body.equipmentId.trim();
      const farmer = currentUser(request);
      const booking = await prisma.$transaction(async (transaction) => {
        const equipment = await transaction.equipment.findUnique({
          where: { id: equipmentId },
          select: { id: true, ownerId: true, availability: true },
        });
        if (!equipment) throw new HttpError('Equipment not found', 404);
        if (equipment.availability === EquipmentStatus.BOOKED) {
          throw new HttpError('This equipment is not currently available', 409);
        }
        await assertDateCanBeBooked(transaction, equipment.id, requestedDate);
        const booking = await transaction.booking.create({
          data: {
            farmerId: farmer.id,
            ownerId: equipment.ownerId,
            equipmentId: equipment.id,
            requestedDate,
            notes,
          },
          include: bookingInclude,
        });
        await createNotification(transaction, {
          userId: equipment.ownerId,
          bookingId: booking.id,
          type: NotificationType.BOOKING_REQUEST,
          title: 'New booking request',
          message: `${booking.farmer.name} requested ${booking.equipment.name} for ${requestedDate.toISOString().slice(0, 10)}.`,
        });
        return booking;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 15_000,
      });

      response.status(201).json(booking);
    } catch (error) {
      handleTransactionError(error, next);
    }
  },
);

async function listBookings(request: Request, response: Response, next: NextFunction) {
  try {
    const user = currentUser(request);
    const bookings = await prisma.booking.findMany({
      where: user.role === UserRole.EQUIPMENT_OWNER ? { ownerId: user.id } : { farmerId: user.id },
      include: bookingInclude,
      orderBy: [{ requestedDate: 'asc' }, { createdAt: 'desc' }],
    });
    response.json(bookings);
  } catch (error) {
    next(error);
  }
}

router.get('/my-bookings', authenticate, requireRole(UserRole.FARMER), listBookings);
router.get('/owner-requests', authenticate, requireRole(UserRole.EQUIPMENT_OWNER), listBookings);
router.get('/', authenticate, requireRole(UserRole.FARMER, UserRole.EQUIPMENT_OWNER), listBookings);

async function decideBooking(
  request: Request,
  response: Response,
  next: NextFunction,
  status: 'CONFIRMED' | 'REJECTED',
) {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError('Booking not found', 404);
    const owner = currentUser(request);
    const booking = await prisma.$transaction(async (transaction) => {
      const target = await transaction.booking.findFirst({
        where: { id, ownerId: owner.id },
      });
      if (!target) throw new HttpError('Booking not found', 404);
      if (target.status !== BookingStatus.PENDING) {
        throw new HttpError('Only pending booking requests can be updated', 409);
      }
      if (status === BookingStatus.CONFIRMED) {
        if (target.requestedDate < utcStartOfToday()) {
          throw new HttpError('Past bookings cannot be approved', 409);
        }
        await assertDateCanBeBooked(transaction, target.equipmentId, target.requestedDate, target.id);
      }
      const booking = await transaction.booking.update({
        where: { id: target.id },
        data: { status },
        include: bookingInclude,
      });
      await createNotification(transaction, {
        userId: target.farmerId,
        bookingId: target.id,
        type: NotificationType.BOOKING_STATUS,
        title: status === BookingStatus.CONFIRMED ? 'Booking approved' : 'Booking request declined',
        message: status === BookingStatus.CONFIRMED
          ? `Your request for ${booking.equipment.name} has been approved.`
          : `Your request for ${booking.equipment.name} was declined.`,
      });
      return booking;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 15_000,
    });
    response.json(booking);
  } catch (error) {
    handleTransactionError(error, next);
  }
}

router.patch(
  '/:id/approve',
  authenticate,
  requireRole(UserRole.EQUIPMENT_OWNER),
  (request, response, next) => void decideBooking(request, response, next, BookingStatus.CONFIRMED),
);
router.patch(
  '/:id/reject',
  authenticate,
  requireRole(UserRole.EQUIPMENT_OWNER),
  (request, response, next) => void decideBooking(request, response, next, BookingStatus.REJECTED),
);
router.patch(
  '/:id/status',
  authenticate,
  requireRole(UserRole.EQUIPMENT_OWNER),
  (request, response, next) => {
    const body: unknown = request.body;
    if (!isRecord(body) || (body.status !== BookingStatus.CONFIRMED && body.status !== BookingStatus.REJECTED)) {
      next(new HttpError('status must be CONFIRMED or REJECTED', 400));
      return;
    }
    void decideBooking(request, response, next, body.status);
  },
);

router.patch(
  '/:id/cancel',
  authenticate,
  requireRole(UserRole.FARMER, UserRole.EQUIPMENT_OWNER),
  async (request, response, next) => {
    try {
      const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
      if (!id) throw new HttpError('Booking not found', 404);
      const user = currentUser(request);
      const booking = await prisma.$transaction(async (transaction) => {
        const target = await transaction.booking.findUnique({ where: { id } });
        if (
          !target ||
          (user.role === UserRole.FARMER && target.farmerId !== user.id) ||
          (user.role === UserRole.EQUIPMENT_OWNER && target.ownerId !== user.id)
        ) {
          throw new HttpError('Booking not found', 404);
        }
        if (target.status !== BookingStatus.PENDING && target.status !== BookingStatus.CONFIRMED) {
          throw new HttpError('This booking can no longer be cancelled', 409);
        }
        if (target.requestedDate < utcStartOfToday()) {
          throw new HttpError('Past bookings cannot be cancelled', 409);
        }
        const booking = await transaction.booking.update({
          where: { id },
          data: { status: BookingStatus.CANCELLED },
          include: bookingInclude,
        });
        const recipientId = user.role === UserRole.FARMER ? target.ownerId : target.farmerId;
        await createNotification(transaction, {
          userId: recipientId,
          bookingId: target.id,
          type: NotificationType.BOOKING_STATUS,
          title: 'Booking cancelled',
          message: `${user.role === UserRole.FARMER ? booking.farmer.name : booking.owner.name} cancelled the booking for ${booking.equipment.name}.`,
        });
        return booking;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 15_000,
      });
      response.json(booking);
    } catch (error) {
      handleTransactionError(error, next);
    }
  },
);

export default router;
