import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { UserRole } from '@prisma/client';

import { currentUser, authenticate, requireRole } from '../middleware/auth';
import {
  createEquipmentUploadSignature,
  createOperatorDocumentUploadSignature,
} from '../services/cloudinary';

const router = Router();

router.post(
  '/signature',
  authenticate,
  requireRole(UserRole.EQUIPMENT_OWNER),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  (request, response, next) => {
    try {
      response.json(createEquipmentUploadSignature(currentUser(request).id));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/operator-document-signature',
  authenticate,
  requireRole(UserRole.OPERATOR),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  (request, response, next) => {
    try {
      response.json(createOperatorDocumentUploadSignature(currentUser(request).id));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
