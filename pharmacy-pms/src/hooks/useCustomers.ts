import { useState, useEffect, useCallback } from 'react';
import { Customer } from '../types';

interface UseCustomersResult {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  loadCustomers: (page?: number, search?: string) => Promise<void>;
}

export const useCustomers = (limit = 25): UseCustomersResult => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadCustomers = useCallback(async (pageNum = 1, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getCustomers(pageNum, limit, search);
      if (result.success && result.data) {
        setCustomers(result.data);
        setTotal(result.total || 0);
        setPage(pageNum);
      } else {
        setError(result.error || 'Failed to load customers');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadCustomers(1);
  }, [loadCustomers]);

  const totalPages = Math.ceil(total / limit);

  return {
    customers,
    loading,
    error,
    total,
    page,
    totalPages,
    loadCustomers,
  };
};
