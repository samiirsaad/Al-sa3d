import Database from 'better-sqlite3';

export const createTables = (db: Database.Database) => {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'pharmacist', 'cashier', 'inventory_manager', 'reports_manager')),
      full_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Drugs table
    CREATE TABLE IF NOT EXISTS drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE,
      category TEXT,
      manufacturer TEXT,
      dosage_strength TEXT,
      dosage_unit TEXT,
      dosage_form TEXT,
      storage_temp TEXT,
      cost_price INTEGER NOT NULL DEFAULT 0,
      sell_price INTEGER NOT NULL DEFAULT 0,
      min_qty INTEGER NOT NULL DEFAULT 5,
      max_qty INTEGER NOT NULL DEFAULT 100,
      is_controlled INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Suppliers table
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      payment_terms TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- Inventory lots table
    CREATE TABLE IF NOT EXISTS inventory_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
      lot_number TEXT NOT NULL,
      manufacture_date TEXT,
      expiry_date TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      received_date TEXT DEFAULT (datetime('now')),
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT
    );

    -- Inventory transactions table
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
      lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE SET NULL,
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('IN', 'OUT', 'ADJUSTMENT', 'DISPOSAL')),
      quantity INTEGER NOT NULL,
      reference_id INTEGER,
      reference_type TEXT,
      performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );

    -- Customers table
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      national_id TEXT,
      allergies TEXT,
      chronic_diseases TEXT,
      notes TEXT,
      loyalty_points INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Invoices table
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      total_amount INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      tax_amount INTEGER NOT NULL DEFAULT 0,
      net_amount INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'CARD', 'TRANSFER', 'CREDIT')),
      payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK(payment_status IN ('PAID', 'PENDING', 'CANCELLED')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Invoice items table
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
      lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price INTEGER NOT NULL,
      discount_pct REAL DEFAULT 0,
      subtotal INTEGER NOT NULL
    );

    -- Purchase orders table
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SENT', 'RECEIVED', 'CANCELLED')),
      total_amount INTEGER NOT NULL DEFAULT 0,
      ordered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ordered_at TEXT DEFAULT (datetime('now')),
      received_at TEXT,
      notes TEXT
    );

    -- Purchase order items table
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
      quantity_ordered INTEGER NOT NULL,
      quantity_received INTEGER DEFAULT 0,
      unit_cost INTEGER NOT NULL
    );

    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_drugs_barcode ON drugs(barcode);
    CREATE INDEX IF NOT EXISTS idx_drugs_sku ON drugs(sku);
    CREATE INDEX IF NOT EXISTS idx_inventory_lots_expiry ON inventory_lots(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_inventory_lots_drug ON inventory_lots(drug_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_drug ON invoice_items(drug_id);
  `);
};

export const seedDatabase = (db: Database.Database) => {
  const bcrypt = require('bcryptjs');
  
  // Check if admin already exists
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (existingAdmin) return;

  const passwordHash = bcrypt.hashSync('admin123', 10);

  // Insert default admin user
  db.prepare(`
    INSERT INTO users (username, password_hash, role, full_name, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run('admin', passwordHash, 'admin', 'System Administrator');

  // Insert default settings
  const settings = [
    ['pharmacy_name', 'My Pharmacy'],
    ['pharmacy_address', '123 Main Street'],
    ['pharmacy_phone', '+1-555-0100'],
    ['tax_rate', '0'],
    ['invoice_prefix', 'INV-'],
    ['low_stock_threshold', '5'],
  ];

  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of settings) {
    insertSetting.run(key, value);
  }

  // Insert sample drugs
  const sampleDrugs = [
    ['Paracetamol 500mg', 'باراسيتامول ٥٠٠ملغ', 'DRG-001', '1234567890123', 'Analgesics', 'PharmaCorp', '500', 'mg', 'Tablet', 'Room Temp', 500, 1000, 50, 500, 0],
    ['Amoxicillin 250mg', 'أموكسيسيلين ٢٥٠ملغ', 'DRG-002', '1234567890124', 'Antibiotics', 'MediLab', '250', 'mg', 'Capsule', 'Cool Dry Place', 800, 1500, 30, 300, 0],
    ['Ibuprofen 400mg', 'ايبوبروفين ٤٠٠ملغ', 'DRG-003', '1234567890125', 'Analgesics', 'PharmaCorp', '400', 'mg', 'Tablet', 'Room Temp', 600, 1200, 40, 400, 0],
    ['Omeprazole 20mg', 'أوميبرازول ٢٠ملغ', 'DRG-004', '1234567890126', 'Gastrointestinal', 'GastroMed', '20', 'mg', 'Capsule', 'Room Temp', 700, 1400, 25, 250, 0],
    ['Metformin 500mg', 'ميتفورمين ٥٠٠ملغ', 'DRG-005', '1234567890127', 'Diabetes', 'DiabeCare', '500', 'mg', 'Tablet', 'Room Temp', 400, 800, 100, 1000, 0],
  ];

  const insertDrug = db.prepare(`
    INSERT INTO drugs (name_en, name_ar, sku, barcode, category, manufacturer, dosage_strength, dosage_unit, dosage_form, storage_temp, cost_price, sell_price, min_qty, max_qty, is_controlled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const drug of sampleDrugs) {
    insertDrug.run(...drug);
  }

  // Insert sample inventory lots
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nearExpiryDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const insertLot = db.prepare(`
    INSERT INTO inventory_lots (drug_id, lot_number, manufacture_date, expiry_date, quantity, received_date, received_by)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  // Lots for drug 1
  insertLot.run(1, 'LOT-001', '2024-01-01', futureDate, 200, today);
  insertLot.run(1, 'LOT-002', '2023-06-01', nearExpiryDate, 50, today);
  insertLot.run(1, 'LOT-EXP', '2023-01-01', expiredDate, 10, today);

  // Lots for other drugs
  for (let i = 2; i <= 5; i++) {
    insertLot.run(i, `LOT-00${i}`, '2024-01-01', futureDate, 100, today);
  }

  // Insert sample suppliers
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (name, contact_person, phone, email, address, payment_terms, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  insertSupplier.run('PharmaCorp', 'John Smith', '+1-555-0101', 'john@pharmacorp.com', '100 Pharma Way', 'Net 30');
  insertSupplier.run('MediLab', 'Sarah Johnson', '+1-555-0102', 'sarah@medilab.com', '200 Medical Blvd', 'Net 45');
  insertSupplier.run('GastroMed', 'Mike Brown', '+1-555-0103', 'mike@gastromed.com', '300 Health St', 'Net 30');
  insertSupplier.run('DiabeCare', 'Lisa White', '+1-555-0104', 'lisa@diabecare.com', '400 Wellness Ave', 'Net 60');

  // Insert sample customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, email, address, national_id, allergies, chronic_diseases, loyalty_points)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  insertCustomer.run('Ahmed Hassan', '+1-555-1001', 'ahmed@email.com', '10 Street A', 'ID001', 'Penicillin', 'Diabetes', 0);
  insertCustomer.run('Fatima Ali', '+1-555-1002', 'fatima@email.com', '20 Street B', 'ID002', NULL, 'Hypertension', 0);
  insertCustomer.run('Mohammed Omar', '+1-555-1003', 'mohammed@email.com', '30 Street C', 'ID003', NULL, NULL, 0);
};
