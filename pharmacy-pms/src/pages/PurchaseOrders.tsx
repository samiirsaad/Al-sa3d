import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  status: 'PENDING' | 'SENT' | 'RECEIVED' | 'CANCELLED';
  total_amount: number;
  ordered_by: number;
  ordered_at: string;
  received_at: string | null;
  notes: string | null;
}

interface PurchaseOrderItem {
  drug_id: number;
  drug_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
}

export default function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [drugs, setDrugs] = useState<any[]>([]);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    supplier_id: '',
    items: [{ drug_id: '', quantity_ordered: 1, unit_cost: 0 }] as any[],
    notes: '',
  });

  const loadPurchaseOrders = async () => {
    try {
      const result = await window.electronAPI.getPurchaseOrders(1, 50, {});
      if (result.success) {
        setPurchaseOrders(result.data);
      } else {
        toast.error('Failed to load purchase orders');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const result = await window.electronAPI.getSuppliers();
      if (result.success) {
        setSuppliers(result.data);
      }
    } catch (error: any) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const loadDrugs = async () => {
    try {
      const result = await window.electronAPI.getDrugs(1, 100, {});
      if (result.success) {
        setDrugs(result.data);
      }
    } catch (error: any) {
      console.error('Failed to load drugs:', error);
    }
  };

  useEffect(() => {
    loadPurchaseOrders();
    loadSuppliers();
    loadDrugs();
  }, []);

  const handleOpenForm = () => {
    setFormData({
      supplier_id: suppliers[0]?.id?.toString() || '',
      items: [{ drug_id: drugs[0]?.id?.toString() || '', quantity_ordered: 1, unit_cost: 0 }],
      notes: '',
    });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedPO(null);
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { drug_id: '', quantity_ordered: 1, unit_cost: 0 }],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleCreate = async () => {
    try {
      if (!formData.supplier_id) {
        toast.error('Please select a supplier');
        return;
      }

      const poData = {
        supplier_id: parseInt(formData.supplier_id),
        items: formData.items.map((item: any) => ({
          drug_id: parseInt(item.drug_id),
          quantity_ordered: parseInt(item.quantity_ordered),
          unit_cost: Math.round(parseFloat(item.unit_cost) * 100),
        })),
        notes: formData.notes,
      };

      const result = await window.electronAPI.createPurchaseOrder(poData);
      if (result.success) {
        toast.success('Purchase order created successfully');
        handleCloseForm();
        loadPurchaseOrders();
      } else {
        toast.error(result.error);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReceive = async (id: number) => {
    if (!confirm('Mark this purchase order as received? This will add items to inventory.')) {
      return;
    }

    try {
      const result = await window.electronAPI.receivePurchaseOrder(id, user?.id);
      if (result.success) {
        toast.success('Purchase order received and inventory updated');
        loadPurchaseOrders();
      } else {
        toast.error(result.error);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'SENT': return 'bg-blue-100 text-blue-800';
      case 'RECEIVED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <button
          onClick={handleOpenForm}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          New Purchase Order
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl my-8">
            <h2 className="text-xl font-bold mb-4">New Purchase Order</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Items</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100"
                >
                  + Add Item
                </button>
              </div>
              
              {formData.items.map((item: any, index: number) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <select
                    value={item.drug_id}
                    onChange={(e) => updateItem(index, 'drug_id', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select Drug</option>
                    {drugs.map((d) => (
                      <option key={d.id} value={d.id}>{d.name_en}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity_ordered}
                    onChange={(e) => updateItem(index, 'quantity_ordered', e.target.value)}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    min="1"
                  />
                  <input
                    type="number"
                    placeholder="Cost"
                    value={item.unit_cost}
                    onChange={(e) => updateItem(index, 'unit_cost', e.target.value)}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    min="0"
                    step="0.01"
                  />
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={handleCloseForm}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Create PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{po.po_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{po.supplier_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(po.status)}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${(po.total_amount / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(po.ordered_at), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {po.status === 'PENDING' && (
                      <button
                        onClick={() => handleReceive(po.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Receive
                      </button>
                    )}
                    {po.status === 'SENT' && (
                      <button
                        onClick={() => handleReceive(po.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Mark Received
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {purchaseOrders.length === 0 && (
          <div className="text-center py-12 text-gray-500">No purchase orders found</div>
        )}
      </div>
    </div>
  );
}
