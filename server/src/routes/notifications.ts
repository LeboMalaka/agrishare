import { Router } from 'express';

import { HttpError } from '../lib/http-error';
import { authenticate, currentUser } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', authenticate, async (request, response, next) => {
  try {
    const userId = currentUser(request).id;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    response.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', authenticate, async (request, response, next) => {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError('Notification not found', 404);
    const userId = currentUser(request).id;
    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new HttpError('Notification not found', 404);
    const updated = notification.readAt
      ? notification
      : await prisma.notification.update({
        where: { id: notification.id },
        data: { readAt: new Date() },
      });
    const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
    response.json({ notification: updated, unreadCount });
  } catch (error) {
    next(error);
  }
});

export default router;
