import React, { useState } from 'react';
import { Drug } from '../types';
import { formatCurrencySimple } from '../utils/formatCurrency';
import { getExpiryUrgency, getUrgencyBadgeClass } from '../utils/expiryLogic';

interface DrugTableProps {
  drugs: Drug[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit?: (drug: Drug) => void;
  hideCostPrice?: boolean;
}

export const DrugTable: React.FC<DrugTableProps> = ({
  drugs,
  loading,
  page,
  totalPages,
  onPageChange,
  onEdit,
  hideCostPrice = false,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
              {!hideCostPrice && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {drugs.map((drug) => {
              const availableQty = drug.available_qty || 0;
              const statusColor = availableQty <= drug.min_qty 
                ? 'bg-red-100 text-red-800' 
                : availableQty <= drug.max_qty * 0.5 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-green-100 text-green-800';
              
              const expiryUrgency = drug.nearest_expiry ? getExpiryUrgency(drug.nearest_expiry) : 'green';
              const expiryBadge = getUrgencyBadgeClass(expiryUrgency);

              return (
                <tr key={drug.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{drug.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{drug.name_en}</div>
                    <div className="text-sm text-gray-500">{drug.name_ar}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{drug.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{availableQty}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor}`}>
                      {availableQty <= drug.min_qty ? 'LOW' : availableQty <= drug.max_qty * 0.5 ? 'OK' : 'GOOD'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {drug.nearest_expiry && (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${expiryBadge}`}>
                        {new Date(drug.nearest_expiry).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  {!hideCostPrice && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrencySimple(drug.cost_price / 100)}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrencySimple(drug.sell_price / 100)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(drug)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="text-sm text-gray-700">
          Page {page} of {totalPages}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
