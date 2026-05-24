import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { User, Document } from '../../types';
import SearchableDropdown from '../../components/SearchableDropdown';

const ReceiptReport: React.FC = () => {
    const [clients, setClients] = useState<User[]>([]);
    const [receipts, setReceipts] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filter states
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [fetchedClients, fetchedReceipts] = await Promise.all([
                    apiService.getClientWallets(),
                    apiService.getReceipts()
                ]);
                setClients(fetchedClients);
                setReceipts(fetchedReceipts);
            } catch (err) {
                console.error("Failed to load report data", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Filter logic
    const filteredReceipts = receipts.filter(r => {
        if (selectedClientId) {
            const clientIdNum = parseInt(selectedClientId, 10);
            // Receipt belongs to selected client either if acting-as is selected client OR
            // if acting-as is empty but the creator is the selected client
            const matchesClient = r.acting_as_client_id === clientIdNum || 
                (!r.acting_as_client_id && r.created_by_user_id === clientIdNum);
            if (!matchesClient) return false;
        }

        if (startDate || endDate) {
            const parts = r.display_date.split(' ');
            if (parts[0]) {
                const [day, month, year] = parts[0].split('/').map(Number);
                const rDate = new Date(year, month - 1, day);
                
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (rDate < start) return false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (rDate > end) return false;
                }
            }
        }
        return true;
    });

    // Calculate metrics
    const totalCount = filteredReceipts.length;
    const totalAmount = filteredReceipts.reduce((sum, r) => {
        const valStr = r.display_amount.replace('₹', '').replace(/,/g, '');
        return sum + parseFloat(valStr || '0');
    }, 0);

    const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    const selectedClientObj = clients.find(c => c.id.toString() === selectedClientId);
    const clientNameText = selectedClientObj ? (selectedClientObj.alias || selectedClientObj.username) : 'All Clients';

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 print:p-0 print:max-w-full">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-6 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            <i className="fa-solid fa-chart-line text-indigo-600 print:hidden"></i>
                            Client Receipt Report
                        </h1>
                        <p className="text-xs text-gray-500 mt-1 font-medium">
                            Analyze receipt generations, revenue streams, and operator distributions.
                        </p>
                    </div>
                    <div className="print:hidden">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 text-sm"
                        >
                            <i className="fa-solid fa-print"></i>
                            Print / Save as PDF
                        </button>
                    </div>
                </div>

                {/* Filter Panel */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 print:hidden">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Filter Generation Data</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* Client Selector */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Client / Wallet Owner</label>
                            <SearchableDropdown
                                options={[
                                    { value: '', label: 'All Clients / Operators' },
                                    ...clients.map(c => ({ value: c.id.toString(), label: c.alias || c.username }))
                                ]}
                                value={selectedClientId}
                                onChange={(val) => setSelectedClientId(val)}
                                placeholder="Search client..."
                            />
                        </div>

                        {/* Start Date */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-50 outline-none text-sm font-bold text-gray-700"
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-50 outline-none text-sm font-bold text-gray-700"
                            />
                        </div>

                    </div>
                </div>

                {/* Printable Report Summary Meta (Only visible when printing or as summary header) */}
                <div className="hidden print:block mb-6 border-b pb-4">
                    <h2 className="text-lg font-bold text-gray-800">Statement of Receipt Generation</h2>
                    <div className="grid grid-cols-2 gap-4 mt-2 text-xs text-gray-600">
                        <div>
                            <strong>Target Client:</strong> {clientNameText}
                        </div>
                        <div>
                            <strong>Period:</strong> {startDate || 'Beginning'} to {endDate || 'Present'}
                        </div>
                        <div>
                            <strong>Generated At:</strong> {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
                        </div>
                    </div>
                </div>

                {/* Summary Metrics Cards */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                        <i className="fa-solid fa-spinner fa-spin text-3xl"></i>
                        <span className="text-xs font-bold uppercase tracking-widest italic">Computing Statement...</span>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-between">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Total Generated</span>
                                <div className="mt-2">
                                    <span className="text-3xl font-black text-indigo-900">{totalCount}</span>
                                    <span className="text-xs font-bold text-indigo-600 ml-2">Receipts</span>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-between">
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Aggregate Revenue</span>
                                <div className="mt-2">
                                    <span className="text-3xl font-black text-emerald-900">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-xl border border-purple-100 flex flex-col justify-between">
                                <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Average Value</span>
                                <div className="mt-2">
                                    <span className="text-3xl font-black text-purple-900">₹{averageAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                        </div>

                        {/* Receipts Table */}
                        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm print:shadow-none print:border-none">
                            <table className="w-full min-w-[700px] text-left border-collapse print:min-w-full">
                                <thead className="bg-gray-50 print:bg-transparent">
                                    <tr className="border-b border-gray-200">
                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-4">Receipt ID</th>
                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date / Time</th>
                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Patient Name</th>
                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer ID</th>
                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Operator Context</th>
                                        <th className="p-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest pr-4">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {filteredReceipts.map(receipt => (
                                        <tr key={receipt.id} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="p-3 pl-4 font-bold text-gray-800 font-mono">
                                                {receipt.display_doc_id}
                                            </td>
                                            <td className="p-3 text-gray-500 text-xs">
                                                {receipt.display_date}
                                            </td>
                                            <td className="p-3 text-gray-700 font-bold">
                                                {receipt.customer_name}
                                            </td>
                                            <td className="p-3 text-gray-500 text-xs font-mono">
                                                {receipt.display_customer_id}
                                            </td>
                                            <td className="p-3 text-gray-600 text-xs font-medium">
                                                {receipt.created_by_user}
                                            </td>
                                            <td className="p-3 text-right pr-4 font-bold text-gray-900">
                                                {receipt.display_amount}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredReceipts.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-10 text-center text-gray-400 italic text-xs uppercase font-bold tracking-widest">
                                                No receipts match the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};

export default ReceiptReport;
