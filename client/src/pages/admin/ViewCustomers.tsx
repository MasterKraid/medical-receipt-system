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
            apiService.getAllCustomers(user)
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
    
    const filteredCustomers = customers.filter(cust => 
        cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cust.mobile?.includes(searchTerm) ||
        cust.display_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <PageHeader title="All Customers" />

                <div className="mb-4">
                    <input 
                        type="search"
                        placeholder="Search by Customer ID, Name, or Mobile..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-2 border rounded"
                    />
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-2 px-4 border-b text-left">Customer ID</th>
                                <th className="py-2 px-4 border-b text-left">Name</th>
                                <th className="py-2 px-4 border-b text-left">Mobile</th>
                                <th className="py-2 px-4 border-b text-left">Gender</th>
                                <th className="py-2 px-4 border-b text-left">DOB / Age</th>
                                <th className="py-2 px-4 border-b text-left">Registered On</th>
                                {user?.role === 'ADMIN' && <th className="py-2 px-4 border-b text-left">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={user?.role === 'ADMIN' ? 7 : 6} className="text-center py-4">Loading customers...</td></tr>
                            ) : filteredCustomers.length > 0 ? (
                                filteredCustomers.map(cust => (
                                    <tr key={cust.id}>
                                        <td className="py-2 px-4 border-b">{cust.display_id}</td>
                                        <td className="py-2 px-4 border-b">{cust.name}</td>
                                        <td className="py-2 px-4 border-b">{cust.mobile || 'N/A'}</td>
                                        <td className="py-2 px-4 border-b">{cust.gender || 'N/A'}</td>
                                        <td className="py-2 px-4 border-b">{cust.dob_formatted !== 'N/A' ? cust.dob_formatted : cust.display_age}</td>
                                        <td className="py-2 px-4 border-b">{cust.display_created_at}</td>
                                        {user?.role === 'ADMIN' && (
                                            <td className="py-2 px-4 border-b">
                                                <Link to={`/admin/customers/edit/${cust.id}`} className="px-3 py-1 bg-yellow-500 text-white rounded text-xs">Edit</Link>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={user?.role === 'ADMIN' ? 7 : 6} className="text-center py-4">No customers found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ViewCustomers;
