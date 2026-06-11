import { RoomChargeType } from "@prisma/client";

export const FOLIO_PAYMENT_NOTE = "FOLIO_PAYMENT";
export const ROOM_CHECKOUT_NOTE = "ROOM_CHECKOUT";
export const WALK_IN_ROOM_SALE_NOTE = "WALK_IN_ROOM_SALE";

/** Order notes that count as payments against a room folio. */
export const ROOM_PAYMENT_ORDER_NOTES = [
  FOLIO_PAYMENT_NOTE,
  ROOM_CHECKOUT_NOTE,
  WALK_IN_ROOM_SALE_NOTE,
] as const;

export const ROOM_CHARGE_CATEGORIES: { value: RoomChargeType; label: string }[] = [
  { value: "FOOD", label: "Food" },
  { value: "DRINKS", label: "Drinks" },
  { value: "ALCOHOL", label: "Alcohol" },
  { value: "LAUNDRY", label: "Laundry" },
  { value: "ROOM_SERVICE", label: "Room Service" },
  { value: "EXTRA_SERVICE", label: "Extra Service" },
  { value: "DAMAGE", label: "Damage / Extra" },
  { value: "OTHER", label: "Other" },
];

export function calcNightsStayed(checkIn: Date, checkOut: Date, asOf = new Date()): number {
  const end = asOf < checkOut ? asOf : checkOut;
  const ms = end.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function calcAccommodationSubtotal(nights: number, ratePerNight: number): number {
  return Math.round(nights * ratePerNight * 100) / 100;
}

export function calcBookedNights(checkIn: Date, checkOut: Date): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function accommodationDescription(roomNumber: string): string {
  return `Room ${roomNumber} Accommodation`;
}

export function isRoomBillingDisabled(status: string): boolean {
  return status === "CLEANING" || status === "MAINTENANCE";
}

export function isAccommodationCharge(type: RoomChargeType): boolean {
  return type === "ACCOMMODATION";
}

export function mapProductCategoryToChargeType(categoryType: string): RoomChargeType {
  switch (categoryType) {
    case "FOOD":
      return "FOOD";
    case "BAR":
      return "DRINKS";
    case "ALCOHOL":
      return "ALCOHOL";
    case "ROOM_SERVICE":
      return "ROOM_SERVICE";
    case "LAUNDRY":
      return "LAUNDRY";
    default:
      return "OTHER";
  }
}

export function isProductSellable(product: {
  status: string;
  isActive: boolean;
  deletedAt: Date | null;
  archivedAt: Date | null;
}): boolean {
  return product.status === "ACTIVE" && product.isActive && !product.deletedAt && !product.archivedAt;
}
