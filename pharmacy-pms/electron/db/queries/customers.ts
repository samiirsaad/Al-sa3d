import { Database } from 'better-sqlite3';

export function createCustomerQueries(db: Database) {
  const createCustomer = (customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    national_id?: string;
    allergies?: string;
    chronic_diseases?: string;
    notes?: string;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO customers (name, phone, email, address, national_id,
        allergies, chronic_diseases, notes, loyalty_points, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `);
    return stmt.run(
      customer.name, customer.phone, customer.email || null,
      customer.address || null, customer.national_id || null,
      customer.allergies || null, customer.chronic_diseases || null,
      customer.notes || null
    );
  };

  const getCustomerById = (id: number) => {
    const stmt = db.prepare('SELECT * FROM customers WHERE id = ?');
    return stmt.get(id) as any;
  };

  const getCustomerByPhone = (phone: string) => {
    const stmt = db.prepare('SELECT * FROM customers WHERE phone = ?');
    return stmt.get(phone) as any;
  };

  const getAllCustomers = (search?: string) => {
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ` AND (name LIKE ? OR phone LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY name ASC';

    const stmt = db.prepare(query);
    return stmt.all(...params) as any[];
  };

  const updateCustomer = (id: number, updates: Partial<{
    name: string; phone: string; email: string; address: string;
    national_id: string; allergies: string; chronic_diseases: string;
    notes: string; loyalty_points: number;
  }>) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    const stmt = db.prepare(`
      UPDATE customers SET ${fields}, updated_at = datetime('now')
      WHERE id = ?
    `);
    return stmt.run(...values, id);
  };

  const deleteCustomer = (id: number) => {
    const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
    return stmt.run(id);
  };

  const getCustomerPurchaseHistory = (customerId: number) => {
    const stmt = db.prepare(`
      SELECT i.*, COUNT(ii.id) as item_count
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE i.customer_id = ? AND i.payment_status != 'CANCELLED'
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT 20
    `);
    return stmt.all(customerId) as any[];
  };

  const addLoyaltyPoints = (customerId: number, points: number) => {
    const stmt = db.prepare(`
      UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    return stmt.run(points, customerId);
  };

  return {
    createCustomer, getCustomerById, getCustomerByPhone, getAllCustomers,
    updateCustomer, deleteCustomer, getCustomerPurchaseHistory, addLoyaltyPoints
  };
}
