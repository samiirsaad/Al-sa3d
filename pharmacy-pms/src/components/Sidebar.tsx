import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', roles: ['admin', 'pharmacist', 'inventory_manager', 'reports_manager'] as UserRole[] },
  { name: 'Inventory', href: '/inventory', roles: ['admin', 'pharmacist', 'inventory_manager'] as UserRole[] },
  { name: 'POS', href: '/pos', roles: ['admin', 'pharmacist', 'cashier'] as UserRole[] },
  { name: 'Invoices', href: '/invoices', roles: ['admin', 'pharmacist', 'cashier', 'reports_manager'] as UserRole[] },
  { name: 'Customers', href: '/customers', roles: ['admin', 'pharmacist'] as UserRole[] },
  { name: 'Expiry Alerts', href: '/expiry-alerts', roles: ['admin', 'pharmacist', 'inventory_manager'] as UserRole[] },
  { name: 'Reports', href: '/reports', roles: ['admin', 'reports_manager'] as UserRole[] },
  { name: 'Settings', href: '/settings', roles: ['admin'] as UserRole[] },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();

  if (!user) return null;

  const filteredNav = navigation.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen">
      <div className="p-4">
        <h1 className="text-xl font-bold">Pharmacy PMS</h1>
        <p className="text-sm text-gray-400 mt-1">{user.full_name}</p>
        <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
      </div>
      
      <nav className="mt-4">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`block px-4 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white border-l-4 border-blue-500'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
