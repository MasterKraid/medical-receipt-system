
import React from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardLink from '../components/DashboardLink';
import { ReceiptIcon, EstimateIcon, ViewIcon, CustomersIcon, LabsIcon, PackageListIcon, BranchesIcon, UsersIcon, WalletIcon, LogoutIcon } from '../components/icons';

const AdminDashboard: React.FC = () => {
    const { user, branch, logout } = useAuth();

    return (
        <div className="max-w-4xl mx-auto my-10 p-8 bg-white rounded-xl shadow-lg">
            <header className="border-b border-gray-200 pb-6 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4 text-center md:text-left">
                    <h1 className="m-0 text-2xl md:text-3xl font-bold text-gray-800">Admin Dashboard</h1>
                    {user && (
                        <div className="flex flex-col items-center md:items-end bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-600 w-full md:w-auto md:min-w-[200px]">
                            <div className="font-semibold text-gray-800 mb-1 text-base">
                                <i className="fa-solid fa-user-shield mr-2"></i>
                                {user.username}
                            </div>
                            {branch && (
                                <div className="mb-2"><i className="fa-solid fa-building mr-2"></i>{branch.name}</div>
                            )}
                            <div className="font-semibold text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full whitespace-nowrap">
                                <i className="fa-solid fa-crown mr-2"></i>
                                Administrator
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <nav className="relative">
                <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl">
                    <legend className="px-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                            <i className="fa-solid fa-gears text-xs"></i>
                        </div>
                        <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">System Management</span>
                    </legend>
                    <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4">
                        <li><DashboardLink to="/receipt-form" icon={<ReceiptIcon />} text="Create Receipt" /></li>
                        <li><DashboardLink to="/estimate-form" icon={<EstimateIcon />} text="Create Estimate" /></li>
                        <li><DashboardLink to="/admin/receipts" icon={<ViewIcon />} text="View Receipts" /></li>
                        <li><DashboardLink to="/admin/estimates" icon={<ViewIcon />} text="View Estimates" /></li>
                        <li><DashboardLink to="/admin/customers" icon={<CustomersIcon />} text="View Customers" /></li>
                        <li><DashboardLink to="/admin/labs" icon={<LabsIcon />} text="Manage Labs" /></li>
                        <li><DashboardLink to="/admin/package-lists" icon={<PackageListIcon />} text="Manage Rate Lists" /></li>
                        <li><DashboardLink to="/admin/branches" icon={<BranchesIcon />} text="Manage Branches" /></li>
                        <li><DashboardLink to="/admin/users" icon={<UsersIcon />} text="Manage Users" /></li>
                        <li><DashboardLink to="/admin/wallet" icon={<WalletIcon />} text="Manage Wallets" /></li>
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

export default AdminDashboard;
