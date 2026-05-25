import { Database } from 'better-sqlite3';

export function createDrugQueries(db: Database) {
  const createDrug = (drug: {
    name_ar: string;
    name_en: string;
    sku: string;
    barcode: string;
    category: string;
    manufacturer: string;
    dosage_strength: string;
    dosage_unit: string;
    dosage_form: string;
    storage_temp: string;
    cost_price: number;
    sell_price: number;
    min_qty: number;
    max_qty: number;
    is_controlled: number;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO drugs (name_ar, name_en, sku, barcode, category, manufacturer,
        dosage_strength, dosage_unit, dosage_form, storage_temp,
        cost_price, sell_price, min_qty, max_qty, is_controlled, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
    return stmt.run(
      drug.name_ar, drug.name_en, drug.sku, drug.barcode, drug.category, drug.manufacturer,
      drug.dosage_strength, drug.dosage_unit, drug.dosage_form, drug.storage_temp,
      Math.round(drug.cost_price * 100), Math.round(drug.sell_price * 100),
      drug.min_qty, drug.max_qty, drug.is_controlled
    );
  };

  const getDrugById = (id: number) => {
    const stmt = db.prepare('SELECT * FROM drugs WHERE id = ?');
    return stmt.get(id) as any;
  };

  const getDrugByBarcode = (barcode: string) => {
    const stmt = db.prepare('SELECT * FROM drugs WHERE barcode = ? AND is_active = 1');
    return stmt.get(barcode) as any;
  };

  const getAllDrugs = (search?: string, category?: string, status?: string) => {
    let query = `
      SELECT d.*, 
        COALESCE(SUM(CASE WHEN il.expiry_date > date('now') THEN il.quantity ELSE 0 END), 0) as available_qty,
        MIN(il.expiry_date) as nearest_expiry
      FROM drugs d
      LEFT JOIN inventory_lots il ON d.id = il.drug_id AND il.quantity > 0
      WHERE d.is_active = 1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (d.name_en LIKE ? OR d.name_ar LIKE ? OR d.sku LIKE ? OR d.barcode LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      query += ` AND d.category = ?`;
      params.push(category);
    }

    if (status === 'low') {
      query += ` HAVING available_qty <= d.min_qty AND available_qty > 0`;
    } else if (status === 'critical') {
      query += ` HAVING available_qty = 0`;
    } else if (status === 'ok') {
      query += ` HAVING available_qty > d.min_qty`;
    }

    query += ` GROUP BY d.id ORDER BY d.name_en`;

    const stmt = db.prepare(query);
    return stmt.all(...params) as any[];
  };

  const updateDrug = (id: number, updates: Partial<{
    name_ar: string; name_en: string; sku: string; barcode: string;
    category: string; manufacturer: string; dosage_strength: string;
    dosage_unit: string; dosage_form: string; storage_temp: string;
    cost_price: number; sell_price: number; min_qty: number; max_qty: number;
    is_controlled: number;
  }>) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates).map(v => 
      (k: string) => (k === 'cost_price' || k === 'sell_price') ? Math.round((v as number) * 100) : v
    );
    const stmt = db.prepare(`UPDATE drugs SET ${fields}, updated_at = datetime('now') WHERE id = ?`);
    return stmt.run(...Object.values(updates).map((v, i) => {
      const key = Object.keys(updates)[i];
      if (key === 'cost_price' || key === 'sell_price') return Math.round((v as number) * 100);
      return v;
    }), id);
  };

  const deleteDrug = (id: number) => {
    const stmt = db.prepare('UPDATE drugs SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?');
    return stmt.run(id);
  };

  const getLowStockDrugs = () => {
    const stmt = db.prepare(`
      SELECT d.*, 
        COALESCE(SUM(CASE WHEN il.expiry_date > date('now') THEN il.quantity ELSE 0 END), 0) as available_qty
      FROM drugs d
      LEFT JOIN inventory_lots il ON d.id = il.drug_id AND il.quantity > 0
      WHERE d.is_active = 1
      GROUP BY d.id
      HAVING available_qty <= d.min_qty
      ORDER BY available_qty ASC
    `);
    return stmt.all() as any[];
  };

  const getTopSellingDrugs = (days: number = 30) => {
    const stmt = db.prepare(`
      SELECT d.id, d.name_en, d.name_ar, SUM(ii.quantity) as total_sold
      FROM invoice_items ii
      JOIN drugs d ON ii.drug_id = d.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.created_at >= datetime('now', '-' || ? || ' days')
        AND i.payment_status != 'CANCELLED'
      GROUP BY d.id
      ORDER BY total_sold DESC
      LIMIT 5
    `);
    return stmt.all(days) as any[];
  };

  return {
    createDrug, getDrugById, getDrugByBarcode, getAllDrugs, updateDrug, deleteDrug,
    getLowStockDrugs, getTopSellingDrugs
  };
}
