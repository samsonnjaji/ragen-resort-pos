import { RoomChargeType } from "@prisma/client";

export const FOLIO_PAYMENT_NOTE = "FOLIO_PAYMENT";
export const ROOM_CHECKOUT_NOTE = "ROOM_CHECKOUT";

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
