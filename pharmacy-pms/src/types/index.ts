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
  barcode: string | null;
  category: string | null;
  manufacturer: string | null;
  dosage_strength: string | null;
  dosage_unit: string | null;
  dosage_form: string | null;
  storage_temp: string | null;
  cost_price: number;
  sell_price: number;
  min_qty: number;
  max_qty: number;
  is_controlled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  available_qty?: number;
  nearest_expiry?: string;
}

export interface InventoryLot {
  id: number;
  drug_id: number;
  lot_number: string;
  manufacture_date: string | null;
  expiry_date: string;
  quantity: number;
  received_date: string;
  supplier_id: number | null;
  received_by: number | null;
  notes: string | null;
  drug_name?: string;
  supplier_name?: string;
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
  customer_name?: string;
  cashier_id: number;
  cashier_name?: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
  payment_status: 'PAID' | 'PENDING' | 'CANCELLED';
  notes: string | null;
  created_at: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  drug_id: number;
  drug_name?: string;
  lot_id: number;
  lot_number?: string;
  expiry_date?: string;
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
  drug_name_ar?: string;
  lot_id: number;
  lot_number: string;
  expiry_date: string;
  quantity: number;
  urgency: 'red' | 'orange' | 'yellow' | 'green';
}

export interface Settings {
  pharmacy_name: string;
  pharmacy_address: string;
  pharmacy_phone: string;
  tax_rate: string;
  invoice_prefix: string;
  low_stock_threshold: string;
}

export interface ElectronAPI {
  // Auth
  login: (username: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<{ success: boolean }>;
  getCurrentUser: () => Promise<User | null>;
  
  // Drugs
  getDrugs: (page: number, limit: number, filters?: any) => Promise<{ success: boolean; data?: Drug[]; total?: number; error?: string }>;
  getDrugById: (id: number) => Promise<{ success: boolean; data?: Drug; error?: string }>;
  createDrug: (drug: Omit<Drug, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; id?: number; error?: string }>;
  updateDrug: (id: number, drug: Partial<Drug>) => Promise<{ success: boolean; error?: string }>;
  deleteDrug: (id: number) => Promise<{ success: boolean; error?: string }>;
  searchDrugs: (query: string) => Promise<{ success: boolean; data?: Drug[]; error?: string }>;
  
  // Inventory
  getInventoryLots: (drugId?: number) => Promise<{ success: boolean; data?: InventoryLot[]; error?: string }>;
  addInventoryLot: (lot: Omit<InventoryLot, 'id'>) => Promise<{ success: boolean; id?: number; error?: string }>;
  getExpiryAlerts: () => Promise<{ success: boolean; data?: ExpiryAlert[]; error?: string }>;
  disposeExpiredLot: (lotId: number, userId: number) => Promise<{ success: boolean; error?: string }>;
  
  // Invoices
  getInvoices: (page: number, limit: number, filters?: any) => Promise<{ success: boolean; data?: Invoice[]; total?: number; error?: string }>;
  getInvoiceById: (id: number) => Promise<{ success: boolean; data?: Invoice; error?: string }>;
  createInvoice: (invoice: any) => Promise<{ success: boolean; invoiceId?: number; invoiceNumber?: string; netAmount?: number; error?: string }>;
  cancelInvoice: (id: number, userId: number) => Promise<{ success: boolean; error?: string }>;
  
  // Customers
  getCustomers: (page: number, limit: number, search?: string) => Promise<{ success: boolean; data?: Customer[]; total?: number; error?: string }>;
  getCustomerById: (id: number) => Promise<{ success: boolean; data?: Customer; error?: string }>;
  createCustomer: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; id?: number; error?: string }>;
  updateCustomer: (id: number, customer: Partial<Customer>) => Promise<{ success: boolean; error?: string }>;
  
  // Suppliers
  getSuppliers: () => Promise<{ success: boolean; data?: Supplier[]; error?: string }>;
  createSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<{ success: boolean; id?: number; error?: string }>;
  updateSupplier: (id: number, supplier: Partial<Supplier>) => Promise<{ success: boolean; error?: string }>;
  
  // Reports
  getDashboardStats: () => Promise<{ success: boolean; data?: DashboardStats; error?: string }>;
  getSalesData: (days: number) => Promise<{ success: boolean; data?: SalesData[]; error?: string }>;
  getTopDrugs: (limit: number) => Promise<{ success: boolean; data?: TopDrug[]; error?: string }>;
  
  // Settings
  getSettings: () => Promise<{ success: boolean; data?: Settings; error?: string }>;
  updateSetting: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;
  
  // Database
  backupDatabase: () => Promise<{ success: boolean; path?: string }>;
  restoreDatabase: () => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
