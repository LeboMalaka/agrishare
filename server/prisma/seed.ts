import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import {
  EquipmentCategory,
  EquipmentStatus,
  OperatorCertificationStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client';

dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const ownerEmail = 'equipment-owner@demo.agrishare.local';
const demoAccounts = [
  { email: 'farmer@demo.agrishare.local', name: 'AgriShare Demo Farmer', role: UserRole.FARMER },
  { email: ownerEmail, name: 'AgriShare Demo Owner', role: UserRole.EQUIPMENT_OWNER },
  { email: 'operator@demo.agrishare.local', name: 'AgriShare Demo Operator', role: UserRole.OPERATOR },
] as const;

const demoEquipment = [
  {
    name: 'John Deere 5115M',
    category: EquipmentCategory.TRACTORS,
    description: 'Reliable 4WD tractor for field preparation and medium-scale crop management.',
    pricePerDay: 420,
    location: 'Nelspruit, Mpumalanga',
    imageUrl:
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80',
    specifications: ['110 HP', '4WD', 'Hydraulic implements'],
  },
  {
    name: 'Precision Planter Elite',
    category: EquipmentCategory.PLANTERS,
    description: 'High-efficiency planter with configurable spacing for maize and sunflower.',
    pricePerDay: 360,
    location: 'Hazyview, Mpumalanga',
    imageUrl:
      'https://images.unsplash.com/photo-1464226184884-fa52ac9f1dcb?auto=format&fit=crop&w=1200&q=80',
    specifications: ['12-row', 'Variable seed rate', 'GPS-ready'],
  },
  {
    name: 'AgriScout Drone',
    category: EquipmentCategory.AGRICULTURAL_DRONES,
    description: 'Crop health and pest scouting drone for field inspections and irrigation planning.',
    pricePerDay: 290,
    location: 'White River, Mpumalanga',
    imageUrl:
      'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=1200&q=80',
    specifications: ['HD camera', 'Autonomous flight paths', '15 km coverage'],
  },
];

async function seed() {
  const generatedCredentials: { email: string; password: string }[] = [];
  const users = new Map<UserRole, { id: string }>();

  for (const account of demoAccounts) {
    let user = await prisma.user.findUnique({
      where: { email: account.email },
      select: { id: true },
    });

    if (!user) {
      const password = randomBytes(32).toString('base64url');
      user = await prisma.user.create({
        data: {
          name: account.name,
          email: account.email,
          passwordHash: await bcrypt.hash(password, 12),
          role: account.role,
          ...(account.role === UserRole.OPERATOR
            ? {
                operatorProfile: {
                  create: {
                    bio: 'Demo profile for testing only.',
                    certificationStatus: OperatorCertificationStatus.CERTIFIED,
                    certifiedAt: new Date(),
                  },
                },
              }
            : {}),
        },
        select: { id: true },
      });
      generatedCredentials.push({ email: account.email, password });
    } else if (account.role === UserRole.OPERATOR) {
      await prisma.operatorProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          bio: 'Demo profile for testing only.',
          certificationStatus: OperatorCertificationStatus.CERTIFIED,
          certifiedAt: new Date(),
        },
        update: {},
      });
    }

    users.set(account.role, user);
  }

  const owner = users.get(UserRole.EQUIPMENT_OWNER);
  if (!owner) {
    throw new Error('Failed to create demo equipment owner');
  }

  for (const item of demoEquipment) {
    const existing = await prisma.equipment.findFirst({
      where: { ownerId: owner.id, name: item.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.equipment.update({
        where: { id: existing.id },
        data: { ...item, availability: EquipmentStatus.AVAILABLE },
      });
    } else {
      await prisma.equipment.create({
        data: {
          ...item,
          ownerId: owner.id,
          availability: EquipmentStatus.AVAILABLE,
        },
      });
    }
  }

  console.log(`Seeded ${demoEquipment.length} demonstration listings.`);
  console.log('Demo role accounts:');
  for (const account of demoAccounts) {
    console.log(`- ${account.role}: ${account.email}`);
  }
  if (generatedCredentials.length > 0) {
    console.log('One-time passwords for accounts created by this run:');
    for (const credential of generatedCredentials) {
      console.log(`- ${credential.email}: ${credential.password}`);
    }
  } else {
    console.log('All demo accounts already exist; their passwords were not changed.');
  }
}

seed()
  .catch((error: unknown) => {
    console.error('Failed to seed AgriShare demo data.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
