import { Database } from 'better-sqlite3';

export function createInventoryQueries(db: Database) {
  const createLot = (lot: {
    drug_id: number;
    lot_number: string;
    manufacture_date: string;
    expiry_date: string;
    quantity: number;
    supplier_id?: number;
    received_by: number;
    notes?: string;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO inventory_lots (drug_id, lot_number, manufacture_date, expiry_date,
        quantity, received_date, supplier_id, received_by, notes)
      VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, ?)
    `);
    return stmt.run(
      lot.drug_id, lot.lot_number, lot.manufacture_date, lot.expiry_date,
      lot.quantity, lot.supplier_id || null, lot.received_by, lot.notes || null
    );
  };

  const getLotsByDrugId = (drugId: number) => {
    const stmt = db.prepare(`
      SELECT il.*, d.name_en as drug_name, s.name as supplier_name
      FROM inventory_lots il
      JOIN drugs d ON il.drug_id = d.id
      LEFT JOIN suppliers s ON il.supplier_id = s.id
      WHERE il.drug_id = ? AND il.quantity > 0
      ORDER BY il.expiry_date ASC
    `);
    return stmt.all(drugId) as any[];
  };

  const getExpiringLots = () => {
    const stmt = db.prepare(`
      SELECT il.*, d.name_en as drug_name, d.name_ar, d.sell_price, d.cost_price,
        CASE
          WHEN il.expiry_date < date('now') THEN 'expired'
          WHEN il.expiry_date <= date('now', '+14 days') THEN 'urgent'
          WHEN il.expiry_date <= date('now', '+30 days') THEN 'warning'
          ELSE 'ok'
        END as urgency
      FROM inventory_lots il
      JOIN drugs d ON il.drug_id = d.id
      WHERE il.quantity > 0 AND il.expiry_date <= date('now', '+30 days')
      ORDER BY il.expiry_date ASC
    `);
    return stmt.all() as any[];
  };

  const getAvailableQty = (drugId: number): number => {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as qty
      FROM inventory_lots
      WHERE drug_id = ? AND expiry_date > date('now') AND quantity > 0
    `);
    const result = stmt.get(drugId) as { qty: number };
    return result.qty;
  };

  // FIFO deduction - returns array of lots to deduct from
  const getLotsForFifoDeduction = (drugId: number, qtyNeeded: number) => {
    const stmt = db.prepare(`
      SELECT id, drug_id, lot_number, expiry_date, quantity
      FROM inventory_lots
      WHERE drug_id = ? AND expiry_date > date('now') AND quantity > 0
      ORDER BY expiry_date ASC, created_at ASC
    `);
    const lots = stmt.all(drugId) as any[];
    
    const toDeduct: { lot_id: number; quantity: number }[] = [];
    let remaining = qtyNeeded;

    for (const lot of lots) {
      if (remaining <= 0) break;
      const deductQty = Math.min(lot.quantity, remaining);
      toDeduct.push({ lot_id: lot.id, quantity: deductQty });
      remaining -= deductQty;
    }

    if (remaining > 0) {
      throw new Error(`Insufficient stock. Need ${qtyNeeded}, available ${qtyNeeded - remaining}`);
    }

    return toDeduct;
  };

  // Deduct from specific lot
  const deductFromLot = (lotId: number, quantity: number) => {
    const transaction = db.transaction(() => {
      const checkStmt = db.prepare('SELECT quantity FROM inventory_lots WHERE id = ?');
      const current = checkStmt.get(lotId) as { quantity: number };
      
      if (current.quantity < quantity) {
        throw new Error('Cannot deduct more than available quantity');
      }

      const updateStmt = db.prepare(`
        UPDATE inventory_lots SET quantity = quantity - ? WHERE id = ?
      `);
      updateStmt.run(quantity, lotId);
    });

    transaction();
  };

  const createTransaction = (tx: {
    drug_id: number;
    lot_id: number;
    transaction_type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'DISPOSAL';
    quantity: number;
    reference_id?: number;
    reference_type?: string;
    performed_by: number;
    notes?: string;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type,
        quantity, reference_id, reference_type, performed_by, created_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `);
    return stmt.run(
      tx.drug_id, tx.lot_id, tx.transaction_type, tx.quantity,
      tx.reference_id || null, tx.reference_type || null, tx.performed_by, tx.notes || null
    );
  };

  const getTransactionsByDrugId = (drugId: number) => {
    const stmt = db.prepare(`
      SELECT it.*, u.full_name as performed_by_name, il.lot_number
      FROM inventory_transactions it
      JOIN users u ON it.performed_by = u.id
      LEFT JOIN inventory_lots il ON it.lot_id = il.id
      WHERE it.drug_id = ?
      ORDER BY it.created_at DESC
      LIMIT 50
    `);
    return stmt.all(drugId) as any[];
  };

  const disposeExpiredLot = (lotId: number, performedBy: number, notes?: string) => {
    const transaction = db.transaction(() => {
      // Get lot info
      const lotStmt = db.prepare(`
        SELECT il.*, d.cost_price FROM inventory_lots il
        JOIN drugs d ON il.drug_id = d.id
        WHERE il.id = ?
      `);
      const lot = lotStmt.get(lotId) as any;

      if (!lot) throw new Error('Lot not found');
      if (lot.quantity <= 0) throw new Error('Lot already empty');

      const qtyToDispose = lot.quantity;

      // Create disposal transaction
      const txStmt = db.prepare(`
        INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type,
          quantity, performed_by, notes, created_at)
        VALUES (?, ?, 'DISPOSAL', ?, ?, ?, datetime('now'))
      `);
      txStmt.run(lot.drug_id, lotId, qtyToDispose, performedBy, notes || 'Expired drug disposal');

      // Set quantity to 0
      const updateStmt = db.prepare('UPDATE inventory_lots SET quantity = 0 WHERE id = ?');
      updateStmt.run(lotId);

      return { disposed_qty: qtyToDispose, cost_loss: qtyToDispose * (lot.cost_price / 100) };
    });

    return transaction();
  };

  const adjustQuantity = (lotId: number, adjustment: number, performedBy: number, notes?: string) => {
    const transaction = db.transaction(() => {
      const checkStmt = db.prepare('SELECT quantity, drug_id FROM inventory_lots WHERE id = ?');
      const current = checkStmt.get(lotId) as { quantity: number; drug_id: number };
      
      const newQty = current.quantity + adjustment;
      if (newQty < 0) {
        throw new Error('Adjustment would result in negative quantity');
      }

      const txType = adjustment > 0 ? 'IN' : 'OUT';
      
      // Create transaction
      const txStmt = db.prepare(`
        INSERT INTO inventory_transactions (drug_id, lot_id, transaction_type,
          quantity, performed_by, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      txStmt.run(current.drug_id, lotId, txType, Math.abs(adjustment), performedBy, notes || 'Manual adjustment');

      // Update quantity
      const updateStmt = db.prepare('UPDATE inventory_lots SET quantity = ? WHERE id = ?');
      updateStmt.run(newQty, lotId);
    });

    return transaction();
  };

  return {
    createLot, getLotsByDrugId, getExpiringLots, getAvailableQty,
    getLotsForFifoDeduction, deductFromLot, createTransaction,
    getTransactionsByDrugId, disposeExpiredLot, adjustQuantity
  };
}
