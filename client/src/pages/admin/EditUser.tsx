import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import CleanSelect from '../../components/CleanSelect';
import { apiService } from '../../services/api';
import { User, Branch, PackageList, Lab } from '../../types';
import RateListAccessModal from '../../components/RateListAccessModal';

const EditUser: React.FC = () => {
    const { id } = useParams() as { id: string };
    const navigate = useNavigate();

    const [user, setUser] = useState<User | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [packageLists, setPackageLists] = useState<PackageList[]>([]);
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);

    // Form state
    const [password, setPassword] = useState('');
    const [assignedLists, setAssignedLists] = useState<Set<number>>(new Set());

    useEffect(() => {
        const userId = Number(id);
        if (isNaN(userId)) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const [userData, branchesData, listsData, labsData] = await Promise.all([
                    apiService.getUserById(userId),
                    apiService.getBranches(),
                    apiService.getPackageLists(),
                    apiService.getLabs()
                ]);

                if (userData) {
                    setUser(userData);
                    setAssignedLists(new Set(userData.assigned_list_ids || []));
                }
                setBranches(branchesData);
                setPackageLists(listsData);
                setLabs(labsData);
            } catch (error) {
                console.error("Failed to fetch data for editing user", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (user) {
            let parsedValue: string | number = value;
            if (name === 'branchId') parsedValue = parseInt(value, 10);
            setUser({ ...user, [name]: parsedValue });
        }
    };

    const handleListToggle = (listId: number) => {
        setAssignedLists(prev => {
            const newSet = new Set(prev);
            if (newSet.has(listId)) newSet.delete(listId);
            else newSet.add(listId);
            return newSet;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const updatedUserData = { ...user, assigned_list_ids: Array.from(assignedLists) };

        if (password) {
            (updatedUserData as any).password_hash = password;
        }

        try {
            await apiService.updateUser(updatedUserData);
            navigate('/admin/users');
        } catch (error) {
            alert(`Failed to update user: ${error}`);
        }
    };

    if (isLoading) return <div className="p-8 text-center italic text-gray-400 font-medium">Authenticating credentials and retrieving profile...</div>;
    if (!user) return <div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-xl m-8 border border-red-100 italic">User profile not found in active directory.</div>;

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100">
                <PageHeader title={`Modify Access: ${user.alias || user.username}`} backLink="/admin/users" backText="Return to Directory" />

                <form onSubmit={handleSubmit} className="mt-8 space-y-8">
                    {/* User Details Section */}
                    <fieldset className="border-2 border-gray-300 p-6 rounded-xl">
                        <legend className="px-3 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-user-gear text-sm"></i>
                            </div>
                            <span className="text-xl font-bold text-gray-800">Account Credentials</span>
                        </legend>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Username / ID</label>
                                <div className="relative">
                                    <i className="fa-solid fa-at absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                    <input type="text" name="username" value={user.username} onChange={handleInputChange} className="w-full pl-10 p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Display Alias</label>
                                <div className="relative">
                                    <i className="fa-solid fa-address-card absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                    <input type="text" name="alias" value={user.alias || ''} onChange={handleInputChange} className="w-full pl-10 p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Update Password</label>
                                <div className="relative">
                                    <i className="fa-solid fa-shield-halved absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to maintain current" className="w-full pl-10 p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Assigned Branch</label>
                                    <CleanSelect
                                        options={branches.map(b => ({ value: b.id, label: b.name }))}
                                        value={user.branchId}
                                        onChange={val => setUser({ ...user, branchId: val })}
                                        placeholder="Select Branch"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">System Role</label>
                                    <CleanSelect
                                        options={[
                                            { value: 'GENERAL_EMPLOYEE', label: 'General Employee' },
                                            { value: 'CLIENT', label: 'B2B Client' },
                                            { value: 'ADMIN', label: 'Administrator' }
                                        ]}
                                        value={user.role}
                                        onChange={val => setUser({ ...user, role: val })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={() => setIsAccessModalOpen(true)}
                                    className={`w-full p-3 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2 font-bold ${assignedLists.size > 0
                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                                        }`}
                                >
                                    <i className="fa-solid fa-key-skeleton"></i>
                                    Modify Rate List Access {assignedLists.size > 0 && <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] ml-1">{assignedLists.size}</span>}
                                </button>
                            </div>
                        </div>
                    </fieldset>

                    <div className="pt-6 border-t border-gray-300 flex justify-end gap-3">
                        <button type="button" onClick={() => navigate('/admin/users')} className="px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm">
                            Cancel Changes
                        </button>
                        <button type="submit" className="px-10 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 text-sm">
                            Update Account Details <i className="fa-solid fa-circle-check"></i>
                        </button>
                    </div>
                </form>
            </div>

            <RateListAccessModal
                isOpen={isAccessModalOpen}
                onClose={() => setIsAccessModalOpen(false)}
                labs={labs}
                packageLists={packageLists}
                selectedListIds={assignedLists}
                onToggle={handleListToggle}
            />
        </div>
    );
};

export default EditUser;