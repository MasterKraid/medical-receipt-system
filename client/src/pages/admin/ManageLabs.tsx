import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { Lab, PackageList } from '../../types';

const ManageLabs: React.FC = () => {
    const [labs, setLabs] = useState<Lab[]>([]);
    const [allLists, setAllLists] = useState<PackageList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLab, setEditingLab] = useState<Lab | null>(null);
    const [assignedLists, setAssignedLists] = useState<Set<number>>(new Set());

    // New Lab Form
    const [newLabName, setNewLabName] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [labsData, listsData] = await Promise.all([
                apiService.getLabs(),
                apiService.getPackageLists()
            ]);
            setLabs(labsData);
            setAllLists(listsData);
        } catch (error) {
            console.error("Failed to fetch lab data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredLabs = React.useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return labs;
        return labs.filter(l => l.name.toLowerCase().includes(query));
    }, [labs, searchTerm]);

    const handleAddLab = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiService.createLab(newLabName);
            setNewLabName('');
            fetchData();
        } catch (error) {
            alert(`Error adding lab: ${error}`);
        }
    };

    const handleDeleteLab = async (labId: number) => {
        if (window.confirm("Are you sure you want to delete this lab? This action cannot be undone.")) {
            try {
                await apiService.deleteLab(labId);
                fetchData();
            } catch (error) {
                alert(`Error deleting lab: ${error}`);
            }
        }
    };

    const openEditModal = (lab: Lab) => {
        setEditingLab(lab);
        setAssignedLists(new Set(lab.assigned_list_ids || []));
        setIsModalOpen(true);
    };

    const handleListToggle = (listId: number) => {
        setAssignedLists(prev => {
            const newSet = new Set(prev);
            if (newSet.has(listId)) newSet.delete(listId);
            else newSet.add(listId);
            return newSet;
        });
    };

    const handleUpdateAssignments = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLab) return;
        try {
            await apiService.updateLabLists(editingLab.id, Array.from(assignedLists));
            setIsModalOpen(false);
            setEditingLab(null);
            fetchData();
        } catch (error) {
            alert(`Error updating assignments: ${error}`);
        }
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Lab & Rate Management" />

                <section className="mb-10">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-300 pb-2">
                        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <i className="fa-solid fa-flask-vial text-xs"></i>
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Add New Laboratory</h2>
                    </div>

                    <form onSubmit={handleAddLab} className="flex flex-col sm:flex-row items-end gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                        <div className="flex-grow w-full space-y-1">
                            <label htmlFor="newLabName" className="text-[10px] font-bold text-gray-400 uppercase ml-1">Official Lab Name</label>
                            <div className="relative">
                                <i className="fa-solid fa-signature absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                <input id="newLabName" type="text" value={newLabName} onChange={e => setNewLabName(e.target.value)} placeholder="e.g. Apollo Diagnostics" required className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-50 outline-none transition-all text-sm" />
                            </div>
                        </div>
                        <button type="submit" className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap text-sm h-[38px]">
                            <i className="fa-solid fa-plus-circle"></i> Create Lab
                        </button>
                    </form>
                </section>

                <hr className="my-10 border-gray-300" />

                <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-300 pb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                <i className="fa-solid fa-list-check text-xs"></i>
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">Laboratory Directory</h2>
                        </div>

                        <div className="relative w-full md:w-64">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search labs..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all text-sm"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full bg-white divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Lab Details</th>
                                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Assigned Rate Databases</th>
                                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Branding</th>
                                    <th className="py-3 px-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {isLoading ? (
                                    <tr><td colSpan={4} className="text-center py-12 text-gray-400 italic text-sm">Synchronizing lab data...</td></tr>
                                ) : filteredLabs.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-12 text-gray-400 italic text-sm">No laboratories matching your search found.</td></tr>
                                ) : (
                                    filteredLabs.map(lab => (
                                        <tr key={lab.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="py-3 px-4 font-bold text-gray-800 text-sm whitespace-nowrap">{lab.name}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="text-[11px] text-gray-500 max-w-xs line-clamp-2">
                                                        {lab.assigned_list_ids?.length
                                                            ? lab.assigned_list_ids.map(id => allLists.find(l => l.id === id)?.name).join(', ')
                                                            : <span className="italic text-gray-300">No rates assigned</span>
                                                        }
                                                    </div>
                                                    <button onClick={() => openEditModal(lab)} className="p-1 px-2 bg-blue-50 text-blue-600 rounded border border-blue-100 text-[9px] font-bold hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap">
                                                        <i className="fa-solid fa-sync mr-1"></i> Sync Rates
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {lab.logo_path ? (
                                                    <div className="h-8 w-20 bg-gray-50 rounded border border-gray-100 overflow-hidden flex items-center justify-center p-1 shadow-sm">
                                                        <img src={lab.logo_path} alt={lab.name} className="h-full w-full object-contain" />
                                                    </div>
                                                ) : (
                                                    <div className="text-[9px] text-gray-300 font-bold border border-dashed border-gray-200 rounded px-1.5 py-0.5 inline-block">NO LOGO</div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => handleDeleteLab(lab.id)} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-red-600 hover:text-white rounded border border-gray-100 transition-all" title="Retire Laboratory">
                                                    <i className="fa-solid fa-trash-can text-xs"></i>
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

            {/* Edit Assignments Modal */}
            {isModalOpen && editingLab && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 flex flex-col max-h-[85vh]">
                        <form onSubmit={handleUpdateAssignments} className="flex flex-col h-full">
                            <div className="flex items-center gap-3 mb-6 border-b border-gray-300 pb-4">
                                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
                                    <i className="fa-solid fa-database text-xs"></i>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">Assign Rate Databases</h2>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{editingLab.name}</p>
                                </div>
                            </div>

                            <div className="space-y-1 flex-grow overflow-y-auto pr-2 custom-scrollbar-minimal my-2">
                                {allLists.map(list => (
                                    <label key={list.id} className={`flex items-center space-x-3 px-3 py-2 rounded-lg border transition-all cursor-pointer ${assignedLists.has(list.id) ? 'bg-blue-600 border-blue-700 text-white shadow-sm' : 'bg-gray-50 border-gray-100 hover:border-gray-200 text-gray-600'}`}>
                                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${assignedLists.has(list.id) ? 'bg-white border-white text-blue-600' : 'bg-white border-gray-300'}`}>
                                            {assignedLists.has(list.id) && <i className="fa-solid fa-check text-[8px]"></i>}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={assignedLists.has(list.id)} onChange={() => handleListToggle(list.id)} />
                                        <span className="font-semibold text-xs truncate">{list.name}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-300">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all font-bold text-xs">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all font-bold text-xs">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageLabs;