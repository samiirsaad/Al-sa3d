import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const settingsSchema = z.object({
  pharmacy_name: z.string().min(1, 'Pharmacy name is required'),
  pharmacy_address: z.string().min(1, 'Address is required'),
  pharmacy_phone: z.string().min(1, 'Phone is required'),
  tax_rate: z.number().min(0).max(100),
  invoice_prefix: z.string().min(1),
  low_stock_threshold: z.number().min(1),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const [logo, setLogo] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const { register, handleSubmit, setValue, watch } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      pharmacy_name: 'Al-Shifa Pharmacy',
      pharmacy_address: '123 Main Street, City Center',
      pharmacy_phone: '+1 (555) 123-4567',
      tax_rate: 10,
      invoice_prefix: 'INV-',
      low_stock_threshold: 10,
    },
  });

  const handleSave = async (data: SettingsFormData) => {
    try {
      // Save settings to database via IPC
      for (const [key, value] of Object.entries(data)) {
        await window.electronAPI.storeSet(`settings.${key}`, value);
      }
      if (logo) {
        await window.electronAPI.storeSet('settings.logo', logo);
      }
      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error(`Failed to save settings: ${error.message}`);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      const result = await window.electronAPI.backupDatabase();
      if (result.success) {
        toast.success(`Database backed up to: ${result.path}`);
      } else {
        toast.error('Backup cancelled or failed');
      }
    } catch (error: any) {
      toast.error(`Backup failed: ${error.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('WARNING: This will replace the current database. All unsaved data will be lost. Continue?')) {
      return;
    }
    
    try {
      setIsRestoring(true);
      const result = await window.electronAPI.restoreDatabase();
      if (result.success) {
        toast.success('Database restored successfully. The application will restart.');
        setTimeout(() => {
          window.electronAPI.restartApp();
        }, 2000);
      } else {
        toast.error('Restore cancelled or failed');
      }
    } catch (error: any) {
      toast.error(`Restore failed: ${error.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* General Settings */}
      <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">General Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name</label>
              <input
                {...register('pharmacy_name')}
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                {...register('pharmacy_phone')}
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                {...register('pharmacy_address')}
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Invoice & Tax Settings */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice & Tax</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
              <input
                {...register('invoice_prefix')}
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
              <input
                {...register('tax_rate', { valueAsNumber: true })}
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
              <input
                {...register('low_stock_threshold', { valueAsNumber: true })}
                type="number"
                min="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Logo Upload */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pharmacy Logo</h2>
          
          <div className="flex items-center gap-4">
            {logo ? (
              <img src={logo} alt="Logo preview" className="h-20 w-20 object-contain border rounded-lg" />
            ) : (
              <div className="h-20 w-20 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-xs">No Logo</span>
              </div>
            )}
            
            <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              Choose Image
            </label>
          </div>
        </div>

        {/* Database Management */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Database Management</h2>
          
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleBackup}
              disabled={isBackingUp}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {isBackingUp ? 'Backing Up...' : 'Backup Database'}
            </button>
            
            <button
              type="button"
              onClick={handleRestore}
              disabled={isRestoring}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              {isRestoring ? 'Restoring...' : 'Restore Database'}
            </button>
          </div>
          
          <p className="mt-2 text-sm text-gray-500">
            Backup creates a copy of your database. Restore replaces the current database with a backup file.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
