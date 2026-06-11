-- AlterEnum
ALTER TYPE "InventoryType" ADD VALUE 'ROOM_CHARGE';

-- AlterEnum
ALTER TYPE "RoomChargeType" ADD VALUE 'ROOM_SERVICE';
ALTER TYPE "RoomChargeType" ADD VALUE 'DAMAGE';
ALTER TYPE "RoomChargeType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "RoomCharge" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "checkoutOrderId" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "RoomCharge_bookingId_idx" ON "RoomCharge"("bookingId");
CREATE INDEX "RoomCharge_roomId_idx" ON "RoomCharge"("roomId");
CREATE INDEX "RoomCharge_checkoutOrderId_idx" ON "RoomCharge"("checkoutOrderId");

-- AddForeignKey
ALTER TABLE "RoomCharge" ADD CONSTRAINT "RoomCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomCharge" ADD CONSTRAINT "RoomCharge_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomCharge" ADD CONSTRAINT "RoomCharge_checkoutOrderId_fkey" FOREIGN KEY ("checkoutOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
