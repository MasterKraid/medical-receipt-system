import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { User } from '../../types';

const ManageWallets: React.FC = () => {
    const [clients, setClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<User | null>(null);
    const [action, setAction] = useState<'add' | 'deduct' | 'settle' | null>(null);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async (query?: string) => {
        setIsLoading(true);
        try {
            const data = await apiService.getClientWallets(query);
            setClients(data);
        } catch (error) {
            console.error("Failed to fetch client wallets", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchClients(searchTerm);
    }
    
    const openModal = (client: User, act: 'add' | 'deduct' | 'settle') => {
        setEditingClient(client);
        setAction(act);
        setIsModalOpen(true);
        setAmount('');
        setNotes('');
    };

    const handleWalletUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!editingClient || !action) return;
        try {
            await apiService.updateWallet(editingClient.id, action, action !== 'settle' ? parseFloat(amount) : undefined, notes);
            setIsModalOpen(false);
            fetchClients(searchTerm);
        } catch (error) {
            alert(`Error updating wallet: ${error}`);
        }
    };
    
    const handlePermissionChange = async (client: User, allow: boolean) => {
        let until: string | undefined = undefined;
        if(allow) {
            const dateStr = prompt("Allow negative balance until what date? (YYYY-MM-DD)", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            if (dateStr) until = dateStr;
            else return; // User cancelled prompt
        }

        try {
            await apiService.updateWalletPermissions(client.id, allow, until);
            fetchClients(searchTerm);
        } catch (error) {
            alert(`Error updating permissions: ${error}`);
        }
    }


    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <PageHeader title="Manage Client Wallets" />

                <form onSubmit={handleSearch} className="mb-6 flex gap-2">
                    <input 
                        type="search" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by Username or Alias..."
                        className="w-full p-2 border rounded"
                    />
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Search</button>
                </form>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? <p>Loading clients...</p> : clients.map(client => (
                        <div key={client.id} className="border rounded-lg p-4 shadow space-y-3 flex flex-col">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-lg">{client.alias || client.username}</h3>
                                    {client.alias && <p className="text-xs text-gray-500">{client.username}</p>}
                                </div>
                                <span className={`font-bold px-3 py-1 rounded-full text-xs ${client.wallet_balance < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                    ₹{client.wallet_balance.toFixed(2)}
                                </span>
                            </div>
                             <div className="text-xs text-gray-600 flex-grow">
                                <p>Negative Balance: {client.allow_negative_balance ? `Allowed until ${client.negative_balance_allowed_until ? new Date(client.negative_balance_allowed_until).toLocaleDateString('en-GB') : 'N/A'}` : 'Not Allowed'}</p>
                                <button onClick={() => handlePermissionChange(client, !client.allow_negative_balance)} className="text-blue-600 hover:underline">
                                    {client.allow_negative_balance ? 'Disallow Negative' : 'Allow Negative'}
                                </button>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => openModal(client, 'add')} className="flex-1 px-3 py-1 bg-green-500 text-white rounded text-sm">Add</button>
                                <button onClick={() => openModal(client, 'deduct')} className="flex-1 px-3 py-1 bg-red-500 text-white rounded text-sm">Deduct</button>
                                <button onClick={() => openModal(client, 'settle')} className="flex-1 px-3 py-1 bg-gray-500 text-white rounded text-sm">Settle</button>
                             </div>
                        </div>
                    ))}
                </div>
            </div>

            {isModalOpen && editingClient && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                        <form onSubmit={handleWalletUpdate}>
                            <h2 className="text-xl font-bold mb-4 capitalize">{action} for {editingClient.alias || editingClient.username}</h2>
                            {action !== 'settle' && (
                                <div className="mb-4">
                                    <label htmlFor="amount" className="block">Amount</label>
                                    <input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full p-2 border rounded" step="0.01"/>
                                </div>
                            )}
                            <div className="mb-4">
                                <label htmlFor="notes" className="block">Notes (Optional)</label>
                                <input id="notes" type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded" />
                            </div>
                            <div className="flex justify-end gap-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageWallets;