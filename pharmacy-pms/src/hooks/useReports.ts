import { useState } from 'react';

interface UseReportsResult {
  isLoading: boolean;
  getSalesReport: (dateFrom: string, dateTo: string, grouping: 'day' | 'week' | 'month') => Promise<any[]>;
  getInventoryValuation: () => Promise<any[]>;
  getProfitLossReport: (dateFrom: string, dateTo: string) => Promise<any[]>;
  getTopDrugs: (dateFrom: string, dateTo: string) => Promise<any[]>;
  getCashierPerformance: (dateFrom: string, dateTo: string) => Promise<any[]>;
}

export const useReports = (): UseReportsResult => {
  const [isLoading, setIsLoading] = useState(false);

  const getSalesReport = async (dateFrom: string, dateTo: string, grouping: 'day' | 'week' | 'month') => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getSalesReport(dateFrom, dateTo, grouping);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to get sales report');
    } finally {
      setIsLoading(false);
    }
  };

  const getInventoryValuation = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getInventoryValuation();
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to get inventory valuation');
    } finally {
      setIsLoading(false);
    }
  };

  const getProfitLossReport = async (dateFrom: string, dateTo: string) => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getProfitLossReport(dateFrom, dateTo);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to get profit/loss report');
    } finally {
      setIsLoading(false);
    }
  };

  const getTopDrugs = async (dateFrom: string, dateTo: string) => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getTopSellingDrugs(dateFrom, dateTo, 10);
      if (result.success) {
        return result.data.map((drug: any) => ({
          name: drug.drug_name,
          value: drug.quantity_sold,
        }));
      }
      throw new Error(result.error || 'Failed to get top drugs');
    } finally {
      setIsLoading(false);
    }
  };

  const getCashierPerformance = async (dateFrom: string, dateTo: string) => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getCashierPerformance(dateFrom, dateTo);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to get cashier performance');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    getSalesReport,
    getInventoryValuation,
    getProfitLossReport,
    getTopDrugs,
    getCashierPerformance,
  };
};
