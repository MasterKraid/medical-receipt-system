import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { Lab, PackageList } from '../../types';

const ManageLabs: React.FC = () => {
    const [labs, setLabs] = useState<Lab[]>([]);
    const [allLists, setAllLists] = useState<PackageList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
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
        if(window.confirm("Are you sure you want to delete this lab? This action cannot be undone.")){
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
        if(!editingLab) return;
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
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <PageHeader title="Manage Labs & Rates" />

                <section className="mb-8">
                     <h2 className="text-xl font-semibold mb-4 border-b pb-2">Add New Lab</h2>
                     <form onSubmit={handleAddLab} className="flex items-end gap-4">
                         <div className="flex-grow">
                             <label htmlFor="newLabName" className="block text-sm font-medium text-gray-700">Lab Name</label>
                             <input id="newLabName" type="text" value={newLabName} onChange={e => setNewLabName(e.target.value)} required className="mt-1 w-full p-2 border rounded"/>
                         </div>
                         <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded h-fit">Create Lab</button>
                     </form>
                </section>
                
                <section>
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">Existing Labs</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="py-2 px-4 border-b text-left">Lab</th>
                                    <th className="py-2 px-4 border-b text-left">Assigned Rate Databases</th>
                                    <th className="py-2 px-4 border-b text-left">Logo</th>
                                    <th className="py-2 px-4 border-b text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={4} className="text-center py-4">Loading...</td></tr>
                                ) : (
                                    labs.map(lab => (
                                        <tr key={lab.id}>
                                            <td className="py-2 px-4 border-b font-semibold">{lab.name}</td>
                                            <td className="py-2 px-4 border-b">
                                                <div className="flex items-center gap-4">
                                                    <span>{lab.assigned_list_ids?.map(id => allLists.find(l=>l.id===id)?.name).join(', ') || 'None'}</span>
                                                    <button onClick={() => openEditModal(lab)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">Edit</button>
                                                </div>
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                {lab.logo_path ? <img src={lab.logo_path} alt={lab.name} className="h-8 max-w-24 object-contain" /> : <span className="text-gray-400">No logo</span>}
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                <button onClick={() => handleDeleteLab(lab.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
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
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                        <form onSubmit={handleUpdateAssignments}>
                            <h2 className="text-xl font-bold mb-4">Rate Assignments for {editingLab.name}</h2>
                            <div className="space-y-2 max-h-60 overflow-y-auto border p-4 rounded">
                                {allLists.map(list => (
                                    <label key={list.id} className="flex items-center space-x-3">
                                        <input type="checkbox" checked={assignedLists.has(list.id)} onChange={() => handleListToggle(list.id)} />
                                        <span>{list.name}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="flex justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageLabs;