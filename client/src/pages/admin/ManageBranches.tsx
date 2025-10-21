import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { Branch } from '../../types';

const ManageBranches: React.FC = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    // New Branch Form State
    const [newName, setNewName] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newPhone, setNewPhone] = useState('');

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getBranches();
            setBranches(data);
        } catch (error) {
            console.error("Failed to fetch branches", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiService.createBranch({ name: newName, address: newAddress, phone: newPhone });
            setNewName('');
            setNewAddress('');
            setNewPhone('');
            fetchBranches(); // Refresh list
        } catch (error) {
            alert(`Error adding branch: ${error}`);
        }
    };
    
    const handleUpdateBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!editingBranch) return;
        try {
            await apiService.updateBranch(editingBranch);
            setEditingBranch(null);
            fetchBranches();
        } catch (error) {
            alert(`Error updating branch: ${error}`);
        }
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <PageHeader title="Manage Branches" />

                {/* Add New Branch Form */}
                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">Add New Branch</h2>
                    <form onSubmit={handleAddBranch} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Branch Name" className="p-2 border rounded" required />
                           <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone Number(s)" className="p-2 border rounded" required />
                        </div>
                        <textarea value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Address" className="w-full p-2 border rounded" rows={3} required></textarea>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add Branch</button>
                    </form>
                </section>
                
                {/* Existing Branches Table */}
                <section>
                     <h2 className="text-xl font-semibold mb-4 border-b pb-2">Existing Branches</h2>
                     <div className="overflow-x-auto">
                        <table className="min-w-full bg-white">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="py-2 px-4 border-b text-left">Name</th>
                                    <th className="py-2 px-4 border-b text-left">Address</th>
                                    <th className="py-2 px-4 border-b text-left">Phone</th>
                                    <th className="py-2 px-4 border-b text-left">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={4} className="text-center py-4">Loading...</td></tr>
                                ) : (
                                    branches.map(branch => (
                                        <tr key={branch.id}>
                                            <td className="py-2 px-4 border-b">{branch.name}</td>
                                            <td className="py-2 px-4 border-b whitespace-pre-wrap">{branch.address}</td>
                                            <td className="py-2 px-4 border-b">{branch.phone}</td>
                                            <td className="py-2 px-4 border-b">
                                                <button onClick={() => setEditingBranch(branch)} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm">Edit</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                     </div>
                </section>
            </div>
            
            {/* Edit Modal */}
            {editingBranch && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4">Editing: {editingBranch.name}</h2>
                        <form onSubmit={handleUpdateBranch} className="space-y-4">
                            <input type="text" value={editingBranch.name} onChange={e => setEditingBranch({...editingBranch, name: e.target.value})} className="w-full p-2 border rounded" />
                            <textarea value={editingBranch.address} onChange={e => setEditingBranch({...editingBranch, address: e.target.value})} className="w-full p-2 border rounded" rows={3}></textarea>
                            <input type="text" value={editingBranch.phone} onChange={e => setEditingBranch({...editingBranch, phone: e.target.value})} className="w-full p-2 border rounded" />
                            <div className="flex justify-end gap-4">
                                <button type="button" onClick={() => setEditingBranch(null)} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageBranches;
