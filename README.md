# StockSense

A modular Inventory Management System built for the Odoo Hackathon.

StockSense helps inventory managers and warehouse staff manage products, warehouses, stock movements, receipts, deliveries, internal transfers, inventory adjustments, and stock history from a centralized system.

---

## 🚀 Features

### Authentication

* User Signup
* Login / Logout
* Forgot Password with OTP
* Protected routes

### Product Management

* Create and update products
* SKU management
* Product categories
* Unit of measurement
* Minimum stock threshold
* Stock status

### Warehouse Management

* Multiple warehouses
* Warehouse locations
* Location-wise stock tracking

### Inventory Operations

#### Receipts

Receive incoming goods and automatically increase stock.

#### Delivery Orders

Deliver outgoing goods and automatically decrease stock.

#### Internal Transfers

Move stock between locations while keeping total stock unchanged.

#### Inventory Adjustments

Correct stock when physical quantity differs from system quantity.

### Stock Ledger

Centralized Move History containing:

* Receipts
* Deliveries
* Internal Transfers
* Inventory Adjustments

### Dashboard

Real database-driven KPIs:

* Total Stock
* Low / Out of Stock
* Pending Receipts
* Pending Deliveries
* Scheduled Transfers

### Low Stock

* Minimum stock threshold
* Low stock warning
* Out-of-stock status

---

## 🛠️ Tech Stack

* **Frontend:** Next.js, React, TypeScript
* **Styling:** Tailwind CSS
* **Backend:** Next.js API / Server Actions
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Validation:** Zod
* **Authentication:** Auth.js / NextAuth
* **Email:** Resend
* **Version Control:** Git + GitHub

---

## 📁 Project Structure

```text
StockSense/
├── app/
│   ├── dashboard/
│   ├── products/
│   ├── operations/
│   │   ├── receipts/
│   │   ├── deliveries/
│   │   ├── transfers/
│   │   ├── adjustments/
│   │   └── move-history/
│   ├── settings/
│   └── profile/
│
├── components/
├── lib/
│   ├── prisma/
│   ├── auth/
│   └── services/
│
├── prisma/
│   └── schema.prisma
│
├── public/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

> The actual structure may differ slightly depending on the implementation.

---

## ⚙️ Requirements

Before running StockSense, install:

* Node.js 18+
* npm
* PostgreSQL
* Git

---

## 📥 Installation

Clone the repository:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

Go to the project:

```bash
cd StockSense
```

Install dependencies:

```bash
npm install
```

---

## 🔐 Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL="your-postgresql-database-url"

AUTH_SECRET="your-long-random-secret"

RESEND_API_KEY="your-resend-api-key"

EMAIL_FROM="your-verified-sender@example.com"
```

Never commit `.env.local` or real credentials to GitHub.

Use `.env.example` as the template.

---

## 🔐 Password Reset OTP

StockSense uses an OTP-based password reset system.

### Flow

```text
Forgot Password
       ↓
Enter Registered Email
       ↓
Generate 6-Digit OTP
       ↓
OTP Sent to Email
       ↓
Enter OTP
       ↓
Verify OTP
       ↓
Create New Password
       ↓
Password Reset Successful
```

### OTP Security

* OTP is 6 digits.
* OTP expires after 10 minutes.
* OTP is stored as a hash in the database.
* OTP cannot be reused after successful verification.
* Invalid or expired OTPs are rejected.
* Passwords are securely hashed.
* OTPs are never stored as plain text.

### Email Configuration

StockSense uses Resend for sending password-reset OTP emails.

Add the following variables to `.env.local`:

```env
RESEND_API_KEY="your-resend-api-key"
EMAIL_FROM="your-verified-sender@example.com"
```

Do not commit `.env.local` or the Resend API key to GitHub.

For development, make sure the sender email/domain is configured correctly in Resend.

### Password Reset Email

The user receives an email containing:

```text
StockSense Password Reset OTP

Your OTP is: 123456

This OTP expires in 10 minutes.

If you did not request a password reset, you can safely ignore this email.

StockSense Team
```

The actual OTP is generated dynamically and is never hardcoded.

### Development Troubleshooting

If the OTP email is not received:

1. Check the `RESEND_API_KEY`.
2. Check that `EMAIL_FROM` is a verified sender.
3. Check the Resend email logs.
4. Check the recipient's Spam/Junk folder.
5. Check the server terminal for email-sending errors.

Never expose the Resend API key or OTP in client-side code.

---

## 🗄️ Database Setup

Create/configure your PostgreSQL database.

Then run:

```bash
npx prisma generate
```

Apply migrations:

```bash
npx prisma migrate dev
```

If the project contains seed data:

```bash
npx prisma db seed
```

---

## ▶️ Run Development Server

Start the application:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🧪 Testing

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

Start production server:

```bash
npm start
```

---

## 🔄 Core Inventory Flow

StockSense follows this inventory lifecycle:

```text
Receive Stock
      ↓
Stock Increases
      ↓
Internal Transfer
      ↓
Stock Location Changes
      ↓
Delivery
      ↓
Stock Decreases
      ↓
Physical Count
      ↓
Inventory Adjustment
      ↓
Stock Corrected
      ↓
Stock Ledger
      ↓
Dashboard
      ↓
Low Stock Warning
```

---

## 📊 Example

Suppose the warehouse receives:

```text
100 Steel Rods
```

Initial stock:

```text
Rack A = 0
```

After receipt:

```text
Rack A = 100
```

Transfer 30 units:

```text
Rack A = 70
Rack B = 30
```

Deliver 20 units:

```text
Rack B = 10
```

Physical count shows 7:

```text
System = 10
Physical = 7
Adjustment = -3
```

Final stock:

```text
Rack A = 70
Rack B = 7

Total = 77
```

All movements are recorded in the Stock Ledger.

---

## 🔒 Security

* Passwords are hashed.
* Authentication-protected routes are used.
* Stock-changing operations are validated server-side.
* Database transactions are used for stock movements.
* Environment secrets are not stored in Git.
* OTPs are not stored as plaintext.

---

## 📱 Responsive Design

StockSense is designed to work on:

* Desktop
* Tablet
* Mobile

---

## 🚀 Deployment

The application can be deployed using a Next.js-compatible hosting platform such as Vercel with a production PostgreSQL database.

Before deployment:

1. Configure production environment variables.
2. Configure PostgreSQL.
3. Run Prisma migrations.
4. Build the application.
5. Test authentication.
6. Test inventory operations.
7. Verify production database connectivity.

---

## 👥 Target Users

StockSense is designed for:

* Inventory Managers
* Warehouse Staff

---

## 🎯 Hackathon Demo

The recommended demonstration flow is:

```text
Login
 ↓
Dashboard
 ↓
Create/View Product
 ↓
Receive 100 Units
 ↓
Transfer 30 Units
 ↓
Deliver 20 Units
 ↓
Adjust Physical Stock
 ↓
Open Move History
 ↓
Return to Dashboard
 ↓
Show Low Stock Warning
```

---

## 📌 Project Status

**Status:** Hackathon Demo Ready

Core inventory lifecycle:

* ✅ Authentication
* ✅ Product Management
* ✅ Warehouse & Locations
* ✅ Receipts
* ✅ Delivery Orders
* ✅ Internal Transfers
* ✅ Inventory Adjustments
* ✅ Stock Ledger
* ✅ Dashboard
* ✅ Low Stock / Reordering Rules
* ✅ Responsive UI
* ✅ PostgreSQL + Prisma

---

## 📄 License

This project was developed as part of the Odoo Hackathon.
