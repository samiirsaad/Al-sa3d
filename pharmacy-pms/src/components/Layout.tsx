import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useInventory } from '../hooks/useInventory';

export const Layout: React.FC = () => {
  const { alerts } = useInventory();
  
  // Count red and orange urgency alerts
  const urgentAlerts = alerts.filter(a => a.urgency === 'red' || a.urgency === 'orange').length;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header expiryAlertCount={urgentAlerts} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
