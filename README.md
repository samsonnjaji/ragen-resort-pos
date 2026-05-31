# RAGEN RESORT POS

Production-ready hospitality management platform for resorts — POS, bar, restaurant, inventory, rooms, billing, and reports.

**Repository:** [github.com/samsonnjaji/ragen-resort-pos](https://github.com/samsonnjaji/ragen-resort-pos)

## Features

| Module | Capabilities |
|--------|-------------|
| **Dashboard** | Revenue KPIs, occupancy, charts, low stock, activity log |
| **POS** | Cart, discount/tax, hold/resume, Cash/M-Pesa/Card/Bank/Split, receipts |
| **Products** | Categories, SKU, barcode, pricing, stock alerts |
| **Inventory** | Stock in/out, adjustments, wastage, history |
| **Rooms** | Color-coded status (Available/Occupied/Reserved/Cleaning/Maintenance) |
| **Reservations** | Guests, bookings, check-in/check-out |
| **Room Billing** | Food, drinks, alcohol, laundry, extra charges |
| **Restaurant & Bar** | Kitchen/bar tickets with order workflow |
| **Expenses** | Categories, daily/monthly summaries |
| **Purchases** | Suppliers, POs, goods receiving, auto stock update |
| **Reports** | Sales, profit, inventory, occupancy, cashiers, CSV export |
| **Users** | Role-based access (Admin, Cashier, Bar, Restaurant, Room Manager) |
| **Settings** | Business info, 16% tax, KES currency, receipt footer |
| **PWA** | Installable on mobile/desktop (Add to Home Screen) |

## Tech Stack

Next.js 15 · TypeScript · TailwindCSS · ShadCN UI · Prisma · SQLite (dev) / PostgreSQL (prod) · NextAuth · Zustand · React Hook Form · Zod · Recharts

## Quick Start

```bash
git clone https://github.com/samsonnjaji/ragen-resort-pos.git
cd ragen-resort-pos
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### One-Command Setup

```bash
npm install && npm run setup && npm run dev
```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ragenresort.com | admin123 |
| Cashier | cashier@ragenresort.com | cashier123 |
| Restaurant | restaurant@ragenresort.com | restaurant123 |
| Bar | bar@ragenresort.com | bar123 |
| Room Manager | rooms@ragenresort.com | rooms123 |

## Database

**Development (default):** SQLite — no PostgreSQL install required.

```env
DATABASE_URL="file:./dev.db"
```

**Production:** Switch `prisma/schema.prisma` provider to `postgresql` and set:

```env
DATABASE_URL="postgresql://user:password@host:5432/ragen_resort"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="strong-random-secret"
```

## Seed Data

- Rooms 101–110
- 14 products (Tusker, Guinness, Pilau, Chicken, etc.)
- 8 categories
- Admin + Cashier + role users
- Default RAGEN RESORT settings

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run setup        # db push + seed
npm run db:seed      # Seed sample data
npm run db:studio    # Prisma Studio
```

## Project Structure

```
src/app/(dashboard)/   # Protected pages
src/lib/actions/       # Server actions
src/components/        # UI + feature components
prisma/schema.prisma   # 18 database models
prisma/seed.ts         # Sample data
public/sw.js           # PWA service worker
```

## Deployment

1. Push to GitHub
2. Set environment variables on host (Vercel, Railway, VPS)
3. Use PostgreSQL in production
4. Run `npx prisma db push && npm run db:seed && npm run build`
5. Start with `npm start`

## Branding

- **Name:** RAGEN RESORT
- **Theme:** Premium resort — Emerald green, gold accents, dark mode
- **Currency:** KES

---

Built for **RAGEN RESORT**
