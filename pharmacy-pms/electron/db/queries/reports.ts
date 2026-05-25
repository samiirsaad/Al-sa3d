import { Database } from 'better-sqlite3';

export function createReportQueries(db: Database) {
  const getSalesReport = (dateFrom: string, dateTo: string, groupBy: 'day' | 'week' | 'month') => {
    let dateField: string;
    if (groupBy === 'day') {
      dateField = "date(created_at)";
    } else if (groupBy === 'week') {
      dateField = "strftime('%Y-%W', created_at)";
    } else {
      dateField = "strftime('%Y-%m', created_at)";
    }

    const stmt = db.prepare(`
      SELECT ${dateField} as period,
        COUNT(*) as invoice_count,
        COALESCE(SUM(total_amount), 0) as gross_sales,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(tax_amount), 0) as total_tax,
        COALESCE(SUM(net_amount), 0) as net_sales
      FROM invoices
      WHERE date(created_at) BETWEEN ? AND ?
        AND payment_status != 'CANCELLED'
      GROUP BY ${dateField}
      ORDER BY ${dateField} ASC
    `);

    return stmt.all(dateFrom, dateTo) as any[];
  };

  const getInventoryValuation = () => {
    const stmt = db.prepare(`
      SELECT d.id, d.name_en, d.name_ar, d.sku,
        SUM(il.quantity) as total_qty,
        d.cost_price, d.sell_price,
        SUM(il.quantity * d.cost_price) / 100 as cost_value,
        SUM(il.quantity * d.sell_price) / 100 as retail_value
      FROM drugs d
      LEFT JOIN inventory_lots il ON d.id = il.drug_id AND il.quantity > 0
      WHERE d.is_active = 1
      GROUP BY d.id
      HAVING total_qty > 0
      ORDER BY cost_value DESC
    `);

    return stmt.all() as any[];
  };

  const getProfitLossReport = (dateFrom: string, dateTo: string) => {
    const stmt = db.prepare(`
      SELECT 
        SUM(ii.subtotal) / 100 as total_revenue,
        SUM(ii.quantity * d.cost_price) / 100 as total_cost,
        (SUM(ii.subtotal) - SUM(ii.quantity * d.cost_price)) / 100 as gross_profit,
        ROUND(((SUM(ii.subtotal) - SUM(ii.quantity * d.cost_price)) * 100.0 / NULLIF(SUM(ii.subtotal), 0)), 2) as profit_margin_pct
      FROM invoice_items ii
      JOIN drugs d ON ii.drug_id = d.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE date(i.created_at) BETWEEN ? AND ?
        AND i.payment_status != 'CANCELLED'
    `);

    return stmt.get(dateFrom, dateTo) as any;
  };

  const getTopDrugsReport = (dateFrom: string, dateTo: string, limit: number = 10) => {
    const stmt = db.prepare(`
      SELECT d.id, d.name_en, d.name_ar, d.sku,
        SUM(ii.quantity) as units_sold,
        SUM(ii.subtotal) / 100 as revenue,
        SUM(ii.quantity * d.cost_price) / 100 as cost,
        (SUM(ii.subtotal) - SUM(ii.quantity * d.cost_price)) / 100 as profit
      FROM invoice_items ii
      JOIN drugs d ON ii.drug_id = d.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE date(i.created_at) BETWEEN ? AND ?
        AND i.payment_status != 'CANCELLED'
      GROUP BY d.id
      ORDER BY units_sold DESC
      LIMIT ?
    `);

    return stmt.all(dateFrom, dateTo, limit) as any[];
  };

  const getCashierPerformance = (dateFrom: string, dateTo: string) => {
    const stmt = db.prepare(`
      SELECT u.id, u.full_name,
        COUNT(i.id) as invoice_count,
        COALESCE(SUM(i.net_amount), 0) / 100 as total_sales,
        COALESCE(AVG(i.net_amount), 0) / 100 as avg_transaction
      FROM users u
      LEFT JOIN invoices i ON u.id = i.cashier_id
        AND date(i.created_at) BETWEEN ? AND ?
        AND i.payment_status != 'CANCELLED'
      WHERE u.role IN ('cashier', 'pharmacist', 'admin')
      GROUP BY u.id
      ORDER BY total_sales DESC
    `);

    return stmt.all(dateFrom, dateTo) as any[];
  };

  const getCategorySales = (dateFrom: string, dateTo: string) => {
    const stmt = db.prepare(`
      SELECT d.category,
        SUM(ii.quantity) as units_sold,
        SUM(ii.subtotal) / 100 as revenue
      FROM invoice_items ii
      JOIN drugs d ON ii.drug_id = d.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE date(i.created_at) BETWEEN ? AND ?
        AND i.payment_status != 'CANCELLED'
      GROUP BY d.category
      ORDER BY revenue DESC
    `);

    return stmt.all(dateFrom, dateTo) as any[];
  };

  const getDisposalReport = (dateFrom: string, dateTo: string) => {
    const stmt = db.prepare(`
      SELECT it.*, d.name_en as drug_name, d.name_ar,
        (it.quantity * d.cost_price) / 100 as financial_loss
      FROM inventory_transactions it
      JOIN drugs d ON it.drug_id = d.id
      WHERE it.transaction_type = 'DISPOSAL'
        AND date(it.created_at) BETWEEN ? AND ?
      ORDER BY it.created_at DESC
    `);

    return stmt.all(dateFrom, dateTo) as any[];
  };

  const getLowStockReport = () => {
    const stmt = db.prepare(`
      SELECT d.id, d.name_en, d.name_ar, d.sku, d.min_qty, d.max_qty,
        COALESCE(SUM(CASE WHEN il.expiry_date > date('now') THEN il.quantity ELSE 0 END), 0) as available_qty,
        CASE
          WHEN available_qty = 0 THEN 'critical'
          WHEN available_qty <= d.min_qty THEN 'low'
          ELSE 'ok'
        END as status
      FROM drugs d
      LEFT JOIN inventory_lots il ON d.id = il.drug_id AND il.quantity > 0
      WHERE d.is_active = 1
      GROUP BY d.id
      HAVING available_qty <= d.min_qty
      ORDER BY available_qty ASC
    `);

    return stmt.all() as any[];
  };

  return {
    getSalesReport, getInventoryValuation, getProfitLossReport,
    getTopDrugsReport, getCashierPerformance, getCategorySales,
    getDisposalReport, getLowStockReport
  };
}
