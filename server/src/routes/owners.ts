import { Router } from 'express';

import { HttpError } from '../lib/http-error';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/:id', async (request, response, next) => {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError('Owner not found', 404);
    const owner = await prisma.user.findFirst({
      where: { id, role: 'EQUIPMENT_OWNER' },
      select: {
        id: true,
        name: true,
        equipment: {
          select: {
            id: true,
            name: true,
            category: true,
            location: true,
            pricePerDay: true,
            imageUrl: true,
            availability: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!owner) throw new HttpError('Owner not found', 404);
    response.json(owner);
  } catch (error) {
    next(error);
  }
});

export default router;
