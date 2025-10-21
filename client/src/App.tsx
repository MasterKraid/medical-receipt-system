import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ReceiptForm from './pages/ReceiptForm';
import EstimateForm from './pages/EstimateForm';
import ReceiptView from './pages/ReceiptView';
import EstimateView from './pages/EstimateView';
import ManageUsers from './pages/admin/ManageUsers';
import ManageBranches from './pages/admin/ManageBranches';
import ManageLabs from './pages/admin/ManageLabs';
import ManagePackageLists from './pages/admin/ManagePackageLists';
import ManageWallets from './pages/admin/ManageWallets';
import ViewCustomers from './pages/admin/ViewCustomers';
import ViewDocuments from './pages/admin/ViewDocuments';
import EditUser from './pages/admin/EditUser';
import EditCustomer from './pages/admin/EditCustomer';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import ReloadPrompt from './components/ReloadPrompt';

const ProtectedRoute: React.FC<{ children: React.ReactElement; roles?: string[] }> = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/" />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" />; // Or an unauthorized page
  }
  return children;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => (
  <ProtectedRoute roles={['ADMIN']}>{children}</ProtectedRoute>
);

const AppRoutes: React.FC = () => {
    const { user } = useAuth();

    return (
        <Routes>
            <Route path="/" element={!user ? <LoginPage /> : <Navigate to={user.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard'} />} />
            
            <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            
            <Route path="/receipt-form" element={<ProtectedRoute roles={['ADMIN', 'GENERAL_EMPLOYEE', 'CLIENT']}><ReceiptForm /></ProtectedRoute>} />
            <Route path="/estimate-form" element={<ProtectedRoute><EstimateForm /></ProtectedRoute>} />
            
            <Route path="/receipt/:id" element={<ProtectedRoute><ReceiptView /></ProtectedRoute>} />
            <Route path="/estimate/:id" element={<ProtectedRoute><EstimateView /></ProtectedRoute>} />
            
            <Route path="/transactions" element={<ProtectedRoute roles={['CLIENT']}><TransactionHistoryPage /></ProtectedRoute>} />

            <Route path="/admin/users" element={<AdminRoute><ManageUsers /></AdminRoute>} />
            <Route path="/admin/users/edit/:id" element={<AdminRoute><EditUser /></AdminRoute>} />

            <Route path="/admin/branches" element={<AdminRoute><ManageBranches /></AdminRoute>} />
            <Route path="/admin/labs" element={<AdminRoute><ManageLabs /></AdminRoute>} />
            <Route path="/admin/package-lists" element={<AdminRoute><ManagePackageLists /></AdminRoute>} />
            <Route path="/admin/wallet" element={<AdminRoute><ManageWallets /></AdminRoute>} />
            
            <Route path="/customers" element={<ProtectedRoute><ViewCustomers /></ProtectedRoute>} />
            <Route path="/admin/customers" element={<AdminRoute><ViewCustomers /></AdminRoute>} />
            <Route path="/admin/customers/edit/:id" element={<AdminRoute><EditCustomer /></AdminRoute>} />

            <Route path="/admin/receipts" element={<AdminRoute><ViewDocuments docType="receipt" /></AdminRoute>} />
            <Route path="/admin/estimates" element={<AdminRoute><ViewDocuments docType="estimate" /></AdminRoute>} />
            
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
        <ReloadPrompt />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;