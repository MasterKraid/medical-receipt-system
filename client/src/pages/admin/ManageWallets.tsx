import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import ChoiceModal from '../../components/ChoiceModal';
import { apiService } from '../../services/api';
import { User, Transaction } from '../../types';

const ManageWallets: React.FC = () => {
    const [clients, setClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
    const [historyClient, setHistoryClient] = useState<User | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Choice Modal State
    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
    const [pendingTxId, setPendingTxId] = useState<number | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<User | null>(null);
    const [action, setAction] = useState<'add' | 'deduct' | 'settle' | null>(null);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchClients(searchTerm);
    }, [searchTerm]);

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

    const openHistoryModal = async (client: User) => {
        setHistoryClient(client);
        setIsHistoryModalOpen(true);
        setIsLoadingHistory(true);
        try {
            const data = await apiService.getTransactionsByUser(client.id);
            setHistoryTransactions(data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleRevert = async (txId: number) => {
        try {
            await apiService.revertTransaction(txId);
            if (historyClient) openHistoryModal(historyClient);
            fetchClients(searchTerm);
        } catch (error) {
            alert(`Error reverting: ${error}`);
        }
    };

    const handleSimpleDelete = async (txId: number) => {
        try {
            await apiService.deleteTransactionRecord(txId);
            if (historyClient) openHistoryModal(historyClient);
            fetchClients(searchTerm);
        } catch (error) {
            alert(`Error deleting: ${error}`);
        }
    };

    const openModal = (client: User, act: 'add' | 'deduct' | 'settle') => {
        setEditingClient(client);
        setAction(act);
        setIsModalOpen(true);
        setAmount('');
        setNotes('');
    };

    const handleWalletUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingClient || !action) return;
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
        if (allow) {
            const dateStr = prompt("Limit negative exposure? (Enter date YYYY-MM-DD or leave blank)", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            if (dateStr !== null) until = dateStr || undefined;
            else return;
        }

        try {
            await apiService.updateWalletPermissions(client.id, allow, until);
            fetchClients(searchTerm);
        } catch (error) {
            alert(`Error updating permissions: ${error}`);
        }
    }

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Wallet Management" />

                <div className="relative flex flex-col">
                    <div className="md:absolute static top-0 right-6 md:-translate-y-[5px] mb-4 md:mb-0 flex justify-end order-1 md:order-none">
                        <div className="search-container w-full md:w-64 bg-white shadow-sm md:shadow-none">
                            <i className="fa-solid fa-magnifying-glass text-gray-700 text-xs mr-2"></i>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search clients..."
                                className="search-input"
                            />
                        </div>
                    </div>

                    <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl order-2">
                        <legend className="px-3 flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                <i className="fa-solid fa-wallet text-xs"></i>
                            </div>
                            <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">Account Directory</span>
                        </legend>

                        {isLoading && clients.length === 0 ? (
                            <div className="py-20 text-center">
                                <i className="fa-solid fa-spinner fa-spin text-xl text-gray-300 mb-2"></i>
                                <p className="text-gray-400 italic text-sm">Accessing ledger records...</p>
                            </div>
                        ) : clients.length === 0 ? (
                            <div className="py-20 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No records match your search criteria</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {clients.map(client => (
                                    <div key={client.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col">
                                        <div className={`absolute top-0 left-0 w-1 h-full ${client.wallet_balance < 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>

                                        <div className="flex justify-between items-start mb-3">
                                            <div className="pl-1">
                                                <h3 className="font-bold text-gray-800 text-sm leading-tight">{client.alias || client.username}</h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{client.username} <span className="ml-1 opacity-50 font-mono">#ID:{client.id.toString().padStart(4, '0')}</span></p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={() => openHistoryModal(client)} className="w-6 h-6 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-800 hover:text-white rounded-md border border-slate-100 transition-all" title="Client Wallet History">
                                                    <i className="fa-solid fa-cog text-[10px]"></i>
                                                </button>
                                                <div className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${client.wallet_balance < 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                                    {client.wallet_balance < 0 ? 'DUE' : 'CLEAR'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 rounded-lg p-3 mb-4 flex justify-between items-center border border-gray-100">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Balance</span>
                                            <span className={`text-lg font-bold ${client.wallet_balance < 0 ? 'text-red-700' : 'text-green-700'}`}>
                                                ₹{Math.abs(client.wallet_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                {client.wallet_balance < 0 && <span className="text-[10px] ml-1 opacity-50 font-normal">Dr</span>}
                                            </span>
                                        </div>

                                        <div className="flex-grow space-y-3 mb-6">
                                            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                                <label className="flex items-center gap-2 cursor-pointer group/label">
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${client.allow_negative_balance ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'}`}>
                                                        {!!client.allow_negative_balance && <i className="fa-solid fa-check text-[8px]"></i>}
                                                    </div>
                                                    <input type="checkbox" className="hidden" checked={!!client.allow_negative_balance} onChange={() => handlePermissionChange(client, !client.allow_negative_balance)} />
                                                    <span className="text-[11px] font-bold text-gray-600 uppercase group-hover/label:text-blue-600">Allow Negative</span>
                                                </label>
                                                <i className="fa-solid fa-shield-halved text-gray-300 text-xs"></i>
                                            </div>

                                            {!!client.allow_negative_balance && (
                                                <div className="flex items-center gap-1.5 px-1">
                                                    <i className="fa-solid fa-clock text-[9px] text-gray-300"></i>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">
                                                        Valid: <span className="text-gray-600 font-bold ml-1">{client.negative_balance_allowed_until ? new Date(client.negative_balance_allowed_until).toLocaleDateString('en-GB') : 'UNLIMITED'}</span>
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-1.5">
                                            <button onClick={() => openModal(client, 'add')} className="flex flex-col items-center justify-center py-1.5 px-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-600 hover:text-white transition-all border border-green-100 shadow-sm">
                                                <i className="fa-solid fa-plus text-[9px] mb-0.5"></i>
                                                <span className="text-[8px] font-black uppercase">Credit</span>
                                            </button>
                                            <button onClick={() => openModal(client, 'deduct')} className="flex flex-col items-center justify-center py-1.5 px-1 bg-red-50 text-red-700 rounded-lg hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm">
                                                <i className="fa-solid fa-minus text-[9px] mb-0.5"></i>
                                                <span className="text-[8px] font-black uppercase">Debit</span>
                                            </button>
                                            <button onClick={() => openModal(client, 'settle')} className="flex flex-col items-center justify-center py-1.5 px-1 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-800 hover:text-white transition-all border border-gray-100 shadow-sm">
                                                <i className="fa-solid fa-check-double text-[9px] mb-0.5"></i>
                                                <span className="text-[8px] font-black uppercase">Settle</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </fieldset>
                </div>

                {/* Transaction Modal */}
                {isModalOpen && editingClient && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                        <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm border border-gray-200">
                            <form onSubmit={handleWalletUpdate} className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm ${action === 'add' ? 'bg-green-600' : action === 'deduct' ? 'bg-red-600' : 'bg-gray-800'}`}>
                                        <i className={`fa-solid ${action === 'add' ? 'fa-plus' : action === 'deduct' ? 'fa-minus' : 'fa-check-double'} text-xs`}></i>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800 uppercase tracking-tight">{action} Funds</h2>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{editingClient.alias || editingClient.username}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {action !== 'settle' && (
                                        <div className="space-y-1">
                                            <label htmlFor="amount" className="text-[10px] font-bold text-gray-400 uppercase ml-1">Amount (₹)</label>
                                            <input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-50 outline-none text-lg font-bold" step="0.01" />
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <label htmlFor="notes" className="text-[10px] font-bold text-gray-400 uppercase ml-1">Reference Notes</label>
                                        <textarea id="notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Transaction details..." className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-50 outline-none text-sm" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-gray-300">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 transition-all text-xs">Cancel</button>
                                    <button type="submit" className={`px-4 py-2 text-white font-bold rounded-lg shadow-sm transition-all text-xs ${action === 'add' ? 'bg-green-600 hover:bg-green-700' : action === 'deduct' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-black'}`}>
                                        Confirm {action}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* Transaction History Modal (Cog) */}
                {isHistoryModalOpen && historyClient && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white">
                                        <i className="fa-solid fa-clock-rotate-left"></i>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Wallet Ledger</h2>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{historyClient.alias || historyClient.username}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white text-gray-400 hover:text-red-500 rounded-lg border border-gray-100 transition-all">
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center px-6">
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Available Balance</span>
                                <span className={`text-xl font-bold ${historyClient.wallet_balance < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                                    ₹{Math.abs(historyClient.wallet_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    {historyClient.wallet_balance < 0 && <span className="text-xs ml-1 opacity-50 uppercase">Dr</span>}
                                </span>
                            </div>

                            <div className="flex-grow overflow-y-auto p-4 space-y-3">
                                {isLoadingHistory ? (
                                    <div className="py-20 text-center"><i className="fa-solid fa-spinner fa-spin text-slate-300 mr-2"></i>Accessing history...</div>
                                ) : historyTransactions.length === 0 ? (
                                    <div className="py-20 text-center text-gray-400 italic">No transactions found.</div>
                                ) : (
                                    historyTransactions.map(tx => (
                                        <div key={tx.id} className="p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition-colors flex justify-between items-center group">
                                            <div className="flex-grow">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`w-2 h-2 rounded-full ${tx.amount_deducted > 0 ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                                    <p className="text-sm font-bold text-gray-800">
                                                        {tx.type === 'RECEIPT_DEDUCTION' ? `Receipt #RCPT-${String(tx.receipt_id).padStart(6, '0')}` :
                                                            tx.type === 'ADMIN_CREDIT' ? 'Credit Added' :
                                                                tx.type === 'ADMIN_DEBIT' ? 'Funds Deducted' : 'Wallet Settlement'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                                                    <span>{tx.date.split(' | ')[0]}</span>
                                                    <span>•</span>
                                                    <span className="text-gray-500 italic">{tx.notes || 'No reference notes'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <p className={`text-sm font-black ${tx.amount_deducted > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {tx.amount_deducted > 0 ? '-' : '+'} ₹{Math.abs(tx.amount_deducted).toFixed(2)}
                                                    </p>
                                                    <p className="text-[9px] text-gray-400 font-mono">Bal: ₹{Number(tx.balance_snapshot || 0).toFixed(2)}</p>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                    <button onClick={() => {
                                                        setPendingTxId(tx.id);
                                                        setIsChoiceModalOpen(true);
                                                    }} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white border border-red-100 transition-all">
                                                        <i className="fa-solid fa-trash-can text-xs"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <ChoiceModal
                    isOpen={isChoiceModalOpen}
                    onClose={() => setIsChoiceModalOpen(false)}
                    title="Manage Transaction"
                    message="Choose how you would like to undo this transaction. Reverting will nuclear the related receipt, while Delete will only remove this record."
                    onRevert={() => pendingTxId && handleRevert(pendingTxId)}
                    onDelete={() => pendingTxId && handleSimpleDelete(pendingTxId)}
                />
            </div>
        </div >
    );
};

export default ManageWallets;