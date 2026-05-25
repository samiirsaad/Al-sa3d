import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useInvoices } from '../hooks/useInvoices';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate } from '../utils/formatDate';
import { useAuthStore } from '../store/authStore';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getInvoiceById, cancelInvoice } = useInvoices();
  const { user } = useAuthStore();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    if (!id) return;
    try {
      const result = await getInvoiceById(parseInt(id));
      if (result.success) {
        setInvoice(result.data);
        setItems(result.data.items || []);
      } else {
        toast.error('Invoice not found');
        navigate('/invoices');
      }
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this invoice? This will restore the inventory.')) {
      return;
    }

    try {
      const result = await cancelInvoice(parseInt(id!));
      if (result.success) {
        toast.success('Invoice cancelled successfully');
        loadInvoice();
      } else {
        toast.error(result.error || 'Failed to cancel invoice');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/invoices')} className="text-gray-600 hover:text-gray-800">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Invoice #{invoice.invoice_number}</h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print</span>
          </button>
          {user?.role === 'admin' && invoice.payment_status !== 'CANCELLED' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
            >
              Cancel Invoice
            </button>
          )}
        </div>
      </div>

      {/* Invoice Content */}
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* Invoice Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b">
          <div>
            <p className="text-sm text-gray-500">Invoice Number</p>
            <p className="font-semibold text-gray-900">{invoice.invoice_number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-semibold text-gray-900">{formatDate(invoice.created_at)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Customer</p>
            <p className="font-semibold text-gray-900">{invoice.customer_name || 'Walk-in Customer'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              invoice.payment_status === 'PAID' ? 'bg-green-100 text-green-700' :
              invoice.payment_status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {invoice.payment_status}
            </span>
          </div>
        </div>

        {/* Items Table */}
        <table className="min-w-full divide-y divide-gray-200 mb-6">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disc %</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                <td className="px-4 py-3 text-sm">
                  <p className="font-medium text-gray-900">{item.drug_name}</p>
                  <p className="text-xs text-gray-500">Lot: {item.lot_number}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(item.unit_price / 100)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{item.discount_pct}%</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(item.subtotal / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-medium">{formatCurrency(invoice.total_amount / 100)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount:</span>
              <span className="font-medium">{formatCurrency(invoice.discount_amount / 100)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">{formatCurrency(invoice.tax_amount / 100)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span className="text-gray-900">Net Amount:</span>
              <span className="text-blue-600">{formatCurrency(invoice.net_amount / 100)}</span>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Payment Method</p>
            <p className="font-medium text-gray-900">{invoice.payment_method}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Cashier</p>
            <p className="font-medium text-gray-900">{invoice.cashier_name}</p>
          </div>
          {invoice.notes && (
            <div className="col-span-2">
              <p className="text-sm text-gray-500">Notes</p>
              <p className="font-medium text-gray-900">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
