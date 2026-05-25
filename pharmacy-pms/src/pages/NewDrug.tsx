import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useDrugs } from '../hooks/useDrugs';

const drugSchema = z.object({
  name_ar: z.string().min(1, 'Arabic name is required'),
  name_en: z.string().min(1, 'English name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  dosage_strength: z.string().min(1, 'Dosage strength is required'),
  dosage_unit: z.string().min(1, 'Dosage unit is required'),
  dosage_form: z.string().min(1, 'Dosage form is required'),
  storage_temp: z.string().min(1, 'Storage temperature is required'),
  cost_price: z.number().min(0, 'Cost price must be positive'),
  sell_price: z.number().min(0, 'Sell price must be positive'),
  min_qty: z.number().min(0, 'Min quantity must be non-negative'),
  max_qty: z.number().min(0, 'Max quantity must be non-negative'),
  is_controlled: z.boolean().default(false),
});

type DrugForm = z.infer<typeof drugSchema>;

export default function NewDrug() {
  const navigate = useNavigate();
  const { createDrug } = useDrugs();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<DrugForm>({
    resolver: zodResolver(drugSchema),
    defaultValues: {
      name_ar: '',
      name_en: '',
      sku: '',
      barcode: '',
      category: '',
      manufacturer: '',
      dosage_strength: '',
      dosage_unit: 'mg',
      dosage_form: 'Tablet',
      storage_temp: 'Room Temp',
      cost_price: 0,
      sell_price: 0,
      min_qty: 5,
      max_qty: 100,
      is_controlled: false,
    },
  });

  const onSubmit = async (data: DrugForm) => {
    setIsLoading(true);
    try {
      const result = await createDrug(data);
      if (result.success) {
        toast.success('Drug created successfully');
        navigate('/inventory');
      } else {
        toast.error(result.error || 'Failed to create drug');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Add New Drug</h1>
        <button
          onClick={() => navigate('/inventory')}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Back to Inventory
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Names */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              English Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name_en')}
              type="text"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.name_en ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name_en && <p className="mt-1 text-sm text-red-600">{errors.name_en.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arabic Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name_ar')}
              type="text"
              dir="rtl"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.name_ar ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name_ar && <p className="mt-1 text-sm text-red-600">{errors.name_ar.message}</p>}
          </div>

          {/* SKU & Barcode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              {...register('sku')}
              type="text"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.sku ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.sku && <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
            <input
              {...register('barcode')}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category & Manufacturer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              {...register('category')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Category</option>
              <option value="Analgesics">Analgesics</option>
              <option value="Antibiotics">Antibiotics</option>
              <option value="Gastrointestinal">Gastrointestinal</option>
              <option value="Diabetes">Diabetes</option>
              <option value="Cardiovascular">Cardiovascular</option>
              <option value="Respiratory">Respiratory</option>
              <option value="Other">Other</option>
            </select>
            {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manufacturer <span className="text-red-500">*</span>
            </label>
            <input
              {...register('manufacturer')}
              type="text"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.manufacturer ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.manufacturer && <p className="mt-1 text-sm text-red-600">{errors.manufacturer.message}</p>}
          </div>

          {/* Dosage Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dosage Strength <span className="text-red-500">*</span>
            </label>
            <input
              {...register('dosage_strength')}
              type="text"
              placeholder="e.g., 500"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.dosage_strength ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.dosage_strength && <p className="mt-1 text-sm text-red-600">{errors.dosage_strength.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dosage Unit <span className="text-red-500">*</span>
            </label>
            <select
              {...register('dosage_unit')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="mg">mg</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="tablet">tablet</option>
              <option value="capsule">capsule</option>
              <option value="sachet">sachet</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dosage Form <span className="text-red-500">*</span>
            </label>
            <select
              {...register('dosage_form')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Tablet">Tablet</option>
              <option value="Capsule">Capsule</option>
              <option value="Syrup">Syrup</option>
              <option value="Injection">Injection</option>
              <option value="Cream">Cream</option>
              <option value="Ointment">Ointment</option>
              <option value="Suspension">Suspension</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Storage Temperature <span className="text-red-500">*</span>
            </label>
            <select
              {...register('storage_temp')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Room Temp">Room Temperature</option>
              <option value="Cool Dry Place">Cool Dry Place</option>
              <option value="Refrigerate">Refrigerate (2-8°C)</option>
              <option value="Freeze">Freeze (-20°C)</option>
            </select>
          </div>

          {/* Prices */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cost Price <span className="text-red-500">*</span>
            </label>
            <input
              {...register('cost_price', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.cost_price ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.cost_price && <p className="mt-1 text-sm text-red-600">{errors.cost_price.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sell Price <span className="text-red-500">*</span>
            </label>
            <input
              {...register('sell_price', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.sell_price ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.sell_price && <p className="mt-1 text-sm text-red-600">{errors.sell_price.message}</p>}
          </div>

          {/* Quantity Limits */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Quantity</label>
            <input
              {...register('min_qty', { valueAsNumber: true })}
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Quantity</label>
            <input
              {...register('max_qty', { valueAsNumber: true })}
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Controlled Substance */}
          <div className="md:col-span-2">
            <label className="flex items-center space-x-2">
              <input
                {...register('is_controlled')}
                type="checkbox"
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">This is a controlled substance</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating...' : 'Create Drug'}
          </button>
        </div>
      </form>
    </div>
  );
}
