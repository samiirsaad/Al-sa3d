import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import SalesChart from '../components/SalesChart';
import InvoiceTable from '../components/InvoiceTable';
import ExpiryBadge from '../components/ExpiryBadge';
import { useReports } from '../hooks/useReports';
import { formatCurrency } from '../utils/formatCurrency';

export default function Dashboard() {
  const { getDashboardStats, getSalesByDay, getLowStockDrugs, getTopSellingDrugs } = useReports();
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayInvoices: 0,
    lowStockCount: 0,
    expiringSoonCount: 0,
  });
  const [salesData, setSalesData] = useState<any[]>([]);
  const [lowStockDrugs, setLowStockDrugs] = useState<any[]>([]);
  const [topDrugs, setTopDrugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsResult, salesResult, lowStockResult, topDrugsResult] = await Promise.all([
        getDashboardStats(),
        getSalesByDay(7),
        getLowStockDrugs(),
        getTopSellingDrugs(30),
      ]);

      if (statsResult.success) {
        setStats(statsResult.data);
      }
      if (salesResult.success) {
        setSalesData(salesResult.data);
      }
      if (lowStockResult.success) {
        setLowStockDrugs(lowStockResult.data.slice(0, 5));
      }
      if (topDrugsResult.success) {
        setTopDrugs(topDrugsResult.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue)}
          icon={
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          trend="+12.5%"
          trendUp={true}
        />
        <StatCard
          title="Invoices Today"
          value={stats.todayInvoices.toString()}
          icon={
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          trend="+8.2%"
          trendUp={true}
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockCount.toString()}
          icon={
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          trend={stats.lowStockCount > 0 ? 'Action needed' : 'All good'}
          trendUp={stats.lowStockCount === 0}
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiringSoonCount.toString()}
          icon={
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          trend={<ExpiryBadge count={stats.expiringSoonCount} />}
          trendUp={stats.expiringSoonCount === 0}
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Last 7 Days</h2>
          <SalesChart data={salesData} />
        </div>

        {/* Top Selling Drugs */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Drugs (30 days)</h2>
          <div className="space-y-4">
            {topDrugs.length > 0 ? (
              topDrugs.map((drug, index) => (
                <div key={drug.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center space-x-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{drug.name_en}</p>
                      <p className="text-sm text-gray-500">{drug.total_sold} units sold</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No sales data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Low Stock Alert</h2>
          <Link to="/inventory" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View All →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drug</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lowStockDrugs.length > 0 ? (
                lowStockDrugs.map((drug) => (
                  <tr key={drug.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{drug.name_en}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{drug.sku}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-medium ${drug.available_qty === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {drug.available_qty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{drug.min_qty}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        drug.available_qty === 0 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {drug.available_qty === 0 ? 'Critical' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    All items are well stocked
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
