import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import DashboardLink from '../components/DashboardLink';
import { ReceiptIcon, EstimateIcon, CustomersIcon, LogoutIcon, WalletIcon, ViewIcon } from '../components/icons';

const UserDashboard: React.FC = () => {
  const { user, branch, logout } = useAuth();
  const [unreadReports, setUnreadReports] = useState(0);

  useEffect(() => {
    if (user?.role === 'CLIENT') {
      apiService.getReportsClient().then(reports => {
        setUnreadReports(reports.filter(r => !r.is_read).length);
      }).catch(console.error);
    }
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto my-10 p-8 bg-white rounded-xl shadow-lg">
      <header className="border-b border-gray-200 pb-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4 text-center md:text-left">
          <h1 className="m-0 text-2xl md:text-3xl font-bold text-gray-800">User Dashboard</h1>
          {user && (
            <div className="flex flex-col items-center md:items-end bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-600 w-full md:w-auto md:min-w-[200px]">
              <div className="font-semibold text-gray-800 mb-1 text-base">
                {user.role === 'CLIENT' ? <i className="fa-solid fa-user-tag mr-2"></i> : <i className="fa-solid fa-user mr-2"></i>}
                {user.username}
              </div>
              {branch && (
                <div className="mb-2"><i className="fa-solid fa-building mr-2"></i>{branch.name}</div>
              )}
              {user.role === 'CLIENT' && typeof user.wallet_balance !== 'undefined' && (
                <div className={`font-bold px-3 py-1 rounded-full text-xs whitespace-nowrap ${user.wallet_balance < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  <i className="fa-solid fa-wallet mr-2"></i>₹{user.wallet_balance.toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <nav className="relative">
        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl">
          <legend className="px-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
              <i className="fa-solid fa-list-check text-xs"></i>
            </div>
            <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">Available Actions</span>
          </legend>
          <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <li><DashboardLink to="/receipt-form" icon={<ReceiptIcon />} text="Create New Receipt" /></li>

            {user?.role === 'CLIENT' ? (
              <li>
                <div className="relative">
                  <DashboardLink to="/reports" icon={<ViewIcon />} text="My Lab Reports" />
                  {unreadReports > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce shadow-sm ring-2 ring-white">
                      {unreadReports} New
                    </div>
                  )}
                </div>
              </li>
            ) : (
              <li><DashboardLink to="/estimate-form" icon={<EstimateIcon />} text="Create New Estimate" /></li>
            )}

            <li><DashboardLink to="/customers" icon={<CustomersIcon />} text="View Customers" /></li>

            {user?.role === 'CLIENT' && (
              <li>
                <DashboardLink to="/transactions" icon={<WalletIcon />} text="Transaction History" />
              </li>
            )}
          </ul>
        </fieldset>
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