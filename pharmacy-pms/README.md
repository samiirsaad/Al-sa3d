# Pharmacy Management System (PMS)

A comprehensive desktop pharmacy management system built with Electron, React, TypeScript, and SQLite.

## Features

### Core Modules
- **Dashboard** - Real-time overview of sales, inventory alerts, and key metrics
- **Inventory Management** - Drug catalog, stock tracking, batch/lot management
- **Point of Sale (POS)** - Fast checkout with barcode scanning support
- **Invoice Management** - View, print, and manage sales invoices
- **Customer Management** - Customer profiles with medical history tracking
- **Supplier Management** - Manage supplier contacts and payment terms
- **Purchase Orders** - Create and track orders to suppliers
- **Expiry Alerts** - Monitor near-expiry and expired medications
- **Reports** - Sales, inventory valuation, profit/loss, performance reports
- **Settings** - Configure pharmacy details, backup/restore database

### User Roles & Permissions
- **Admin** - Full access to all modules
- **Pharmacist** - Access to clinical and inventory features
- **Cashier** - POS and invoice viewing
- **Inventory Manager** - Stock management and purchase orders
- **Reports Manager** - View-only access to reports

### Technical Features
- Offline-first architecture with local SQLite database
- Role-based access control (RBAC)
- Audit logging for all critical operations
- Database backup and restore functionality
- Auto-logout after 8 hours of inactivity
- Responsive UI with Tailwind CSS
- Charts and analytics with Recharts

## Tech Stack

- **Frontend**: React 18, TypeScript, React Router, Zustand
- **UI**: Tailwind CSS, react-hot-toast, react-hook-form, zod
- **Desktop**: Electron 28
- **Database**: better-sqlite3
- **Charts**: Recharts
- **Forms**: react-hook-form with zod validation

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

```bash
# Clone the repository
cd pharmacy-pms

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production
npm run electron:build
```

## Default Credentials

After first launch, login with:
- **Username**: `admin`
- **Password**: `admin123`

## Project Structure

```
pharmacy-pms/
├── electron/
│   ├── main.ts           # Electron main process
│   ├── preload.ts        # Preload script with contextBridge
│   ├── db/
│   │   ├── schema.ts     # Database schema and seed data
│   │   └── index.ts      # Database manager
│   └── ipc/
│       └── handlers.ts   # IPC handlers for renderer communication
├── src/
│   ├── pages/            # Page components
│   ├── components/       # Reusable components
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand stores
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
└── package.json
```

## Development Commands

```bash
# Start Vite dev server only
npm run dev

# Run Electron with hot reload
npm run electron:dev

# Build React app
npm run build

# Build Electron executable
npm run electron:build
```

## Database Location

The SQLite database is stored in the Electron user data directory:
- **Windows**: `%APPDATA%\pharmacy-pms\pharmacy.db`
- **macOS**: `~/Library/Application Support/pharmacy-pms/pharmacy.db`
- **Linux**: `~/.config/pharmacy-pms/pharmacy.db`

## Backup & Restore

Access via Settings page:
1. Click "Backup Database" to save a copy
2. Click "Restore Database" to load from a backup file
3. Application will restart after restore

## Security Considerations

- Passwords are hashed using bcryptjs
- Context isolation enabled in Electron
- Node integration disabled for renderer
- Auto-logout after session timeout
- SQL injection prevention via parameterized queries

## License

MIT License
