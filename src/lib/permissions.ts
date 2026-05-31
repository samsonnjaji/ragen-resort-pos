export const ROLES = ["ADMIN", "CASHIER", "RESTAURANT", "BAR", "ROOM_MANAGER"] as const;
export type AppRole = (typeof ROLES)[number];

export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/dashboard": ["ADMIN", "CASHIER", "RESTAURANT", "BAR", "ROOM_MANAGER"],
  "/pos": ["ADMIN", "CASHIER"],
  "/orders": ["ADMIN", "CASHIER", "RESTAURANT", "BAR"],
  "/products": ["ADMIN"],
  "/inventory": ["ADMIN"],
  "/rooms": ["ADMIN", "ROOM_MANAGER"],
  "/bookings": ["ADMIN", "ROOM_MANAGER"],
  "/room-charges": ["ADMIN", "ROOM_MANAGER", "CASHIER"],
  "/restaurant": ["ADMIN", "RESTAURANT", "CASHIER"],
  "/bar": ["ADMIN", "BAR", "CASHIER"],
  "/expenses": ["ADMIN"],
  "/purchases": ["ADMIN"],
  "/reports": ["ADMIN"],
  "/settings": ["ADMIN"],
  "/users": ["ADMIN"],
};

export function canAccessRoute(role: string, path: string): boolean {
  const basePath = "/" + path.split("/").filter(Boolean)[0];
  const allowed = ROUTE_PERMISSIONS[basePath];
  if (!allowed) return role === "ADMIN";
  return allowed.includes(role as AppRole);
}

export function getNavItems(role: string) {
  const allItems = [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/pos", label: "POS", icon: "ShoppingCart" },
    { href: "/orders", label: "Orders", icon: "ClipboardList" },
    { href: "/restaurant", label: "Restaurant", icon: "UtensilsCrossed" },
    { href: "/bar", label: "Bar", icon: "Wine" },
    { href: "/products", label: "Products", icon: "Package" },
    { href: "/inventory", label: "Inventory", icon: "Warehouse" },
    { href: "/rooms", label: "Rooms", icon: "BedDouble" },
    { href: "/bookings", label: "Reservations", icon: "CalendarDays" },
    { href: "/room-charges", label: "Room Billing", icon: "Receipt" },
    { href: "/expenses", label: "Expenses", icon: "Wallet" },
    { href: "/purchases", label: "Purchases", icon: "Truck" },
    { href: "/reports", label: "Reports", icon: "BarChart3" },
    { href: "/settings", label: "Settings", icon: "Settings" },
    { href: "/users", label: "Users", icon: "Users" },
  ];

  return allItems.filter((item) => canAccessRoute(role, item.href));
}
