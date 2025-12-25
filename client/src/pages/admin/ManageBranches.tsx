import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { Branch } from '../../types';

const ManageBranches: React.FC = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
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

    const filteredBranches = React.useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return branches;
        return branches.filter(b =>
            b.name.toLowerCase().includes(query) ||
            b.address.toLowerCase().includes(query) ||
            b.phone.toLowerCase().includes(query)
        );
    }, [branches, searchTerm]);

    const handleAddBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiService.createBranch({ name: newName, address: newAddress, phone: newPhone });
            setNewName('');
            setNewAddress('');
            setNewPhone('');
            fetchBranches();
        } catch (error) {
            alert(`Error adding branch: ${error}`);
        }
    };

    const handleUpdateBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBranch) return;
        try {
            await apiService.updateBranch(editingBranch);
            setEditingBranch(null);
            fetchBranches();
        } catch (error) {
            alert(`Error updating branch: ${error}`);
        }
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Branch Management" />

                {/* Add New Branch Form */}
                <section className="mb-10">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-300 pb-2">
                        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <i className="fa-solid fa-plus-circle text-xs"></i>
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Add New Branch</h2>
                    </div>

                    <form onSubmit={handleAddBranch} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Branch Name</label>
                                <div className="relative">
                                    <i className="fa-solid fa-building absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Downtown Center" required className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all outline-none text-sm" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Contact Phone</label>
                                <div className="relative">
                                    <i className="fa-solid fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                    <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone Number(s)" required className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all outline-none text-sm" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Physical Address</label>
                            <div className="relative">
                                <i className="fa-solid fa-map-location-dot absolute left-3 top-3 text-gray-400 text-xs"></i>
                                <textarea value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Complete Street Address" className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all outline-none text-sm" rows={2} required></textarea>
                            </div>
                        </div>

                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2 text-sm">
                            <i className="fa-solid fa-plus"></i> Add Branch
                        </button>
                    </form>
                </section>

                <hr className="my-10 border-gray-300" />

                {/* Existing Branches Table */}
                <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-300 pb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                <i className="fa-solid fa-network-wired text-xs"></i>
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">Branch Directory</h2>
                        </div>

                        <div className="relative w-full md:w-64">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search branch info..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all text-sm"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full bg-white divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Branch Name</th>
                                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Location</th>
                                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Contact</th>
                                    <th className="py-3 px-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {isLoading ? (
                                    <tr><td colSpan={4} className="text-center py-12 text-gray-400 italic text-sm">Fetching branches...</td></tr>
                                ) : filteredBranches.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-12 text-gray-400 italic text-sm">No branches found matching your search.</td></tr>
                                ) : (
                                    filteredBranches.map(branch => (
                                        <tr key={branch.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-3 px-4 font-bold text-blue-900">{branch.name}</td>
                                            <td className="py-3 px-4 text-gray-600 whitespace-pre-wrap max-w-xs">{branch.address}</td>
                                            <td className="py-3 px-4 text-gray-600 italic text-xs">{branch.phone}</td>
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => setEditingBranch(branch)} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-yellow-500 hover:text-white rounded border border-gray-100 transition-all" title="Edit Information">
                                                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                </button>
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-200">
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-300 pb-4">
                            <div className="w-8 h-8 rounded bg-yellow-500 flex items-center justify-center text-white shadow-sm">
                                <i className="fa-solid fa-edit text-xs"></i>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">Edit Branch</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{editingBranch.name}</p>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateBranch} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Name</label>
                                <input type="text" value={editingBranch.name} onChange={e => setEditingBranch({ ...editingBranch, name: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-yellow-50 outline-none text-sm" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Address</label>
                                <textarea value={editingBranch.address} onChange={e => setEditingBranch({ ...editingBranch, address: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-yellow-50 outline-none text-sm" rows={2} required></textarea>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Contact</label>
                                <input type="text" value={editingBranch.phone} onChange={e => setEditingBranch({ ...editingBranch, phone: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-yellow-50 outline-none text-sm" required />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-300">
                                <button type="button" onClick={() => setEditingBranch(null)} className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 transition-all text-xs">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 shadow-sm transition-all text-xs">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageBranches;
