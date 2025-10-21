import React from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardLink from '../components/DashboardLink';
import { ReceiptIcon, EstimateIcon, CustomersIcon, LogoutIcon, WalletIcon } from '../components/icons';

const UserDashboard: React.FC = () => {
  const { user, branch, logout } = useAuth();

  return (
    <div className="max-w-4xl mx-auto my-10 p-8 bg-white rounded-xl shadow-lg">
      <header className="border-b border-gray-200 pb-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <h1 className="m-0 text-3xl font-bold text-gray-800">User Dashboard</h1>
          {user && (
            <div className="flex flex-col items-center sm:items-end bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-600 min-w-[200px]">
              <div className="font-semibold text-gray-800 mb-1 text-base">
                {user.role === 'CLIENT' ? <i className="fa-solid fa-user-tag mr-2"></i> : <i className="fa-solid fa-user mr-2"></i>}
                {user.username}
              </div>
              {branch && (
                <div className="mb-2"><i className="fa-solid fa-building mr-2"></i>{branch.name}</div>
              )}
              {user.role === 'CLIENT' && typeof user.wallet_balance !== 'undefined' && (
                <div className={`font-bold px-3 py-1 rounded-full text-xs ${user.wallet_balance < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    <i className="fa-solid fa-wallet mr-2"></i>₹{user.wallet_balance.toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <nav>
        <h2 className="text-xl font-semibold text-gray-700 mb-6 pb-2 border-b">Actions</h2>
        <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <li><DashboardLink to="/receipt-form" icon={<ReceiptIcon />} text="Create New Receipt" /></li>
          <li><DashboardLink to="/estimate-form" icon={<EstimateIcon />} text="Create New Estimate" /></li>
          <li><DashboardLink to="/customers" icon={<CustomersIcon />} text="View Customers" /></li>
           {user?.role === 'CLIENT' && (
             <li>
                <DashboardLink to="/transactions" icon={<WalletIcon />} text="Transaction History" />
            </li>
          )}
        </ul>
      </nav>

      <div className="text-center mt-12 pt-6 border-t border-gray-200">
        <button
          onClick={logout}
          className="text-red-600 font-medium bg-red-50 px-6 py-2 rounded-lg transition-colors border border-red-200 hover:bg-red-100"
        >
          <LogoutIcon className="mr-2" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default UserDashboard;