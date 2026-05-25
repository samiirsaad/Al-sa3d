import { useState, useEffect, useCallback } from 'react';
import { Invoice } from '../types';

interface UseInvoicesResult {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  loadInvoices: (page?: number, filters?: any) => Promise<void>;
  getInvoiceById: (id: number) => Promise<Invoice | null>;
}

export const useInvoices = (limit = 25): UseInvoicesResult => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadInvoices = useCallback(async (pageNum = 1, filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getInvoices(pageNum, limit, filters);
      if (result.success && result.data) {
        setInvoices(result.data);
        setTotal(result.total || 0);
        setPage(pageNum);
      } else {
        setError(result.error || 'Failed to load invoices');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const getInvoiceById = useCallback(async (id: number): Promise<Invoice | null> => {
    try {
      const result = await window.electronAPI.getInvoiceById(id);
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    loadInvoices(1);
  }, [loadInvoices]);

  const totalPages = Math.ceil(total / limit);

  return {
    invoices,
    loading,
    error,
    total,
    page,
    totalPages,
    loadInvoices,
    getInvoiceById,
  };
};
