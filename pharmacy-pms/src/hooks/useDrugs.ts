import { useState, useEffect, useCallback } from 'react';
import { Drug } from '../types';

interface UseDrugsResult {
  drugs: Drug[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  loadDrugs: (page?: number, filters?: any) => Promise<void>;
  searchDrugs: (query: string) => Promise<Drug[]>;
}

export const useDrugs = (limit = 25): UseDrugsResult => {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadDrugs = useCallback(async (pageNum = 1, filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getDrugs(pageNum, limit, filters);
      if (result.success && result.data) {
        setDrugs(result.data);
        setTotal(result.total || 0);
        setPage(pageNum);
      } else {
        setError(result.error || 'Failed to load drugs');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const searchDrugs = useCallback(async (query: string): Promise<Drug[]> => {
    try {
      const result = await window.electronAPI.searchDrugs(query);
      if (result.success && result.data) {
        return result.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    loadDrugs(1);
  }, [loadDrugs]);

  const totalPages = Math.ceil(total / limit);

  return {
    drugs,
    loading,
    error,
    total,
    page,
    totalPages,
    loadDrugs,
    searchDrugs,
  };
};
