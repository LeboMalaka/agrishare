DROP INDEX "Booking_equipmentId_requestedDate_confirmed_key";

CREATE UNIQUE INDEX "Booking_equipmentId_requestedDate_confirmed_key"
ON "Booking" ("equipmentId", ("requestedDate"::date))
WHERE "status" = 'CONFIRMED';
