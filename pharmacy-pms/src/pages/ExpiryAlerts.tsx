import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useInventory } from '../hooks/useInventory';
import { formatDate } from '../utils/formatDate';

export default function ExpiryAlerts() {
  const { getExpiryAlerts, disposeLot } = useInventory();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'expired' | 'urgent' | 'warning'>('all');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const result = await getExpiryAlerts();
      if (result.success) {
        setAlerts(result.data);
      }
    } catch (error) {
      console.error('Failed to load expiry alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDispose = async (lotId: number, drugName: string) => {
    if (!window.confirm(`Dispose expired lot for ${drugName}? This cannot be undone.`)) {
      return;
    }

    try {
      const result = await disposeLot(lotId);
      if (result.success) {
        toast.success('Lot disposed successfully');
        loadAlerts();
      } else {
        toast.error(result.error || 'Failed to dispose lot');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.urgency === filter;
  });

  const urgencyColors = {
    red: 'bg-red-100 text-red-800 border-red-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    green: 'bg-green-100 text-green-800 border-green-300',
  };

  const urgencyLabels = {
    red: 'Expired',
    orange: 'Urgent (<14 days)',
    yellow: 'Warning (<30 days)',
    green: 'OK',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expiry Alerts</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              filter === 'expired' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Expired ({alerts.filter(a => a.urgency === 'red').length})
          </button>
          <button
            onClick={() => setFilter('urgent')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              filter === 'urgent' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Urgent ({alerts.filter(a => a.urgency === 'orange').length})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              filter === 'warning' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Warning ({alerts.filter(a => a.urgency === 'yellow').length})
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">Expired Items</p>
          <p className="text-2xl font-bold text-red-700">{alerts.filter(a => a.urgency === 'red').length}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm text-orange-600 font-medium">Urgent (&lt;14 days)</p>
          <p className="text-2xl font-bold text-orange-700">{alerts.filter(a => a.urgency === 'orange').length}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-600 font-medium">Warning (&lt;30 days)</p>
          <p className="text-2xl font-bold text-yellow-700">{alerts.filter(a => a.urgency === 'yellow').length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-600 font-medium">Total at Risk</p>
          <p className="text-2xl font-bold text-green-700">{alerts.length}</p>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>No expiry alerts found</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drug</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAlerts.map((alert) => (
                <tr key={alert.lot_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{alert.drug_name}</p>
                    <p className="text-sm text-gray-500">{alert.drug_ar}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{alert.lot_number}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.urgency === 'red' ? 'bg-red-100 text-red-800' :
                      alert.urgency === 'orange' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {formatDate(alert.expiry_date)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{alert.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${urgencyColors[alert.urgency]}`}>
                      {urgencyLabels[alert.urgency]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {alert.urgency === 'red' && (
                      <button
                        onClick={() => handleDispose(alert.lot_id, alert.drug_name)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
                      >
                        Dispose
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
