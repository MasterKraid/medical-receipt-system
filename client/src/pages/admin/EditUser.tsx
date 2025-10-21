import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { User, Branch, PackageList } from '../../types';

const EditUser: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [user, setUser] = useState<User | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [packageLists, setPackageLists] = useState<PackageList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
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
                const [userData, branchesData, listsData] = await Promise.all([
                    apiService.getUserById(userId),
                    apiService.getBranches(),
                    apiService.getPackageLists()
                ]);

                if(userData) {
                    setUser(userData);
                    setAssignedLists(new Set(userData.assigned_list_ids || []));
                }
                setBranches(branchesData);
                setPackageLists(listsData);
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
    
    if (isLoading) return <div className="p-8">Loading...</div>;
    if (!user) return <div className="p-8">User not found.</div>;

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <PageHeader title={`Edit User: ${user.username}`} backLink="/admin/users" backText="Back to Users" />
                
                <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    {/* User Details */}
                    <section>
                        <h2 className="text-lg font-semibold mb-2">User Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label>Username</label>
                                <input type="text" name="username" value={user.username} onChange={handleInputChange} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label>Alias</label>
                                <input type="text" name="alias" value={user.alias || ''} onChange={handleInputChange} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label>New Password</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep unchanged" className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label>Branch</label>
                                <select name="branchId" value={user.branchId} onChange={handleInputChange} className="w-full p-2 border rounded">
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                             <div>
                                <label>Role</label>
                                <select name="role" value={user.role} onChange={handleInputChange} className="w-full p-2 border rounded">
                                     <option value="GENERAL_EMPLOYEE">General Employee</option>
                                    <option value="CLIENT">Client</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Rate Database Access */}
                    <section>
                        <h2 className="text-lg font-semibold mb-2">Rate Database Access</h2>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 border rounded-md max-h-40 overflow-y-auto">
                            {packageLists.map(list => (
                                <label key={list.id} className="flex items-center space-x-2">
                                    <input type="checkbox" checked={assignedLists.has(list.id)} onChange={() => handleListToggle(list.id)} />
                                    <span>{list.name}</span>
                                </label>
                            ))}
                        </div>
                    </section>
                    
                    <div className="flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditUser;