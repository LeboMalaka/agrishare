import { NotificationType, Prisma } from '@prisma/client';

export async function createNotification(
  transaction: Prisma.TransactionClient,
  notification: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    bookingId?: string;
  },
) {
  await transaction.notification.create({
    data: {
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      ...(notification.bookingId ? { bookingId: notification.bookingId } : {}),
    },
  });
}
