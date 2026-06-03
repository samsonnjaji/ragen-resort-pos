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
| **PWA** | Installable on Android/iPad tablets (Add to Home Screen) |

## Tech Stack

Next.js 15 · TypeScript · TailwindCSS · ShadCN UI · Prisma · PostgreSQL (Neon) · NextAuth · Zustand · React Hook Form · Zod · Recharts · Vercel

---

## Production deployment (Vercel + Neon)

This is the recommended setup for resort tablets. The app runs in the cloud — **no PC or laptop needs to stay on** at the resort.

```
[Neon PostgreSQL]  ← live database (cloud)
       ↑
[Vercel]           ← RAGEN RESORT POS (https://your-app.vercel.app)
       ↑ internet
[Tablet 1] [Tablet 2] [Tablet 3]  ← Chrome/Safari PWA, same cloud URL
```

### Step 1 — Create Neon database

1. Sign up at [neon.tech](https://neon.tech) and create a project (e.g. `ragen-resort-pos`).
2. Copy both connection strings from the Neon dashboard:
   - **Pooled** → use as `DATABASE_URL` (for the app on Vercel)
   - **Direct** → use as `DIRECT_URL` (for Prisma migrations)
3. Append `?sslmode=require` if not already present.

### Step 2 — Deploy to Vercel

1. Import [github.com/samsonnjaji/ragen-resort-pos](https://github.com/samsonnjaji/ragen-resort-pos) at [vercel.com/new](https://vercel.com/new).
2. Add environment variables in **Project → Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon **pooled** PostgreSQL connection string |
| `DIRECT_URL` | Neon **direct** connection string (for migrations) |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel URL, e.g. `https://ragen-resort-pos.vercel.app` (no trailing slash) |
| `APP_BASE_URL` | Same as `NEXTAUTH_URL` (used in password reset emails) |
| `EMAIL_SERVER_HOST` | `smtp.gmail.com` |
| `EMAIL_SERVER_PORT` | `587` |
| `EMAIL_SERVER_USER` | Your Gmail address |
| `EMAIL_SERVER_PASSWORD` | Google **App Password** (see below) |
| `EMAIL_FROM` | `RAGEN RESORT POS <your-email@gmail.com>` |

3. Deploy. Vercel runs `prisma migrate deploy && prisma generate && next build` automatically.

### Step 3 — Apply database schema and seed

Run **once** from your machine (with the same env vars), or use Neon SQL editor after exporting the migration:

```bash
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

npm install
npm run setup:prod
```

`setup:prod` runs `prisma migrate deploy` then seeds sample data.

**Alternative (first-time only):** if migrations fail, you can use:

```bash
npx prisma db push
npm run db:seed
```

### Step 4 — Change admin password

After first login, go to **Users** and change the admin password immediately. Default seed credentials are for initial setup only (see below).

---

## Tablet access (Android / iPad)

No Play Store or App Store download is required.

1. Connect the tablet to **Wi-Fi or mobile data** (internet required).
2. Open Chrome (Android), Edge, or Safari (iPad).
3. Go to your deployed URL, e.g. **`https://YOUR-VERCEL-DOMAIN`**
4. Log in with staff credentials (cashier account for POS tablets).
5. Install the app:
   - **Android Chrome:** Menu (⋮) → **Add to Home screen** / **Install app**
   - **iPad Safari:** Share → **Add to Home Screen**
6. Launch **RAGEN POS** from the home screen (standalone, full-screen).

### How it works on tablets

- The tablet **does not store the main database** — all data lives in Neon PostgreSQL.
- Multiple tablets can log in and use the **same live system** simultaneously.
- **Internet is required** for sales, payments, bookings, inventory, and check-in/out.
- If the connection drops, a red banner appears and critical actions are **blocked** (no fake offline sales).
- Static UI assets may be cached by the PWA service worker for faster loading only.

### Receipt printing

1. Complete a sale → tap **Print Receipt**
2. Uses browser print dialog (optimized for **80mm thermal** paper)
3. Pair a Bluetooth printer with the tablet, or use a network printer

---

## Environment variables

See `.env.example`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string (pooled for production) |
| `DIRECT_URL` | Neon direct connection (required for `prisma migrate`) |
| `NEXTAUTH_SECRET` | Secure random secret for session encryption |
| `NEXTAUTH_URL` | Full deployment URL (no trailing slash) |
| `APP_BASE_URL` | Public URL for password reset links (usually same as `NEXTAUTH_URL`) |
| `EMAIL_SERVER_HOST` | SMTP host (`smtp.gmail.com` for Gmail) |
| `EMAIL_SERVER_PORT` | SMTP port (`587` for TLS) |
| `EMAIL_SERVER_USER` | Gmail address |
| `EMAIL_SERVER_PASSWORD` | Google App Password (not your normal Gmail password) |
| `EMAIL_FROM` | Sender, e.g. `RAGEN RESORT POS <you@gmail.com>` |

### Gmail App Password setup

1. Enable **2-Step Verification** on your Google account.
2. Go to Google Account → **Security** → **App passwords**.
3. Create an app password for “Mail” / “Other (RAGEN POS)”.
4. Paste the 16-character password into `EMAIL_SERVER_PASSWORD` in Vercel (and local `.env`).

### Neon database sync (production)

After pulling new code with schema changes:

```bash
npx prisma migrate deploy
```

Vercel also runs this during each deploy (`vercel-build`). For a one-off fix from your machine:

```bash
# Use pooled DATABASE_URL and direct DIRECT_URL from Neon dashboard
npx prisma migrate deploy
```

Use `npx prisma db push` only for local/dev experiments — production should use **migrations**.

### Password reset (test)

1. Set all email env vars and `APP_BASE_URL`.
2. Open `/forgot-password`, enter a seeded user email.
3. Check inbox for reset link (also check spam).
4. Set a new password on `/reset-password?token=...`.
5. Sign in at `/login` with the new password.

### Report export (test)

1. Log in as **Admin** → **Reports**.
2. Choose **Today** (or custom range with both dates) → **Generate Report**.
3. Use the export bar: **Sales CSV**, **Payments CSV**, **Cashiers CSV**, etc.
4. Open the downloaded file — headers and KES amounts should match the on-screen totals.

---

## Initial seed credentials

Used only for first-time setup after seeding. **Change the admin password after deployment.**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ragenresort.com | admin123 |
| Cashier | cashier@ragenresort.com | cashier123 |
| Restaurant | restaurant@ragenresort.com | restaurant123 |
| Bar | bar@ragenresort.com | bar123 |
| Room Manager | rooms@ragenresort.com | rooms123 |

Passwords are **not shown** on the login screen.

---

## Local development

Requires PostgreSQL (local install or a Neon dev branch):

```bash
git clone https://github.com/samsonnjaji/ragen-resort-pos.git
cd ragen-resort-pos
npm install
cp .env.example .env
# Set DATABASE_URL, DIRECT_URL, NEXTAUTH_URL=http://localhost:3000, NEXTAUTH_SECRET

npx prisma migrate dev   # or: npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Optional: LAN testing (dev only)

To test tablet access on the same Wi-Fi during development:

```bash
npm run dev:lan
# Open http://YOUR-PC-IP:3000 on the tablet
```

This is for testing only. Production tablets should use the **Vercel URL**.

---

## Scripts

```bash
npm run dev              # Development server
npm run dev:lan          # Dev over Wi-Fi (local testing)
npm run build            # prisma generate + production build
npm run start            # Production server
npm run db:seed          # Seed sample data
npm run db:migrate       # Apply migrations (production: migrate deploy)
npm run db:migrate:dev   # Create/apply migrations (development)
npm run setup:prod       # migrate deploy + seed (one-time production setup)
npm run db:studio        # Prisma Studio
```

---

## Offline / connection handling

- Service worker caches **static assets only** — not sales or inventory data.
- Health check polls `/api/health` every 15 seconds.
- When offline or server unreachable:
  - Banner: **Connection lost** or **Server unavailable**
  - Blocked: POS sales, payments, stock updates, bookings, check-in/out, purchases
  - Tap **Retry** when connection returns

---

## Security

- Role-based routes enforced via NextAuth middleware
- Passwords hashed with bcrypt; inactive users cannot sign in
- Self-service password reset via email (hashed tokens, 30-minute expiry, one-time use)
- Forgot-password responses do not reveal whether an email exists
- Change default admin password immediately after deployment
- Set a strong `NEXTAUTH_SECRET` in Vercel (never commit `.env`)
- Never commit SMTP app passwords or database URLs

---

## Project structure

```
src/app/(dashboard)/   # Protected pages
src/lib/actions/       # Server actions
src/components/        # UI + feature components
prisma/schema.prisma   # 18 database models
prisma/migrations/     # PostgreSQL migrations
prisma/seed.ts         # Sample data
public/manifest.json   # PWA manifest
public/sw.js           # Service worker (static cache only)
vercel.json            # Vercel build config
```

## Branding

- **Name:** RAGEN RESORT POS
- **Short name:** RAGEN POS
- **Theme:** Emerald green (`#059669`), gold accents, dark mode
- **Currency:** KES

---

Built for **RAGEN RESORT**
