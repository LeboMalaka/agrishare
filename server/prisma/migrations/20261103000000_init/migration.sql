-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARMER', 'EQUIPMENT_OWNER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('TRACTORS', 'PLANTERS', 'AGRICULTURAL_DRONES', 'COLD_STORAGE', 'TRANSPORT_VEHICLES', 'HARVESTING_EQUIPMENT', 'OTHER_MACHINERY');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'BOOKED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperatorCertificationStatus" AS ENUM ('PENDING', 'CERTIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OperatorDocumentType" AS ENUM ('IDENTITY', 'LICENSE', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "OperatorDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_REQUEST', 'BOOKING_STATUS', 'CERTIFICATION_UPDATE', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "pricePerDay" DECIMAL(10,2) NOT NULL,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "specifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentImage" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAvailability" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "certificationStatus" "OperatorCertificationStatus" NOT NULL DEFAULT 'PENDING',
    "certifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorDocument" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "OperatorDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "status" "OperatorDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");

-- CreateIndex
CREATE INDEX "Equipment_category_availability_idx" ON "Equipment"("category", "availability");

-- CreateIndex
CREATE INDEX "Equipment_ownerId_idx" ON "Equipment"("ownerId");

-- CreateIndex
CREATE INDEX "EquipmentImage_equipmentId_idx" ON "EquipmentImage"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentImage_equipmentId_sortOrder_key" ON "EquipmentImage"("equipmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "EquipmentAvailability_equipmentId_startsAt_endsAt_idx" ON "EquipmentAvailability"("equipmentId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAvailability_equipmentId_startsAt_endsAt_key" ON "EquipmentAvailability"("equipmentId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Booking_farmerId_status_idx" ON "Booking"("farmerId", "status");

-- CreateIndex
CREATE INDEX "Booking_ownerId_status_idx" ON "Booking"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Booking_equipmentId_requestedDate_idx" ON "Booking"("equipmentId", "requestedDate");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorProfile_userId_key" ON "OperatorProfile"("userId");

-- CreateIndex
CREATE INDEX "OperatorProfile_certificationStatus_idx" ON "OperatorProfile"("certificationStatus");

-- CreateIndex
CREATE INDEX "OperatorDocument_profileId_status_idx" ON "OperatorDocument"("profileId", "status");

-- CreateIndex
CREATE INDEX "OperatorDocument_type_idx" ON "OperatorDocument"("type");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_bookingId_idx" ON "Notification"("bookingId");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAvailability" ADD CONSTRAINT "EquipmentAvailability_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorProfile" ADD CONSTRAINT "OperatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorDocument" ADD CONSTRAINT "OperatorDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "OperatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
