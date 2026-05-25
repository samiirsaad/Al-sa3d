import { contextBridge, ipcRenderer } from 'electron';

export type UserRole = 'admin' | 'pharmacist' | 'cashier' | 'inventory_manager' | 'reports_manager';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
}

export interface Drug {
  id: number;
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
  is_controlled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryLot {
  id: number;
  drug_id: number;
  lot_number: string;
  manufacture_date: string;
  expiry_date: string;
  quantity: number;
  received_date: string;
  supplier_id: number | null;
  received_by: number;
  notes: string | null;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  national_id: string | null;
  allergies: string | null;
  chronic_diseases: string | null;
  notes: string | null;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  cashier_id: number;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
  payment_status: 'PAID' | 'PENDING' | 'CANCELLED';
  notes: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  drug_id: number;
  lot_id: number;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  subtotal: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface DashboardStats {
  todayRevenue: number;
  todayInvoices: number;
  lowStockItems: number;
  expiringSoon: number;
}

export interface SalesData {
  date: string;
  revenue: number;
}

export interface TopDrug {
  name: string;
  quantity_sold: number;
}

export interface ExpiryAlert {
  drug_id: number;
  drug_name: string;
  lot_id: number;
  lot_number: string;
  expiry_date: string;
  quantity: number;
  urgency: 'red' | 'orange' | 'yellow' | 'green';
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (username: string, password: string) => 
    ipcRenderer.invoke('auth-login', username, password),
  logout: () => ipcRenderer.invoke('auth-logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth-get-current-user'),
  
  // Drugs
  getDrugs: (page: number, limit: number, filters?: any) => 
    ipcRenderer.invoke('drugs-get-all', page, limit, filters),
  getDrugById: (id: number) => ipcRenderer.invoke('drugs-get-by-id', id),
  createDrug: (drug: Omit<Drug, 'id' | 'created_at' | 'updated_at'>) => 
    ipcRenderer.invoke('drugs-create', drug),
  updateDrug: (id: number, drug: Partial<Drug>) => 
    ipcRenderer.invoke('drugs-update', id, drug),
  deleteDrug: (id: number) => ipcRenderer.invoke('drugs-delete', id),
  searchDrugs: (query: string) => ipcRenderer.invoke('drugs-search', query),
  
  // Inventory
  getInventoryLots: (drugId?: number) => 
    ipcRenderer.invoke('inventory-get-lots', drugId),
  addInventoryLot: (lot: Omit<InventoryLot, 'id'>) => 
    ipcRenderer.invoke('inventory-add-lot', lot),
  getExpiryAlerts: () => ipcRenderer.invoke('inventory-get-expiry-alerts'),
  disposeExpiredLot: (lotId: number, userId: number) => 
    ipcRenderer.invoke('inventory-dispose-lot', lotId, userId),
  
  // Invoices
  getInvoices: (page: number, limit: number, filters?: any) => 
    ipcRenderer.invoke('invoices-get-all', page, limit, filters),
  getInvoiceById: (id: number) => ipcRenderer.invoke('invoices-get-by-id', id),
  createInvoice: (invoice: {
    customer_id: number | null;
    items: Array<{
      drug_id: number;
      lot_id: number;
      quantity: number;
      unit_price: number;
      discount_pct: number;
    }>;
    discount_amount: number;
    tax_rate: number;
    payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
    notes?: string;
  }) => ipcRenderer.invoke('invoices-create', invoice),
  cancelInvoice: (id: number, userId: number) => 
    ipcRenderer.invoke('invoices-cancel', id, userId),
  
  // Customers
  getCustomers: (page: number, limit: number, search?: string) => 
    ipcRenderer.invoke('customers-get-all', page, limit, search),
  getCustomerById: (id: number) => ipcRenderer.invoke('customers-get-by-id', id),
  createCustomer: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => 
    ipcRenderer.invoke('customers-create', customer),
  updateCustomer: (id: number, customer: Partial<Customer>) => 
    ipcRenderer.invoke('customers-update', id, customer),
  
  // Suppliers
  getSuppliers: () => ipcRenderer.invoke('suppliers-get-all'),
  createSupplier: (supplier: Omit<Supplier, 'id'>) => 
    ipcRenderer.invoke('suppliers-create', supplier),
  updateSupplier: (id: number, supplier: Partial<Supplier>) => 
    ipcRenderer.invoke('suppliers-update', id, supplier),
  
  // Purchase Orders
  getPurchaseOrders: (page: number, limit: number, filters?: any) =>
    ipcRenderer.invoke('purchase-orders-get-all', page, limit, filters),
  getPurchaseOrderById: (id: number) =>
    ipcRenderer.invoke('purchase-orders-get-by-id', id),
  createPurchaseOrder: (po: any) =>
    ipcRenderer.invoke('purchase-orders-create', po),
  receivePurchaseOrder: (id: number, userId: number) =>
    ipcRenderer.invoke('purchase-orders-receive', id, userId),
  
  // Reports
  getDashboardStats: () => ipcRenderer.invoke('reports-get-dashboard-stats'),
  getSalesData: (days: number) => ipcRenderer.invoke('reports-get-sales-data', days),
  getTopDrugs: (limit: number) => ipcRenderer.invoke('reports-get-top-drugs', limit),
  getSalesReport: (dateFrom: string, dateTo: string, grouping: 'day' | 'week' | 'month') =>
    ipcRenderer.invoke('reports-get-sales-report', dateFrom, dateTo, grouping),
  getInventoryValuation: () => ipcRenderer.invoke('reports-get-inventory-valuation'),
  getProfitLossReport: (dateFrom: string, dateTo: string) =>
    ipcRenderer.invoke('reports-get-profit-loss', dateFrom, dateTo),
  getTopSellingDrugs: (dateFrom: string, dateTo: string, limit: number) =>
    ipcRenderer.invoke('reports-get-top-selling-drugs', dateFrom, dateTo, limit),
  getCashierPerformance: (dateFrom: string, dateTo: string) =>
    ipcRenderer.invoke('reports-get-cashier-performance', dateFrom, dateTo),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings-get-all'),
  updateSetting: (key: string, value: string) => 
    ipcRenderer.invoke('settings-update', key, value),
  
  // Database
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),
  
  // Settings store
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  
  // App control
  restartApp: () => ipcRenderer.invoke('app-restart'),
});
