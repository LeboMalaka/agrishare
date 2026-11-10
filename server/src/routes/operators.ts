import {
  NotificationType,
  OperatorCertificationStatus,
  OperatorDocumentStatus,
  OperatorDocumentType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { Router } from 'express';

import { createNotification } from '../lib/notifications';
import { HttpError } from '../lib/http-error';
import { authenticate, currentUser, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
const profileSelect = {
  bio: true,
  experienceYears: true,
  certificationStatus: true,
  certifiedAt: true,
  documents: {
    select: {
      id: true,
      type: true,
      originalName: true,
      status: true,
      reviewNotes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.OperatorProfileSelect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError('Cloudinary private document access is not configured', 503);
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

router.get('/profile', authenticate, requireRole(UserRole.OPERATOR), async (request, response, next) => {
  try {
    const profile = await prisma.operatorProfile.findUnique({
      where: { userId: currentUser(request).id },
      select: profileSelect,
    });
    if (!profile) throw new HttpError('Operator profile not found', 404);
    response.json(profile);
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, requireRole(UserRole.ADMIN), async (request, response, next) => {
  try {
    const status = request.query.status;
    if (
      status !== undefined &&
      (typeof status !== 'string' ||
        !Object.values(OperatorCertificationStatus).includes(status as OperatorCertificationStatus))
    ) {
      throw new HttpError('status must be PENDING, CERTIFIED, or REJECTED', 400);
    }
    const profiles = await prisma.operatorProfile.findMany({
      ...(status ? { where: { certificationStatus: status as OperatorCertificationStatus } } : {}),
      select: {
        bio: true,
        experienceYears: true,
        certificationStatus: true,
        certifiedAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
        documents: {
          select: {
            id: true,
            type: true,
            originalName: true,
            status: true,
            reviewNotes: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    response.json(profiles);
  } catch (error) {
    next(error);
  }
});

router.post('/profile', authenticate, requireRole(UserRole.OPERATOR), async (request, response, next) => {
  try {
    const body: unknown = request.body;
    if (
      !isRecord(body) ||
      typeof body.bio !== 'string' ||
      body.bio.trim().length > 2000 ||
      typeof body.experienceYears !== 'number' ||
      !Number.isInteger(body.experienceYears) ||
      body.experienceYears < 0 ||
      body.experienceYears > 60 ||
      (body.documents !== undefined && !Array.isArray(body.documents))
    ) {
      throw new HttpError('Provide a bio (up to 2000 characters), experienceYears (0-60), and documents list', 400);
    }

    const documents = body.documents ?? [];
    if (documents.length > 10) throw new HttpError('You can submit at most 10 documents at a time', 400);
    const bio = body.bio.trim();
    const experienceYears = body.experienceYears;
    const userId = currentUser(request).id;
    const folderPrefix = `agrishare/operators/${userId}/`;
    const preparedDocuments = documents.map((document: unknown) => {
      if (
        !isRecord(document) ||
        typeof document.publicId !== 'string' ||
        !document.publicId.startsWith(folderPrefix) ||
        !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?$/.test(document.publicId.slice(folderPrefix.length)) ||
        typeof document.originalName !== 'string' ||
        document.originalName.trim().length === 0 ||
        document.originalName.length > 200 ||
        typeof document.type !== 'string' ||
        !Object.values(OperatorDocumentType).includes(document.type as OperatorDocumentType)
      ) {
        throw new HttpError('Each document must be a valid private upload for this operator', 400);
      }
      return {
        fileUrl: document.publicId,
        originalName: document.originalName.trim(),
        type: document.type as OperatorDocumentType,
      };
    });

    const profile = await prisma.$transaction(async (transaction) => {
      const savedProfile = await transaction.operatorProfile.upsert({
        where: { userId },
        create: {
          userId,
          bio,
          experienceYears,
          ...(preparedDocuments.length > 0
            ? { certificationStatus: OperatorCertificationStatus.PENDING, certifiedAt: null }
            : {}),
        },
        update: {
          bio,
          experienceYears,
          ...(preparedDocuments.length > 0
            ? { certificationStatus: OperatorCertificationStatus.PENDING, certifiedAt: null }
            : {}),
        },
      });
      if (preparedDocuments.length > 0) {
        await transaction.operatorDocument.createMany({
          data: preparedDocuments.map((document) => ({ ...document, profileId: savedProfile.id })),
        });
      }
      return transaction.operatorProfile.findUniqueOrThrow({
        where: { id: savedProfile.id },
        select: profileSelect,
      });
    });
    response.json(profile);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/profile/documents/:documentId/download',
  authenticate,
  requireRole(UserRole.OPERATOR, UserRole.ADMIN),
  async (request, response, next) => {
    try {
      const documentId = routeParam(request.params.documentId);
      if (!documentId) throw new HttpError('Document not found', 404);
      const user = currentUser(request);
      const document = await prisma.operatorDocument.findUnique({
        where: { id: documentId },
        select: { fileUrl: true, profile: { select: { userId: true } } },
      });
      if (!document || (user.role === UserRole.OPERATOR && document.profile.userId !== user.id)) {
        throw new HttpError('Document not found', 404);
      }
      const expectedFolder = `agrishare/operators/${document.profile.userId}/`;
      if (
        !document.fileUrl.startsWith(expectedFolder) ||
        !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?$/.test(document.fileUrl.slice(expectedFolder.length))
      ) {
        throw new HttpError('Private document is not available', 404);
      }
      configureCloudinary();
      const expiresAt = Math.floor(Date.now() / 1000) + 300;
      const url = cloudinary.utils.private_download_url(document.fileUrl, '', {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: expiresAt,
        attachment: true,
      });
      response.json({ url, expiresAt });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/:id/documents', authenticate, requireRole(UserRole.ADMIN), async (request, response, next) => {
  try {
    const userId = routeParam(request.params.id);
    if (!userId) throw new HttpError('Operator profile not found', 404);
    const profile = await prisma.operatorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        documents: {
          select: {
            id: true,
            type: true,
            originalName: true,
            status: true,
            reviewNotes: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!profile) throw new HttpError('Operator profile not found', 404);
    response.json(profile.documents);
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:id/verification',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (request, response, next) => {
    try {
      const userId = routeParam(request.params.id);
      const body: unknown = request.body;
      if (
        !userId ||
        !isRecord(body) ||
        (body.status !== OperatorCertificationStatus.CERTIFIED &&
          body.status !== OperatorCertificationStatus.REJECTED) ||
        (body.reviewNotes !== undefined && typeof body.reviewNotes !== 'string') ||
        (typeof body.reviewNotes === 'string' && body.reviewNotes.length > 1000)
      ) {
        throw new HttpError('status must be CERTIFIED or REJECTED, with optional reviewNotes up to 1000 characters', 400);
      }
      const status = body.status;
      const profile = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.operatorProfile.findUnique({
          where: { userId },
          select: {
            id: true,
            certificationStatus: true,
            documents: {
              where: {
                type: { in: [OperatorDocumentType.CERTIFICATE, OperatorDocumentType.LICENSE] },
              },
              select: { id: true },
              take: 1,
            },
          },
        });
        if (!existing) throw new HttpError('Operator profile not found', 404);
        const certified = status === OperatorCertificationStatus.CERTIFIED;
        if (certified && existing.documents.length === 0) {
          throw new HttpError('An operator must submit a certificate or license before certification', 409);
        }
        await transaction.operatorProfile.update({
          where: { id: existing.id },
          data: {
            certificationStatus: status,
            certifiedAt: certified ? new Date() : null,
          },
        });
        await transaction.operatorDocument.updateMany({
          where: { profileId: existing.id },
          data: {
            status: certified ? OperatorDocumentStatus.APPROVED : OperatorDocumentStatus.REJECTED,
            reviewNotes: typeof body.reviewNotes === 'string' ? body.reviewNotes.trim() || null : null,
            reviewedAt: new Date(),
          },
        });
        if (existing.certificationStatus !== status) {
          await createNotification(transaction, {
            userId,
            type: NotificationType.CERTIFICATION_UPDATE,
            title: certified ? 'Operator certification approved' : 'Operator certification update',
            message: certified
              ? 'Your operator profile has been certified.'
              : `Your operator certification was not approved.${typeof body.reviewNotes === 'string' && body.reviewNotes.trim() ? ` ${body.reviewNotes.trim()}` : ''}`,
          });
        }
        return transaction.operatorProfile.findUniqueOrThrow({
          where: { id: existing.id },
          select: profileSelect,
        });
      });
      response.json(profile);
    } catch (error) {
      next(error);
    }
  },
);

router.get('/:id', async (request, response, next) => {
  try {
    const userId = routeParam(request.params.id);
    if (!userId) throw new HttpError('Operator not found', 404);
    const profile = await prisma.operatorProfile.findUnique({
      where: { userId },
      select: {
        bio: true,
        experienceYears: true,
        certificationStatus: true,
        certifiedAt: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!profile) throw new HttpError('Operator not found', 404);
    response.json(profile);
  } catch (error) {
    next(error);
  }
});

export default router;
