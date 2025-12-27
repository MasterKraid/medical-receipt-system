import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { FormattedCustomer } from '../../types';
import { useAuth } from '../../context/AuthContext';

const ViewCustomers: React.FC = () => {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<FormattedCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (user) {
            setIsLoading(true);
            apiService.getAllCustomers()
                .then(data => {
                    setCustomers(data);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch customers", err);
                    setIsLoading(false);
                });
        }
    }, [user]);

    const filteredCustomers = React.useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return customers;
        return customers.filter(cust =>
            cust.name.toLowerCase().includes(query) ||
            cust.mobile?.includes(query) ||
            cust.display_id.toLowerCase().includes(query)
        );
    }, [customers, searchTerm]);

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Customer Directory" />

                <div className="relative flex flex-col">
                    <div className="md:absolute static top-0 right-6 md:-translate-y-[5px] mb-4 md:mb-0 flex justify-end order-1 md:order-none">
                        <div className="search-container w-full md:w-80 bg-white shadow-sm md:shadow-none">
                            <i className="fa-solid fa-magnifying-glass text-gray-700 text-xs mr-2"></i>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search by ID, Name, or Mobile..."
                                className="search-input"
                            />
                        </div>
                    </div>

                    <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl order-2 min-w-0">
                        <legend className="px-3 flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                <i className="fa-solid fa-users text-xs"></i>
                            </div>
                            <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">All Registered Customers</span>
                        </legend>

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full min-w-[800px] bg-white divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Identity</th>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Contact & Info</th>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Registration</th>
                                        {user?.role === 'ADMIN' && <th className="py-3 px-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {isLoading ? (
                                        <tr><td colSpan={user?.role === 'ADMIN' ? 4 : 3} className="text-center py-12 text-gray-400 italic text-sm">Synchronizing customer records...</td></tr>
                                    ) : filteredCustomers.length === 0 ? (
                                        <tr><td colSpan={user?.role === 'ADMIN' ? 4 : 3} className="text-center py-12 text-gray-400 italic text-sm">No customers matching your search found.</td></tr>
                                    ) : (
                                        filteredCustomers.map(cust => (
                                            <tr key={cust.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="py-3 px-4">
                                                    <div className="text-sm font-bold text-gray-800">{cust.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono italic">{cust.display_id}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                                            <i className="fa-solid fa-phone text-[10px] text-gray-400"></i>
                                                            {cust.mobile || 'No Mobile'}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                                            <i className={`fa-solid ${cust.gender === 'Male' ? 'fa-mars' : 'fa-venus'} text-gray-300`}></i>
                                                            {cust.gender || 'N/A'} • {cust.dob_formatted !== 'N/A' ? cust.dob_formatted : cust.display_age}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-xs font-semibold text-gray-500">
                                                    {cust.display_created_at}
                                                </td>
                                                {user?.role === 'ADMIN' && (
                                                    <td className="py-3 px-4 text-right">
                                                        <Link to={`/admin/customers/edit/${cust.id}`} className="w-8 h-8 inline-flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-yellow-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm" title="Edit Profile">
                                                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                        </Link>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </fieldset>
                </div>
            </div>
        </div>
    );
};

export default ViewCustomers;
