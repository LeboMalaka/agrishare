CREATE UNIQUE INDEX "Booking_equipmentId_requestedDate_confirmed_key"
ON "Booking" ("equipmentId", "requestedDate")
WHERE "status" = 'CONFIRMED';
