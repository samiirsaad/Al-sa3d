import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDrugs } from '../hooks/useDrugs';
import { useInvoices } from '../hooks/useInvoices';
import { useCustomers } from '../hooks/useCustomers';
import { formatCurrency } from '../utils/formatCurrency';

interface CartItem {
  drug_id: number;
  lot_id: number;
  drug_name: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  subtotal: number;
  expiry_date: string;
}

export default function POS() {
  const navigate = useNavigate();
  const { searchDrugs } = useDrugs();
  const { createInvoice } = useInvoices();
  const { searchCustomers } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT'>('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        resetPOS();
      } else if (e.key === 'F12') {
        e.preventDefault();
        handleCompleteSale();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, amountTendered]);

  // Debounced drug search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        const result = await searchDrugs(searchQuery);
        if (result.success) {
          setSearchResults(result.data);
        }
      } else {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounced customer search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customerSearch.length >= 2) {
        const result = await searchCustomers(customerSearch);
        if (result.success) {
          setCustomerResults(result.data);
        }
      } else {
        setCustomerResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const addToCart = (drug: any) => {
    if (drug.available_qty <= 0) {
      toast.error('Out of stock');
      return;
    }

    const existingIndex = cart.findIndex(item => item.drug_id === drug.id);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      if (newCart[existingIndex].quantity < drug.available_qty) {
        newCart[existingIndex].quantity += 1;
        newCart[existingIndex].subtotal = calculateSubtotal(newCart[existingIndex]);
        setCart(newCart);
      } else {
        toast.error('Cannot add more - exceeds available stock');
      }
    } else {
      setCart([...cart, {
        drug_id: drug.id,
        lot_id: drug.lot_id || 1,
        drug_name: drug.name_en,
        quantity: 1,
        unit_price: drug.sell_price / 100,
        discount_pct: 0,
        subtotal: drug.sell_price / 100,
        expiry_date: drug.nearest_expiry || '',
      }]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const calculateSubtotal = (item: CartItem) => {
    return item.quantity * item.unit_price * (1 - item.discount_pct / 100);
  };

  const updateCartItem = (index: number, field: keyof CartItem, value: any) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price' || field === 'discount_pct') {
      newCart[index].subtotal = calculateSubtotal(newCart[index]);
    }
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const resetPOS = () => {
    setCart([]);
    setSearchQuery('');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setPaymentMethod('CASH');
    setAmountTendered('');
  };

  const totals = {
    subtotal: cart.reduce((sum, item) => sum + item.subtotal, 0),
    discount: 0,
    tax: 0,
    net: cart.reduce((sum, item) => sum + item.subtotal, 0),
  };

  const change = amountTendered ? Math.max(0, parseFloat(amountTendered) - totals.net) : 0;

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (paymentMethod !== 'CREDIT' && !amountTendered) {
      toast.error('Please enter amount tendered');
      return;
    }

    if (paymentMethod !== 'CREDIT' && parseFloat(amountTendered) < totals.net) {
      toast.error('Insufficient payment amount');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await createInvoice({
        customer_id: selectedCustomer?.id,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'CREDIT' ? 'PENDING' : 'PAID',
        items: cart.map(item => ({
          drug_id: item.drug_id,
          lot_id: item.lot_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_pct: item.discount_pct,
          subtotal: item.subtotal,
        })),
        discount_amount: totals.discount,
        tax_rate: 0,
      });

      if (result.success) {
        toast.success(`Sale completed! Invoice: ${result.invoiceNumber}`);
        resetPOS();
      } else {
        toast.error(result.error || 'Failed to complete sale');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left: Drug Search */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search drugs by name or barcode... (F1 for new invoice)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
            autoFocus
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden flex-1 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drug</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {searchResults.map((drug) => (
                  <tr key={drug.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => addToCart(drug)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{drug.name_en}</p>
                      <p className="text-sm text-gray-500">{drug.name_ar}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(drug.sell_price / 100)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        drug.available_qty === 0 ? 'bg-red-100 text-red-700' :
                        drug.available_qty <= drug.min_qty ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {drug.available_qty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => addToCart(drug)}
                        disabled={drug.available_qty === 0}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm transition"
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!searchResults.length && (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Type to search for drugs...</p>
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div className="w-96 bg-white rounded-xl shadow-md ml-4 flex flex-col overflow-hidden">
        {/* Customer Selection */}
        <div className="p-4 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Optional)</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {customerResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {customerResults.map((customer: any) => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setCustomerSearch(customer.name);
                      setCustomerResults([]);
                    }}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedCustomer && (
            <p className="mt-2 text-sm text-green-600">Selected: {selectedCustomer.name}</p>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Cart is empty</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div key={`${item.drug_id}-${index}`} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-gray-900 text-sm">{item.drug_name}</p>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateCartItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateCartItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Disc %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_pct}
                        onChange={(e) => updateCartItem(index, 'discount_pct', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-right font-medium text-gray-900">{formatCurrency(item.subtotal)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Payment */}
        <div className="border-t p-4 bg-gray-50">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-900">Total:</span>
              <span className="text-blue-600">{formatCurrency(totals.net)}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="TRANSFER">Bank Transfer</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>

          {paymentMethod !== 'CREDIT' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Tendered</label>
              <input
                type="number"
                step="0.01"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                placeholder="0.00"
              />
              {change > 0 && (
                <p className="mt-2 text-sm text-green-600">Change: {formatCurrency(change)}</p>
              )}
            </div>
          )}

          <button
            onClick={handleCompleteSale}
            disabled={isProcessing || cart.length === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-bold text-lg transition"
          >
            {isProcessing ? 'Processing...' : `Complete Sale (F12)`}
          </button>
        </div>
      </div>
    </div>
  );
}
