import { IpcMain } from 'electron';
import Database from 'better-sqlite3';
import Store from 'electron-store';
import bcrypt from 'bcryptjs';

export function setupIpcHandlers(ipcMain: IpcMain, db: Database.Database, store: Store) {
  // ==================== AUTH ====================
  ipcMain.handle('auth-login', async (_, username: string, password: string) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as any;
      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      const validPassword = bcrypt.compareSync(password, user.password_hash);
      if (!validPassword) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Log audit
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `).run(user.id, 'LOGIN', 'user', user.id);

      const { password_hash, ...safeUser } = user;
      store.set('currentUser', safeUser);
      store.set('loginTime', Date.now());

      return { success: true, user: safeUser };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth-logout', () => {
    const currentUser = store.get('currentUser');
    if (currentUser) {
      const user = currentUser as any;
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `).run(user.id, 'LOGOUT', 'user', user.id);
    }
    store.delete('currentUser');
    store.delete('loginTime');
    return { success: true };
  });

  ipcMain.handle('auth-get-current-user', () => {
    return store.get('currentUser') || null;
  });

  // ==================== DRUGS ====================
  ipcMain.handle('drugs-get-all', (_, page = 1, limit = 25, filters = {}) => {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE is_active = 1';
      const params: any[] = [];

      if (filters.category) {
        whereClause += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters.search) {
        whereClause += ' AND (name_en LIKE ? OR name_ar LIKE ? OR sku LIKE ? OR barcode LIKE ?)';
        const searchPattern = `%${filters.search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM drugs ${whereClause}`);
      const total = (countStmt.get(...params) as any).count;

      const selectStmt = db.prepare(`
        SELECT d.*, 
               COALESCE(SUM(CASE WHEN il.expiry_date >= date('now') THEN il.quantity ELSE 0 END), 0) as available_qty,
               MIN(il.expiry_date) as nearest_expiry
        FROM drugs d
        LEFT JOIN inventory_lots il ON d.id = il.drug_id AND il.quantity > 0
        ${whereClause}
        GROUP BY d.id
        ORDER BY d.name_en
        LIMIT ? OFFSET ?
      `);

      const drugs = selectStmt.all(...params, limit, offset);

      return { success: true, data: drugs, total, page, limit };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('drugs-get-by-id', (_, id: number) => {
    try {
      const drug = db.prepare('SELECT * FROM drugs WHERE id = ?').get(id);
      return { success: true, data: drug };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('drugs-create', (_, drugData: any) => {
    try {
      const currentUser = store.get('currentUser') as any;
      
      // Convert prices to cents (integers)
      const costPriceCents = Math.round(drugData.cost_price * 100);
      const sellPriceCents = Math.round(drugData.sell_price * 100);

      const result = db.prepare(`
        INSERT INTO drugs (name_ar, name_en, sku, barcode, category, manufacturer, 
                          dosage_strength, dosage_unit, dosage_form, storage_temp,
                          cost_price, sell_price, min_qty, max_qty, is_controlled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        drugData.name_ar, drugData.name_en, drugData.sku, drugData.barcode,
        drugData.category, drugData.manufacturer, drugData.dosage_strength,
        drugData.dosage_unit, drugData.dosage_form, drugData.storage_temp,
        costPriceCents, sellPriceCents, drugData.min_qty, drugData.max_qty,
        drugData.is_controlled ? 1 : 0
      );

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `).run(currentUser?.id, 'CREATE', 'drug', result.lastInsertRowid, JSON.stringify(drugData));

      return { success: true, id: result.lastInsertRowid };
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { success: false, error: 'SKU or Barcode already exists' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('drugs-update', (_, id: number, drugData: any) => {
    try {
      const currentUser = store.get('currentUser') as any;
      const oldDrug = db.prepare('SELECT * FROM drugs WHERE id = ?').get(id);

      const updates: string[] = [];
      const values: any[] = [];

      for (const [key, value] of Object.entries(drugData)) {
        if (key === 'cost_price' || key === 'sell_price') {
          updates.push(`${key} = ?`);
          values.push(Math.round(value * 100));
        } else if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }

      updates.push("updated_at = datetime('now')");

      const stmt = db.prepare(`UPDATE drugs SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values, id);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(currentUser?.id, 'UPDATE', 'drug', id, JSON.stringify(oldDrug), JSON.stringify(drugData));

      return { success: true };
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { success: false, error: 'SKU or Barcode already exists' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('drugs-delete', (_, id: number) => {
    try {
      const currentUser = store.get('currentUser') as any;
      db.prepare('UPDATE drugs SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
      
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `).run(currentUser?.id, 'DELETE', 'drug', id);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('drugs-search', (_, query: string) => {
    try {
      const searchPattern = `%${query}%`;
      const drugs = db.prepare(`
        SELECT d.*, 
               COALESCE(SUM(CASE WHEN il.expiry_date >= date('now') THEN il.quantity ELSE 0 END), 0) as available_qty
        FROM drugs d
        LEFT JOIN inventory_lots il ON d.id = il.drug_id AND il.quantity > 0
        WHERE d.is_active = 1 
          AND (d.name_en LIKE ? OR d.name_ar LIKE ? OR d.sku LIKE ? OR d.barcode LIKE ?)
        GROUP BY d.id
        LIMIT 20
      `).all(searchPattern, searchPattern, searchPattern, searchPattern);

      return { success: true, data: drugs };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==================== INVENTORY ====================
  ipcMain.handle('inventory-get-lots', (_, drugId?: number) => {
    try {
      let lots;
      if (drugId) {
        lots = db.prepare(`
          SELECT il.*, s.name as supplier_name, u.full_name as received_by_name
          FROM inventory_lots il
          LEFT JOIN suppliers s ON il.supplier_id = s.id
          LEFT JOIN users u ON il.received_by = u.id
          WHERE il.drug_id = ? AND il.quantity > 0
          ORDER BY il.expiry_date ASC
        `).all(drugId);
      } else {
        lots = db.prepare(`
          SELECT il.*, d.name_en as drug_name, s.name as supplier_name
          FROM inventory_lots il
          JOIN drugs d ON il.drug_id = d.id
          LEFT JOIN suppliers s ON il.supplier_id = s.id
          WHERE il.quantity > 0
          ORDER BY il.expiry_date ASC
        `).all();
      }
      return { success: true, data: lots };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory-add-lot', (_, lotData: any) => {
    try {
      const currentUser = store.get('currentUser') as any;

      const result = db.prepare(`
        INSERT INTO inventory_lots (drug_id, lot_number, manufacture_date, expiry_date, 
                                   quantity, supplier_id, received_by, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        lotData.drug_id, lotData.lot_number, lotData.manufacture_date,
        lotData.expiry_date, lotData.quantity, lotData.supplier_id,
        currentUser?.id, lotData.notes
      );

      // Create inventory transaction
      db.prepare(`
        INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type, quantity, performed_by)
        VALUES (?, ?, 'IN', ?, ?)
      `).run(lotData.drug_id, result.lastInsertRowid, lotData.quantity, currentUser?.id);

      return { success: true, id: result.lastInsertRowid };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory-get-expiry-alerts', () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const alerts = db.prepare(`
        SELECT d.id as drug_id, d.name_en as drug_name, d.name_ar,
               il.id as lot_id, il.lot_number, il.expiry_date, il.quantity,
               CASE 
                 WHEN il.expiry_date < ? THEN 'red'
                 WHEN il.expiry_date <= date(?, '+14 days') THEN 'orange'
                 WHEN il.expiry_date <= date(?, '+30 days') THEN 'yellow'
                 ELSE 'green'
               END as urgency
        FROM inventory_lots il
        JOIN drugs d ON il.drug_id = d.id
        WHERE il.quantity > 0 AND il.expiry_date <= date(?, '+30 days')
        ORDER BY il.expiry_date ASC
      `).all(today, today, today, today);

      return { success: true, data: alerts };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory-dispose-lot', (_, lotId: number, userId: number) => {
    try {
      const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      if (!lot || lot.quantity === 0) {
        return { success: false, error: 'Lot not found or already empty' };
      }

      const quantity = lot.quantity;
      const drugId = lot.drug_id;

      db.transaction(() => {
        // Set quantity to 0
        db.prepare('UPDATE inventory_lots SET quantity = 0 WHERE id = ?').run(lotId);

        // Create disposal transaction
        db.prepare(`
          INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type, quantity, performed_by, notes)
          VALUES (?, ?, 'DISPOSAL', ?, ?, 'Expired drug disposal')
        `).run(drugId, lotId, quantity, userId);

        // Audit log
        db.prepare(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'DISPOSAL', 'inventory_lot', lotId, JSON.stringify({ quantity, lot_number: lot.lot_number }));
      })();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==================== INVOICES ====================
  ipcMain.handle('invoices-get-all', (_, page = 1, limit = 25, filters = {}) => {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.status) {
        whereClause += ' AND i.payment_status = ?';
        params.push(filters.status);
      }

      if (filters.payment_method) {
        whereClause += ' AND i.payment_method = ?';
        params.push(filters.payment_method);
      }

      if (filters.date_from) {
        whereClause += ' AND date(i.created_at) >= ?';
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        whereClause += ' AND date(i.created_at) <= ?';
        params.push(filters.date_to);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM invoices i ${whereClause}`);
      const total = (countStmt.get(...params) as any).count;

      const selectStmt = db.prepare(`
        SELECT i.*, c.name as customer_name, u.full_name as cashier_name
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        LEFT JOIN users u ON i.cashier_id = u.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
      `);

      const invoices = selectStmt.all(...params, limit, offset);

      return { success: true, data: invoices, total, page, limit };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('invoices-get-by-id', (_, id: number) => {
    try {
      const invoice = db.prepare(`
        SELECT i.*, c.name as customer_name, c.phone as customer_phone,
               u.full_name as cashier_name
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        LEFT JOIN users u ON i.cashier_id = u.id
        WHERE i.id = ?
      `).get(id) as any;

      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      const items = db.prepare(`
        SELECT ii.*, d.name_en as drug_name, d.name_ar, il.lot_number, il.expiry_date
        FROM invoice_items ii
        JOIN drugs d ON ii.drug_id = d.id
        LEFT JOIN inventory_lots il ON ii.lot_id = il.id
        WHERE ii.invoice_id = ?
      `).all(id);

      return { success: true, data: { ...invoice, items } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('invoices-create', (_, invoiceData: any) => {
    try {
      const currentUser = store.get('currentUser') as any;
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }

      // Validate role
      if (!['admin', 'pharmacist', 'cashier'].includes(currentUser.role)) {
        return { success: false, error: 'Unauthorized role' };
      }

      const settings = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get() as any;
      const prefix = settings?.value || 'INV-';

      // Generate unique invoice number
      let invoiceNumber: string;
      let attempts = 0;
      do {
        const timestamp = Date.now().toString(36).toUpperCase();
        invoiceNumber = `${prefix}${timestamp}`;
        attempts++;
        if (attempts > 10) throw new Error('Failed to generate unique invoice number');
      } while (db.prepare('SELECT 1 FROM invoices WHERE invoice_number = ?').get(invoiceNumber));

      // Calculate totals (prices stored as cents)
      let totalAmount = 0;
      for (const item of invoiceData.items) {
        const subtotal = Math.round(item.quantity * item.unit_price * (1 - item.discount_pct / 100) * 100);
        totalAmount += subtotal;
      }

      const discountAmountCents = Math.round((invoiceData.discount_amount || 0) * 100);
      const taxRate = parseFloat(invoiceData.tax_rate || 0);
      const taxAmountCents = Math.round((totalAmount - discountAmountCents) * taxRate / 100);
      const netAmountCents = totalAmount - discountAmountCents + taxAmountCents;

      // Check stock availability using FIFO with exclusive transaction
      const result = db.transaction(() => {
        // Check and deduct stock for each item
        for (const item of invoiceData.items) {
          if (item.quantity <= 0) {
            throw new Error(`Invalid quantity for drug ${item.drug_id}`);
          }

          // Get available lots sorted by expiry (FIFO)
          const lots = db.prepare(`
            SELECT id, quantity, expiry_date 
            FROM inventory_lots 
            WHERE drug_id = ? AND quantity > 0 AND expiry_date >= date('now')
            ORDER BY expiry_date ASC
          `).all(item.drug_id);

          let remainingQty = item.quantity;
          for (const lot of lots as any[]) {
            if (remainingQty <= 0) break;

            const deductQty = Math.min(remainingQty, lot.quantity);
            if (deductQty <= 0) continue;

            // Update lot quantity
            db.prepare('UPDATE inventory_lots SET quantity = quantity - ? WHERE id = ?')
              .run(deductQty, lot.id);

            // Create inventory transaction
            db.prepare(`
              INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type, quantity, reference_id, reference_type, performed_by)
              VALUES (?, ?, 'OUT', ?, ?, 'invoice', ?)
            `).run(item.drug_id, lot.id, -deductQty, null, currentUser.id);

            remainingQty -= deductQty;
          }

          if (remainingQty > 0) {
            throw new Error(`Insufficient stock for drug ${item.drug_id}. Available: ${item.quantity - remainingQty}, Requested: ${item.quantity}`);
          }
        }

        // Insert invoice
        const invoiceResult = db.prepare(`
          INSERT INTO invoices (invoice_number, customer_id, cashier_id, total_amount, discount_amount, tax_amount, net_amount, payment_method, payment_status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?)
        `).run(
          invoiceNumber, invoiceData.customer_id, currentUser.id,
          totalAmount, discountAmountCents, taxAmountCents, netAmountCents,
          invoiceData.payment_method, invoiceData.notes
        );

        const invoiceId = invoiceResult.lastInsertRowid;

        // Insert invoice items
        const insertItem = db.prepare(`
          INSERT INTO invoice_items (invoice_id, drug_id, lot_id, quantity, unit_price, discount_pct, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of invoiceData.items) {
          // Find the lot that was deducted (most recent transaction for this drug)
          const lotInfo = db.prepare(`
            SELECT lot_id FROM inventory_transactions 
            WHERE drug_id = ? AND transaction_type = 'OUT' AND reference_id IS NULL
            ORDER BY created_at DESC LIMIT 1
          `).get(item.drug_id) as any;

          const subtotal = Math.round(item.quantity * item.unit_price * (1 - item.discount_pct / 100) * 100);
          
          insertItem.run(
            invoiceId, item.drug_id, lotInfo?.lot_id || null,
            item.quantity, Math.round(item.unit_price * 100), item.discount_pct, subtotal
          );
        }

        // Audit log
        db.prepare(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
          VALUES (?, ?, ?, ?, ?)
        `).run(currentUser.id, 'CREATE', 'invoice', invoiceId, JSON.stringify({ invoice_number: invoiceNumber, net_amount: netAmountCents }));

        return { invoiceId, invoiceNumber, netAmount: netAmountCents };
      })();

      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('invoices-cancel', (_, id: number, userId: number) => {
    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      if (invoice.payment_status === 'CANCELLED') {
        return { success: false, error: 'Invoice already cancelled' };
      }

      db.transaction(() => {
        // Get invoice items
        const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id) as any[];

        // Restore inventory
        for (const item of items) {
          // Find the original lot
          const lot = db.prepare(`
            SELECT il.* FROM inventory_lots il
            JOIN inventory_transactions it ON il.id = it.lot_id
            WHERE it.reference_id = ? AND it.reference_type = 'invoice' AND it.drug_id = ?
            ORDER BY it.created_at ASC LIMIT 1
          `).get(id, item.drug_id) as any;

          if (lot) {
            // Restore quantity
            db.prepare('UPDATE inventory_lots SET quantity = quantity + ? WHERE id = ?')
              .run(item.quantity, lot.id);

            // Create reverse transaction
            db.prepare(`
              INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type, quantity, reference_id, reference_type, performed_by, notes)
              VALUES (?, ?, 'ADJUSTMENT', ?, ?, 'invoice_cancel', ?, 'Invoice cancellation - stock restored')
            `).run(item.drug_id, lot.id, item.quantity, null, userId);
          }
        }

        // Update invoice status
        db.prepare("UPDATE invoices SET payment_status = 'CANCELLED' WHERE id = ?").run(id);

        // Audit log
        db.prepare(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
          VALUES (?, ?, ?, ?)
        `).run(userId, 'CANCEL', 'invoice', id);
      })();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==================== CUSTOMERS ====================
  ipcMain.handle('customers-get-all', (_, page = 1, limit = 25, search = '') => {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (search) {
        whereClause += ' AND (name LIKE ? OR phone LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM customers ${whereClause}`);
      const total = (countStmt.get(...params) as any).count;

      const selectStmt = db.prepare(`
        SELECT * FROM customers ${whereClause}
        ORDER BY name
        LIMIT ? OFFSET ?
      `);

      const customers = selectStmt.all(...params, limit, offset);

      return { success: true, data: customers, total, page, limit };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customers-get-by-id', (_, id: number) => {
    try {
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      return { success: true, data: customer };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customers-create', (_, customerData: any) => {
    try {
      const result = db.prepare(`
        INSERT INTO customers (name, phone, email, address, national_id, allergies, chronic_diseases, notes, loyalty_points)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerData.name, customerData.phone, customerData.email,
        customerData.address, customerData.national_id, customerData.allergies,
        customerData.chronic_diseases, customerData.notes, customerData.loyalty_points || 0
      );

      return { success: true, id: result.lastInsertRowid };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customers-update', (_, id: number, customerData: any) => {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      for (const [key, value] of Object.entries(customerData)) {
        if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }

      updates.push("updated_at = datetime('now')");

      const stmt = db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values, id);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==================== SUPPLIERS ====================
  ipcMain.handle('suppliers-get-all', () => {
    try {
      const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name').all();
      return { success: true, data: suppliers };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('suppliers-create', (_, supplierData: any) => {
    try {
      const result = db.prepare(`
        INSERT INTO suppliers (name, contact_person, phone, email, address, payment_terms, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        supplierData.name, supplierData.contact_person, supplierData.phone,
        supplierData.email, supplierData.address, supplierData.payment_terms, supplierData.notes
      );

      return { success: true, id: result.lastInsertRowid };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('suppliers-update', (_, id: number, supplierData: any) => {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      for (const [key, value] of Object.entries(supplierData)) {
        if (key !== 'id') {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }

      const stmt = db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values, id);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==================== REPORTS ====================
  ipcMain.handle('reports-get-dashboard-stats', () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Today's revenue
      const revenueResult = db.prepare(`
        SELECT COALESCE(SUM(net_amount), 0) as total 
        FROM invoices 
        WHERE date(created_at) = ? AND payment_status != 'CANCELLED'
      `).get(today) as any;

      // Today's invoices count
      const invoicesResult = db.prepare(`
        SELECT COUNT(*) as count 
        FROM invoices 
        WHERE date(created_at) = ? AND payment_status != 'CANCELLED'
      `).get(today) as any;

      // Low stock items
      const lowStockResult = db.prepare(`
        SELECT COUNT(DISTINCT d.id) as count
        FROM drugs d
        LEFT JOIN (
          SELECT drug_id, SUM(quantity) as total_qty
          FROM inventory_lots
          WHERE expiry_date >= date('now') AND quantity > 0
          GROUP BY drug_id
        ) il ON d.id = il.drug_id
        WHERE COALESCE(il.total_qty, 0) <= d.min_qty AND d.is_active = 1
      `).get() as any;

      // Expiring soon (within 30 days)
      const expiringResult = db.prepare(`
        SELECT COUNT(*) as count
        FROM inventory_lots
        WHERE quantity > 0 AND expiry_date <= date(?, '+30 days')
      `).get(today) as any;

      return {
        success: true,
        data: {
          todayRevenue: revenueResult.total / 100,
          todayInvoices: invoicesResult.count,
          lowStockItems: lowStockResult.count,
          expiringSoon: expiringResult.count,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports-get-sales-data', (_, days: number) => {
    try {
      const salesData = db.prepare(`
        SELECT date(created_at) as date, COALESCE(SUM(net_amount), 0) as revenue
        FROM invoices
        WHERE date(created_at) >= date('now', ?) AND payment_status != 'CANCELLED'
        GROUP BY date(created_at)
        ORDER BY date ASC
      `).all(`-${days} days`) as any[];

      return {
        success: true,
        data: salesData.map(d => ({
          date: d.date,
          revenue: d.revenue / 100,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports-get-top-drugs', (_, limit: number) => {
    try {
      const topDrugs = db.prepare(`
        SELECT d.name_en as name, SUM(ii.quantity) as quantity_sold
        FROM invoice_items ii
        JOIN drugs d ON ii.drug_id = d.id
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.payment_status != 'CANCELLED'
        GROUP BY ii.drug_id
        ORDER BY quantity_sold DESC
        LIMIT ?
      `).all(limit) as any[];

      return { success: true, data: topDrugs };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==================== SETTINGS ====================
  ipcMain.handle('settings-get-all', () => {
    try {
      const settings = db.prepare('SELECT * FROM settings').all();
      const settingsObj: Record<string, string> = {};
      for (const s of settings as any[]) {
        settingsObj[s.key] = s.value;
      }
      return { success: true, data: settingsObj };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings-update', (_, key: string, value: string) => {
    try {
      const currentUser = store.get('currentUser') as any;
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);

      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `).run(currentUser?.id, 'UPDATE', 'setting', 0, JSON.stringify({ key, value }));

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

  // ==================== REPORTS (EXTENDED) ====================
  ipcMain.handle('reports-get-sales-report', (_, dateFrom: string, dateTo: string, grouping: 'day' | 'week' | 'month') => {
    try {
      let groupExpr;
      switch (grouping) {
        case 'week':
          groupExpr = "strftime('%Y-%W', created_at)";
          break;
        case 'month':
          groupExpr = "strftime('%Y-%m', created_at)";
          break;
        default:
          groupExpr = "date(created_at)";
      }

      const data = db.prepare(`
        SELECT ${groupExpr} as period, COALESCE(SUM(net_amount), 0) as amount
        FROM invoices
        WHERE date(created_at) BETWEEN ? AND ? AND payment_status != 'CANCELLED'
        GROUP BY ${groupExpr}
        ORDER BY period ASC
      `).all(dateFrom, dateTo) as any[];

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports-get-inventory-valuation', () => {
    try {
      const data = db.prepare(`
        SELECT d.category, 
               SUM(il.quantity) as total_qty,
               SUM(il.quantity * d.cost_price) as total_value
        FROM inventory_lots il
        JOIN drugs d ON il.drug_id = d.id
        WHERE il.quantity > 0 AND il.expiry_date >= date('now')
        GROUP BY d.category
        ORDER BY total_value DESC
      `).all() as any[];

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports-get-profit-loss', (_, dateFrom: string, dateTo: string) => {
    try {
      const data = db.prepare(`
        SELECT d.name_en as drug_name,
               SUM(ii.quantity) as qty_sold,
               SUM(ii.subtotal) as revenue,
               SUM(ii.quantity * d.cost_price) as cost,
               SUM(ii.subtotal - (ii.quantity * d.cost_price)) as profit
        FROM invoice_items ii
        JOIN drugs d ON ii.drug_id = d.id
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE date(i.created_at) BETWEEN ? AND ? AND i.payment_status != 'CANCELLED'
        GROUP BY ii.drug_id
        ORDER BY profit DESC
      `).all(dateFrom, dateTo) as any[];

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports-get-top-selling-drugs', (_, dateFrom: string, dateTo: string, limit: number) => {
    try {
      const data = db.prepare(`
        SELECT d.name_en as drug_name,
               SUM(ii.quantity) as quantity_sold
        FROM invoice_items ii
        JOIN drugs d ON ii.drug_id = d.id
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE date(i.created_at) BETWEEN ? AND ? AND i.payment_status != 'CANCELLED'
        GROUP BY ii.drug_id
        ORDER BY quantity_sold DESC
        LIMIT ?
      `).all(dateFrom, dateTo, limit) as any[];

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports-get-cashier-performance', (_, dateFrom: string, dateTo: string) => {
    try {
      const data = db.prepare(`
        SELECT u.full_name as cashier_name,
               COUNT(i.id) as invoice_count,
               SUM(i.net_amount) as total_sales
        FROM invoices i
        JOIN users u ON i.cashier_id = u.id
        WHERE date(i.created_at) BETWEEN ? AND ? AND i.payment_status != 'CANCELLED'
        GROUP BY i.cashier_id
        ORDER BY total_sales DESC
      `).all(dateFrom, dateTo) as any[];

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

  // ==================== PURCHASE ORDERS ====================
  ipcMain.handle('purchase-orders-get-all', (_, page = 1, limit = 25, filters = {}) => {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.status) {
        whereClause += ' AND po.status = ?';
        params.push(filters.status);
      }

      if (filters.supplier_id) {
        whereClause += ' AND po.supplier_id = ?';
        params.push(filters.supplier_id);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM purchase_orders po ${whereClause}`);
      const total = (countStmt.get(...params) as any).count;

      const selectStmt = db.prepare(`
        SELECT po.*, s.name as supplier_name, u.full_name as ordered_by_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.ordered_by = u.id
        ${whereClause}
        ORDER BY po.ordered_at DESC
        LIMIT ? OFFSET ?
      `);

      const orders = selectStmt.all(...params, limit, offset);

      return { success: true, data: orders, total, page, limit };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('purchase-orders-get-by-id', (_, id: number) => {
    try {
      const po = db.prepare(`
        SELECT po.*, s.name as supplier_name, u.full_name as ordered_by_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.ordered_by = u.id
        WHERE po.id = ?
      `).get(id) as any;

      if (!po) {
        return { success: false, error: 'Purchase order not found' };
      }

      const items = db.prepare(`
        SELECT poi.*, d.name_en as drug_name
        FROM purchase_order_items poi
        JOIN drugs d ON poi.drug_id = d.id
        WHERE poi.po_id = ?
      `).all(id);

      return { success: true, data: { ...po, items } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('purchase-orders-create', (_, poData: any) => {
    try {
      const currentUser = store.get('currentUser') as any;
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }

      const prefix = 'PO-';
      const timestamp = Date.now().toString(36).toUpperCase();
      const poNumber = `${prefix}${timestamp}`;

      let totalAmount = 0;
      for (const item of poData.items) {
        totalAmount += item.quantity_ordered * item.unit_cost;
      }

      db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, ordered_by, notes)
          VALUES (?, ?, 'PENDING', ?, ?, ?)
        `).run(poNumber, poData.supplier_id, totalAmount, currentUser.id, poData.notes || null);

        const insertItem = db.prepare(`
          INSERT INTO purchase_order_items (po_id, drug_id, quantity_ordered, unit_cost)
          VALUES (?, ?, ?, ?)
        `);

        for (const item of poData.items) {
          insertItem.run(result.lastInsertRowid, item.drug_id, item.quantity_ordered, item.unit_cost);
        }
      })();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('purchase-orders-receive', (_, id: number, userId: number) => {
    try {
      const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) as any;
      if (!po) {
        return { success: false, error: 'Purchase order not found' };
      }

      if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
        return { success: false, error: 'Cannot receive this purchase order' };
      }

      const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(id) as any[];

      db.transaction(() => {
        const today = new Date().toISOString().split('T')[0];

        for (const item of items) {
          // Create inventory lot
          const lotResult = db.prepare(`
            INSERT INTO inventory_lots (drug_id, lot_number, expiry_date, quantity, supplier_id, received_by)
            VALUES (?, ?, date(?, '+1 year'), ?, ?, ?)
          `).run(item.drug_id, `LOT-${Date.now()}-${item.drug_id}`, today, item.quantity_ordered, po.supplier_id, userId);

          // Create inventory transaction
          db.prepare(`
            INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type, quantity, performed_by, reference_id, reference_type)
            VALUES (?, ?, 'IN', ?, ?, ?, 'purchase_order')
          `).run(item.drug_id, lotResult.lastInsertRowid, item.quantity_ordered, userId, id);

          // Update PO item
          db.prepare(`
            UPDATE purchase_order_items SET quantity_received = quantity_ordered WHERE id = ?
          `).run(item.id);
        }

        // Update PO status
        db.prepare(`
          UPDATE purchase_orders SET status = 'RECEIVED', received_at = datetime('now') WHERE id = ?
        `).run(id);
      })();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
