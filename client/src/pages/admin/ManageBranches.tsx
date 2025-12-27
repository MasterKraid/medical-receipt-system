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

    const handleDeleteBranch = async (id: number) => {
        if (window.confirm("Are you sure you want to delete this branch?")) {
            try {
                await apiService.deleteBranch(id);
                fetchBranches();
            } catch (error) {
                alert(`Error deleting branch: ${error}`);
            }
        }
    };

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Branch Management" />

                {/* Add New Branch Form */}
                <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl mb-10">
                    <legend className="px-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <i className="fa-solid fa-code-branch text-xs"></i>
                        </div>
                        <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">Add New Branch</span>
                    </legend>

                    <form onSubmit={handleAddBranch} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="newName" className="text-[10px] font-bold text-gray-400 uppercase ml-1">Branch Name</label>
                                <div className="relative">
                                    <i className="fa-solid fa-building absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                    <input id="newName" type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Downtown Center" required className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all outline-none text-sm" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="newPhone" className="text-[10px] font-bold text-gray-400 uppercase ml-1">Contact Phone</label>
                                <div className="relative">
                                    <i className="fa-solid fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                    <input id="newPhone" type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone Number(s)" required className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all outline-none text-sm" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="newAddress" className="text-[10px] font-bold text-gray-400 uppercase ml-1">Physical Address</label>
                            <div className="relative">
                                <i className="fa-solid fa-map-location-dot absolute left-3 top-3 text-gray-400 text-xs"></i>
                                <textarea id="newAddress" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Complete Street Address" className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all outline-none text-sm" rows={2} required></textarea>
                            </div>
                        </div>

                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2 text-sm w-full sm:w-auto">
                            <i className="fa-solid fa-plus-circle"></i> Create Branch Account
                        </button>
                    </form>
                </fieldset>


                {/* Existing Branches Table */}
                <div className="relative flex flex-col">
                    <div className="md:absolute static top-0 right-6 md:-translate-y-[5px] mb-4 md:mb-0 flex justify-end order-1 md:order-none">
                        <div className="search-container w-full md:w-64 bg-white shadow-sm md:shadow-none">
                            <i className="fa-solid fa-magnifying-glass text-gray-700 text-xs mr-2"></i>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search by name..."
                                className="search-input"
                            />
                        </div>
                    </div>

                    <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl order-2 min-w-0">
                        <legend className="px-3 flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                <i className="fa-solid fa-code-branch text-xs"></i>
                            </div>
                            <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">Branch Directory</span>
                        </legend>

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full min-w-[800px] bg-white divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Identity</th>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Location</th>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Contact</th>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Status</th>
                                        <th className="py-3 px-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="text-center py-12 text-sm text-gray-400 italic">Syncing branch database...</td></tr>
                                    ) : filteredBranches.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-12 text-sm text-gray-400 italic">No branches matching your search.</td></tr>
                                    ) : (
                                        filteredBranches.map(branchItem => (
                                            <tr key={branchItem.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="py-3 px-4">
                                                    <div className="text-sm font-bold text-gray-800">{branchItem.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono italic">REF: #{branchItem.id.toString().padStart(3, '0')}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-xs text-gray-600 max-w-[200px] truncate" title={branchItem.address}>{branchItem.address}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-xs text-gray-600 font-mono">{branchItem.phone}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-green-50 text-green-600 border-green-100 uppercase tracking-tighter">Operational</span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex justify-end gap-1.5 transition-opacity">
                                                        <button onClick={() => setEditingBranch(branchItem)} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-blue-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm" title="Edit Metadata">
                                                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                        </button>
                                                        <button onClick={() => handleDeleteBranch(branchItem.id)} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-red-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm" title="Remove Branch">
                                                            <i className="fa-solid fa-trash-can text-xs"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </fieldset>
                </div>
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
