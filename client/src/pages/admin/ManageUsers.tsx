import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { User, Branch, PackageList } from '../../types';
import { useAuth } from '../../context/AuthContext';

const ManageUsers: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [packageLists, setPackageLists] = useState<PackageList[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // New User Form State
    const [username, setUsername] = useState('');
    const [alias, setAlias] = useState('');
    const [password, setPassword] = useState('');
    const [branchId, setBranchId] = useState('');
    const [role, setRole] = useState('GENERAL_EMPLOYEE');
    const [assignedLists, setAssignedLists] = useState<Set<number>>(new Set());
    
    useEffect(() => {
        fetchData();
    }, []);
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersData, branchesData, listsData] = await Promise.all([
                apiService.getUsers(),
                apiService.getBranches(),
                apiService.getPackageLists(),
            ]);
            setUsers(usersData);
            setBranches(branchesData);
            setPackageLists(listsData);
        } catch (error) {
            console.error("Failed to fetch data for user management", error);
        } finally {
            setIsLoading(false);
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
    
    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!branchId) {
            alert("Please select a branch.");
            return;
        }
        try {
            await apiService.createUser({ username, alias, password_hash: password, branchId: parseInt(branchId), role: role as any, assigned_list_ids: Array.from(assignedLists) });
            // Reset form
            setUsername(''); setAlias(''); setPassword(''); setBranchId(''); setRole('GENERAL_EMPLOYEE'); setAssignedLists(new Set());
            fetchData();
        } catch (error) {
            alert(`Error creating user: ${error}`);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) {
            try {
                await apiService.deleteUser(userId);
                fetchData();
            } catch (error) {
                alert(`Error deleting user: ${error}`);
            }
        }
    };

    const getBranchName = (id: number) => branches.find(b => b.id === id)?.name || 'N/A';

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <PageHeader title="Manage Users" />
                
                {/* Add User Form */}
                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">Add New User</h2>
                    <form onSubmit={handleAddUser} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username (e.g., email)" required className="p-2 border rounded" />
                            <input type="text" value={alias} onChange={e => setAlias(e.target.value)} placeholder="Alias (e.g., friendly name)" className="p-2 border rounded" />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="p-2 border rounded" />
                            <select value={branchId} onChange={e => setBranchId(e.target.value)} required className="p-2 border rounded">
                                <option value="">-- Select Branch --</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <select value={role} onChange={e => setRole(e.target.value)} required className="p-2 border rounded">
                                <option value="GENERAL_EMPLOYEE">General Employee</option>
                                <option value="CLIENT">Client</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                         <div>
                            <label className="block font-medium mb-2">Rate Database Access</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 border rounded-md max-h-40 overflow-y-auto">
                                {packageLists.map(list => (
                                    <label key={list.id} className="flex items-center space-x-2">
                                        <input type="checkbox" checked={assignedLists.has(list.id)} onChange={() => handleListToggle(list.id)} />
                                        <span>{list.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create User</button>
                    </form>
                </section>
                
                {/* Existing Users Table */}
                <section>
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">Existing Users</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="py-2 px-4 border-b text-left">Username</th>
                                    <th className="py-2 px-4 border-b text-left">Alias</th>
                                    <th className="py-2 px-4 border-b text-left">Branch</th>
                                    <th className="py-2 px-4 border-b text-left">Role</th>
                                    <th className="py-2 px-4 border-b text-left">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id}>
                                            <td className="py-2 px-4 border-b">{user.username}</td>
                                            <td className="py-2 px-4 border-b">{user.alias || 'N/A'}</td>
                                            <td className="py-2 px-4 border-b">{getBranchName(user.branchId)}</td>
                                            <td className="py-2 px-4 border-b">{user.role}</td>
                                            <td className="py-2 px-4 border-b space-x-2">
                                                <Link to={`/admin/users/edit/${user.id}`} className="px-3 py-1 bg-yellow-500 text-white rounded text-xs">Edit</Link>
                                                {currentUser?.id !== user.id && (
                                                    <button onClick={() => handleDeleteUser(user.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ManageUsers;