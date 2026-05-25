import { Database } from 'better-sqlite3';

export function createInvoiceQueries(db: Database) {
  const generateInvoiceNumber = (prefix: string = 'INV'): string => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const stmt = db.prepare(`
      SELECT invoice_number FROM invoices 
      WHERE invoice_number LIKE ? 
      ORDER BY invoice_number DESC 
      LIMIT 1
    `);
    const last = stmt.get(`${prefix}-${today}`) as { invoice_number: string } | undefined;
    
    if (!last) {
      return `${prefix}-${today}-0001`;
    }
    
    const match = last.invoice_number.match(/-(\d+)$/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `${prefix}-${today}-${String(nextNum).padStart(4, '0')}`;
    }
    
    return `${prefix}-${today}-0001`;
  };

  const createInvoice = (invoice: {
    customer_id?: number;
    cashier_id: number;
    total_amount: number;
    discount_amount: number;
    tax_amount: number;
    net_amount: number;
    payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
    payment_status: 'PAID' | 'PENDING' | 'CANCELLED';
    notes?: string;
    items: Array<{
      drug_id: number;
      lot_id: number;
      quantity: number;
      unit_price: number;
      discount_pct: number;
      subtotal: number;
    }>;
  }) => {
    const transaction = db.transaction(() => {
      const invoiceNumber = generateInvoiceNumber();

      // Insert invoice
      const invStmt = db.prepare(`
        INSERT INTO invoices (invoice_number, customer_id, cashier_id,
          total_amount, discount_amount, tax_amount, net_amount,
          payment_method, payment_status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      
      const invResult = invStmt.run(
        invoiceNumber,
        invoice.customer_id || null,
        invoice.cashier_id,
        Math.round(invoice.total_amount * 100),
        Math.round(invoice.discount_amount * 100),
        Math.round(invoice.tax_amount * 100),
        Math.round(invoice.net_amount * 100),
        invoice.payment_method,
        invoice.payment_status,
        invoice.notes || null
      );

      const invoiceId = invResult.lastInsertRowid as number;

      // Insert invoice items
      const itemStmt = db.prepare(`
        INSERT INTO invoice_items (invoice_id, drug_id, lot_id,
          quantity, unit_price, discount_pct, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of invoice.items) {
        itemStmt.run(
          invoiceId,
          item.drug_id,
          item.lot_id,
          item.quantity,
          Math.round(item.unit_price * 100),
          item.discount_pct,
          Math.round(item.subtotal * 100)
        );

        // Create inventory transaction (OUT)
        const txStmt = db.prepare(`
          INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type,
            quantity, reference_id, reference_type, performed_by, created_at)
          VALUES (?, ?, 'OUT', ?, ?, 'invoice', ?, datetime('now'))
        `);
        txStmt.run(item.drug_id, item.lot_id, item.quantity, invoiceId, invoice.cashier_id);
      }

      return { invoiceId, invoiceNumber };
    });

    return transaction();
  };

  const getInvoiceById = (id: number) => {
    const stmt = db.prepare(`
      SELECT i.*, u.full_name as cashier_name, c.name as customer_name
      FROM invoices i
      LEFT JOIN users u ON i.cashier_id = u.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `);
    return stmt.get(id) as any;
  };

  const getInvoiceItems = (invoiceId: number) => {
    const stmt = db.prepare(`
      SELECT ii.*, d.name_en as drug_name, d.name_ar, il.lot_number, il.expiry_date
      FROM invoice_items ii
      JOIN drugs d ON ii.drug_id = d.id
      JOIN inventory_lots il ON ii.lot_id = il.id
      WHERE ii.invoice_id = ?
    `);
    return stmt.all(invoiceId) as any[];
  };

  const getAllInvoices = (filters?: {
    date_from?: string;
    date_to?: string;
    status?: string;
    payment_method?: string;
    cashier_id?: number;
  }) => {
    let query = `
      SELECT i.*, u.full_name as cashier_name, c.name as customer_name
      FROM invoices i
      LEFT JOIN users u ON i.cashier_id = u.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.date_from) {
      query += ` AND date(i.created_at) >= ?`;
      params.push(filters.date_from);
    }

    if (filters?.date_to) {
      query += ` AND date(i.created_at) <= ?`;
      params.push(filters.date_to);
    }

    if (filters?.status) {
      query += ` AND i.payment_status = ?`;
      params.push(filters.status);
    }

    if (filters?.payment_method) {
      query += ` AND i.payment_method = ?`;
      params.push(filters.payment_method);
    }

    if (filters?.cashier_id) {
      query += ` AND i.cashier_id = ?`;
      params.push(filters.cashier_id);
    }

    query += ` ORDER BY i.created_at DESC`;

    const stmt = db.prepare(query);
    return stmt.all(...params) as any[];
  };

  const cancelInvoice = (invoiceId: number, cancelledBy: number) => {
    const transaction = db.transaction(() => {
      // Get invoice to check status
      const invStmt = db.prepare('SELECT payment_status FROM invoices WHERE id = ?');
      const invoice = invStmt.get(invoiceId) as { payment_status: string };

      if (!invoice) throw new Error('Invoice not found');
      if (invoice.payment_status === 'CANCELLED') {
        throw new Error('Invoice already cancelled');
      }

      // Get all items
      const itemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
      const items = itemsStmt.all(invoiceId) as any[];

      // Restore inventory quantities
      for (const item of items) {
        const restoreStmt = db.prepare(`
          UPDATE inventory_lots SET quantity = quantity + ? WHERE id = ?
        `);
        restoreStmt.run(item.quantity, item.lot_id);

        // Create reverse transaction
        const txStmt = db.prepare(`
          INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type,
            quantity, reference_id, reference_type, performed_by, notes, created_at)
          VALUES (?, ?, 'OUT', ?, ?, 'invoice_cancel', ?, 'Cancelled invoice restoration', datetime('now'))
        `);
        // Note: We use negative quantity to indicate restoration
        txStmt.run(item.drug_id, item.lot_id, -item.quantity, invoiceId, cancelledBy);
      }

      // Update invoice status
      const updateStmt = db.prepare(`
        UPDATE invoices SET payment_status = 'CANCELLED', updated_at = datetime('now')
        WHERE id = ?
      `);
      updateStmt.run(invoiceId);

      return true;
    });

    return transaction();
  };

  const getTodayRevenue = () => {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(net_amount), 0) as revenue
      FROM invoices
      WHERE date(created_at) = date('now') AND payment_status != 'CANCELLED'
    `);
    const result = stmt.get() as { revenue: number };
    return result.revenue / 100;
  };

  const getTodayInvoiceCount = () => {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM invoices
      WHERE date(created_at) = date('now') AND payment_status != 'CANCELLED'
    `);
    const result = stmt.get() as { count: number };
    return result.count;
  };

  const getSalesByDay = (days: number = 7) => {
    const stmt = db.prepare(`
      SELECT date(created_at) as day, 
        COALESCE(SUM(net_amount), 0) as total,
        COUNT(*) as count
      FROM invoices
      WHERE created_at >= datetime('now', '-' || ? || ' days')
        AND payment_status != 'CANCELLED'
      GROUP BY date(created_at)
      ORDER BY day ASC
    `);
    return stmt.all(days) as any[];
  };

  return {
    createInvoice, getInvoiceById, getInvoiceItems, getAllInvoices,
    cancelInvoice, getTodayRevenue, getTodayInvoiceCount, getSalesByDay
  };
}
