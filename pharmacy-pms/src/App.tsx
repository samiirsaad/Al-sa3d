import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import NewDrug from './pages/NewDrug';
import POS from './pages/POS';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Customers from './pages/Customers';
import ExpiryAlerts from './pages/ExpiryAlerts';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  const { user, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();

    // Auto-logout after 8 hours
    const interval = setInterval(() => {
      const loginTime = localStorage.getItem('loginTime');
      if (loginTime) {
        const elapsed = Date.now() - parseInt(loginTime);
        if (elapsed > 8 * 60 * 60 * 1000) {
          logout();
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [checkAuth, logout]);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Navigate to="/dashboard" />} />
        
        <Route path="dashboard" element={
          <ProtectedRoute allowedRoles={['admin', 'pharmacist', 'cashier', 'inventory_manager', 'reports_manager']}>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="inventory" element={
          <ProtectedRoute allowedRoles={['admin', 'pharmacist', 'inventory_manager']}>
            <Inventory />
          </ProtectedRoute>
        } />
        
        <Route path="inventory/new" element={
          <ProtectedRoute allowedRoles={['admin', 'pharmacist', 'inventory_manager']}>
            <NewDrug />
          </ProtectedRoute>
        } />
        
        <Route path="pos" element={
          <ProtectedRoute allowedRoles={['admin', 'pharmacist', 'cashier']}>
            <POS />
          </ProtectedRoute>
        } />
        
        <Route path="invoices" element={
          <ProtectedRoute allowedRoles={['admin', 'pharmacist', 'cashier', 'reports_manager']}>
            <Invoices />
          </ProtectedRoute>
        } />
        
        <Route path="invoices/:id" element={
          <ProtectedRoute allowedRoles={['admin', 'pharmacist', 'cashier', 'reports_manager']}>
            <InvoiceDetail />
          </ProtectedRoute>
        } />
        
        <Route path="customers" element={
          <ProtectedRoute allowedRoles={['admin', 'pharmacist']}>
            <Customers />
          </ProtectedRoute>
        } />
        
        <Route path="expiry-alerts" element={
          <ProtectedRoute allowedRoles={['admin', 'pharmacist', 'inventory_manager']}>
            <ExpiryAlerts />
          </ProtectedRoute>
        } />
        
        <Route path="reports" element={
          <ProtectedRoute allowedRoles={['admin', 'reports_manager']}>
            <Reports />
          </ProtectedRoute>
        } />
        
        <Route path="settings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Settings />
          </ProtectedRoute>
        } />
      </Route>
      
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

export default App;
