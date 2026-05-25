import React, { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useReports } from '../hooks/useReports';
import { formatCurrency } from '../utils/formatCurrency';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function Reports() {
  const [reportType, setReportType] = useState<'sales' | 'inventory' | 'profit' | 'top-drugs' | 'performance'>('sales');
  const [dateFrom, setDateFrom] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [grouping, setGrouping] = useState<'day' | 'week' | 'month'>('day');
  
  const { getSalesReport, getInventoryValuation, getProfitLossReport, getTopDrugs, getCashierPerformance, isLoading } = useReports();
  const [reportData, setReportData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  const generateReport = async () => {
    try {
      let data;
      let sum;
      
      switch (reportType) {
        case 'sales':
          data = await getSalesReport(dateFrom, dateTo, grouping);
          sum = data.reduce((acc: number, item: any) => acc + item.total_amount, 0);
          break;
        case 'inventory':
          data = await getInventoryValuation();
          sum = data.reduce((acc: number, item: any) => acc + item.total_value, 0);
          break;
        case 'profit':
          data = await getProfitLossReport(dateFrom, dateTo);
          sum = data.reduce((acc: number, item: any) => acc + item.profit, 0);
          break;
        case 'top-drugs':
          data = await getTopDrugs(dateFrom, dateTo);
          sum = null;
          break;
        case 'performance':
          data = await getCashierPerformance(dateFrom, dateTo);
          sum = data.reduce((acc: number, item: any) => acc + item.total_sales, 0);
          break;
      }
      
      setReportData(data);
      setSummary(sum);
      toast.success('Report generated successfully');
    } catch (error: any) {
      toast.error(`Failed to generate report: ${error.message}`);
    }
  };

  const exportToCSV = () => {
    if (!reportData || reportData.length === 0) return;
    
    const headers = Object.keys(reportData[0]).join(',');
    const rows = reportData.map((row: any) => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported successfully');
  };

  const renderChart = () => {
    if (!reportData || reportData.length === 0) return null;

    if (reportType === 'sales' || reportType === 'performance') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={reportData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total_amount" stroke="#8884d8" name="Amount" />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (reportType === 'top-drugs') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={reportData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="drug_name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="quantity_sold" fill="#82ca9d" name="Quantity Sold" />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (reportType === 'profit') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={reportData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="drug_name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="profit" fill="#8884d8" name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <button
          onClick={exportToCSV}
          disabled={!reportData || reportData.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="sales">Sales Report</option>
              <option value="inventory">Inventory Valuation</option>
              <option value="profit">Profit & Loss</option>
              <option value="top-drugs">Top Selling Drugs</option>
              <option value="performance">Cashier Performance</option>
            </select>
          </div>

          {(reportType === 'sales' || reportType === 'profit' || reportType === 'performance') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {reportType === 'sales' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
              <select
                value={grouping}
                onChange={(e) => setGrouping(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary !== null && summary !== undefined && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-md p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Total</h3>
          <p className="text-3xl font-bold">{formatCurrency(summary / 100)}</p>
        </div>
      )}

      {/* Chart */}
      {renderChart()}

      {/* Data Table */}
      {reportData && reportData.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(reportData[0]).map((key) => (
                    <th
                      key={key}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((row: any, idx: number) => (
                  <tr key={idx}>
                    {Object.values(row).map((value: any, i: number) => (
                      <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {typeof value === 'number' && value > 100 && i === Object.keys(row).length - 1
                          ? formatCurrency(value / 100)
                          : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!reportData && (
        <div className="text-center py-12 text-gray-500">
          Select filters and click "Generate Report" to view data
        </div>
      )}
    </div>
  );
}