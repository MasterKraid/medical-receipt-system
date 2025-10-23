import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { Customer } from '../../types';

const prefixOptions = ['Mr.', 'Mrs.', 'Miss.', 'Baby.', 'Master.', 'Dr.', 'B/O', 'Ms.', 'C/O', 'S/O'];

const EditCustomer: React.FC = () => {
    const { id } = useParams() as { id: string };
    const navigate = useNavigate();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenderDisabled, setIsGenderDisabled] = useState(false);

    useEffect(() => {
        if (id) {
            apiService.getCustomerById(Number(id))
                .then(data => {
                    if(data) setCustomer(data);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setIsLoading(false);
                });
        }
    }, [id]);

    useEffect(() => {
        if (customer?.prefix) {
            const prefix = customer.prefix;
            let isLocked = false;
            let newGender = customer.gender;

            switch (prefix) {
                case 'Mr.':
                case 'Master.':
                case 'B/O':
                case 'S/O':
                    newGender = 'Male';
                    isLocked = true;
                    break;
                case 'Mrs.':
                case 'Miss.':
                case 'Ms.':
                    newGender = 'Female';
                    isLocked = true;
                    break;
                default:
                    isLocked = false;
                    break;
            }
            setIsGenderDisabled(isLocked);
            if (isLocked && newGender !== customer.gender) {
                setCustomer(c => c ? { ...c, gender: newGender } : null);
            }
        }
    }, [customer?.prefix]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if(customer) setCustomer({ ...customer, [name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (customer) {
            try {
                await apiService.updateCustomer(customer);
                navigate('/admin/customers');
            } catch (error) {
                alert(`Failed to update customer: ${error}`);
            }
        }
    };

    if (isLoading) return <div className="p-8">Loading customer details...</div>;
    if (!customer) return <div className="p-8">Customer not found.</div>;

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <PageHeader title={`Edit Customer: ${customer.name}`} backLink="/admin/customers" backText="Back to Customers" />
                
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 md:col-span-2">
                             <div className="w-1/4">
                                <label htmlFor="prefix" className="block text-sm font-medium text-gray-700">Prefix</label>
                                <select id="prefix" name="prefix" value={customer.prefix || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                    {prefixOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="w-3/4">
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                                <input type="text" id="name" name="name" value={customer.name} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="mobile" className="block text-sm font-medium text-gray-700">Mobile</label>
                            <input type="tel" id="mobile" name="mobile" value={customer.mobile || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                         <div>
                            <label htmlFor="dob" className="block text-sm font-medium text-gray-700">Date of Birth</label>
                            <input type="date" id="dob" name="dob" value={customer.dob || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                         <div>
                            <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
                            <input type="number" id="age" name="age" value={customer.age || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                             <select id="gender" name="gender" value={customer.gender || ''} onChange={handleInputChange} disabled={isGenderDisabled} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100">
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditCustomer;