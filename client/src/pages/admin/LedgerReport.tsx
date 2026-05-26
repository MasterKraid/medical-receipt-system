import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../../services/api';
import { User, Transaction } from '../../types';
import PageHeader from '../../components/PageHeader';
import SearchableDropdown from '../../components/SearchableDropdown';

const LedgerReport: React.FC = () => {
  const [clients, setClients] = useState<User[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);

  useEffect(() => {
    // Load B2B clients
    apiService.getClientWallets()
      .then(data => {
        setClients(data);
        if (data.length > 0) {
          setSelectedClientId(data[0].id.toString());
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    const clientIdNum = parseInt(selectedClientId, 10);
    
    setLoadingTxs(true);
    Promise.all([
      apiService.getTransactionsByUser(clientIdNum),
      apiService.getUserById(clientIdNum)
    ]).then(([txsData, clientData]) => {
      // API returns sorted by ID DESC. Let's keep it sorted DESC but we will parse dates for filters.
      setTransactions(txsData);
      setSelectedClient(clientData);
    }).catch(console.error)
      .finally(() => setLoadingTxs(false));
  }, [selectedClientId]);

  // Parse transaction date DD/MM/YYYY | HH:mm:ss to JS Date
  const parseTxDate = (dateStr: string): Date => {
    try {
      const datePart = dateStr.split(' | ')[0]; // "DD/MM/YYYY"
      const [d, m, y] = datePart.split('/').map(Number);
      return new Date(y, m - 1, d);
    } catch (e) {
      return new Date();
    }
  };

  // Filtered transactions list
  const filteredTxs = useMemo(() => {
    // Sort chronological (ID ASC) to calculate starting/ending balances correctly
    const chronological = [...transactions].sort((a, b) => a.id - b.id);
    
    return chronological.filter(tx => {
      const txDate = parseTxDate(tx.date);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (txDate < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (txDate > end) return false;
      }
      
      return true;
    });
  }, [transactions, startDate, endDate]);

  // Calculations for starting balance, total credits, total debits, and ending balance
  const ledgerMetrics = useMemo(() => {
    let startingBalance = 0;
    let totalCredits = 0;
    let totalDebits = 0;
    
    if (filteredTxs.length === 0) {
      // If no transactions in filtered period, starting and ending balance matches current client balance
      const currentBal = selectedClient?.wallet_balance || 0;
      return { startingBalance: currentBal, totalCredits: 0, totalDebits: 0, endingBalance: currentBal };
    }

    // Since filteredTxs is sorted ID ASC (chronological):
    const firstFilteredTx = filteredTxs[0];
    const lastFilteredTx = filteredTxs[filteredTxs.length - 1];

    // Starting Balance calculation:
    // Snapshot after first filtered transaction is firstFilteredTx.balance_snapshot.
    // So starting balance before this transaction is:
    // If it was a credit (amount_deducted < 0), starting balance = snapshot - amount_deducted
    // If it was a debit (amount_deducted > 0), starting balance = snapshot + amount_deducted
    startingBalance = (firstFilteredTx.balance_snapshot || 0) + firstFilteredTx.amount_deducted;

    // Sum credits and debits in the period
    filteredTxs.forEach(tx => {
      if (tx.amount_deducted < 0) {
        totalCredits += Math.abs(tx.amount_deducted);
      } else {
        totalDebits += tx.amount_deducted;
      }
    });

    // Ending Balance:
    const endingBalance = lastFilteredTx.balance_snapshot || 0;

    return {
      startingBalance,
      totalCredits,
      totalDebits,
      endingBalance
    };
  }, [filteredTxs, selectedClient]);

  const clientOptions = useMemo(() => {
    return clients.map(c => ({
      value: c.id.toString(),
      label: `${c.alias || c.username} [UID: ${c.id}]`
    }));
  }, [clients]);

  // Export CSV Statement
  const handleExportCSV = () => {
    if (!selectedClient) return;
    
    const headers = ['Date', 'Type', 'Amount (INR)', 'Balance Snapshot (INR)', 'Description/Notes'];
    const rows = filteredTxs.map(tx => {
      const type = tx.amount_deducted < 0 ? 'CREDIT' : 'DEBIT';
      const amount = Math.abs(tx.amount_deducted).toFixed(2);
      const snapshot = (tx.balance_snapshot || 0).toFixed(2);
      const notes = (tx.notes || '').replace(/,/g, ';'); // Prevent CSV cell splitting
      return [tx.date, type, amount, snapshot, notes];
    });

    const csvContent = [
      `B2B LEDGER STATEMENT - ${selectedClient.alias || selectedClient.username} (UID: ${selectedClient.id})`,
      `Statement Period: ${startDate || 'Beginning'} to ${endDate || 'Present'}`,
      `Starting Balance: INR ${ledgerMetrics.startingBalance.toFixed(2)}`,
      `Ending Balance: INR ${ledgerMetrics.endingBalance.toFixed(2)}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ledger_statement_${selectedClient.username}_${startDate || 'start'}_to_${endDate || 'end'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 print:p-0 print:max-w-full">
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none">
        
        {/* Header - Hidden on Print */}
        <div className="print:hidden">
          <PageHeader title="Franchise Ledger Statements" showActingAs={false} />
        </div>

        {/* Print Only Brand Header */}
        <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-800 m-0">LEDGER STATEMENT</h1>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mt-1">
                Generated via Project LISP Database Portal
              </span>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-slate-700 m-0">{selectedClient?.alias || selectedClient?.username}</h2>
              <span className="text-xs text-slate-400 font-mono">UID: #{selectedClient?.id.toString().padStart(4, '0')}</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Panel - Hidden on Print */}
        <div className="print:hidden grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl items-end mb-6 relative z-30">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">
              B2B Corporate Client
            </label>
            <SearchableDropdown
              options={clientOptions}
              value={selectedClientId}
              onChange={setSelectedClientId}
              placeholder="Select Client..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">
              Start Date Limit
            </label>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl h-10 shadow-sm">
              <i className="fa-solid fa-calendar text-slate-400 text-sm"></i>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border-none outline-none text-xs font-bold text-slate-700 font-mono bg-transparent"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">
              End Date Limit
            </label>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl h-10 shadow-sm">
              <i className="fa-solid fa-calendar text-slate-400 text-sm"></i>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border-none outline-none text-xs font-bold text-slate-700 font-mono bg-transparent"
              />
            </div>
          </div>

          <div className="flex gap-2 h-10 shrink-0">
            <button
              onClick={handlePrint}
              disabled={!selectedClient}
              className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <i className="fa-solid fa-print"></i> Print
            </button>
            <button
              onClick={handleExportCSV}
              disabled={!selectedClient}
              className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <i className="fa-solid fa-file-csv"></i> Export CSV
            </button>
          </div>
        </div>

        {/* Ledger Summary Cards Block */}
        {selectedClient && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Card 1: Starting Balance */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 leading-none">
                Starting Balance
              </span>
              <span className="text-lg font-black text-slate-800 leading-tight">
                ₹{ledgerMetrics.startingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Card 2: Total Credits */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mb-1 leading-none">
                Total Credits / Deposits (+)
              </span>
              <span className="text-lg font-black text-emerald-700 leading-tight">
                ₹{ledgerMetrics.totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Card 3: Total Debits */}
            <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[9px] font-black text-red-650 uppercase tracking-wider mb-1 leading-none">
                Total Spends / Debits (-)
              </span>
              <span className="text-lg font-black text-red-700 leading-tight">
                ₹{ledgerMetrics.totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Card 4: Ending Balance */}
            <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider mb-1 leading-none">
                Ending Wallet Balance
              </span>
              <span className="text-lg font-black text-indigo-900 leading-tight">
                ₹{ledgerMetrics.endingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Ledger Registry Table */}
        {loadingTxs ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-650"></i>
            <span className="text-xs font-bold uppercase tracking-widest italic animate-pulse">
              Computing ledger transactions...
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none">
            <table className="w-full min-w-[700px] text-left border-collapse bg-white print:min-w-full">
              <thead className="bg-slate-50 sticky top-0 backdrop-blur-sm z-10 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 print:bg-slate-100">
                <tr>
                  <th className="p-3 pl-4">Transaction Date</th>
                  <th className="p-3">Reference / Description</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Debit / Credit</th>
                  <th className="p-3 text-right pr-4">Balance Snap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-650">
                {filteredTxs.map((tx) => {
                  const isCredit = tx.amount_deducted < 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/55 transition-colors print:hover:bg-transparent">
                      <td className="p-3 pl-4 font-mono font-medium">{tx.date.split(' | ')[0]}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800 block leading-tight">{tx.notes || 'N/A'}</span>
                        {tx.receipt_id && (
                          <span className="text-[9px] font-mono text-slate-400 font-bold block mt-0.5">
                            RCPT ID: #{String(tx.receipt_id).padStart(6, '0')}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isCredit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-150">
                            CREDIT
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-150">
                            DEBIT
                          </span>
                        )}
                      </td>
                      <td className={`p-3 text-right font-bold text-sm ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                        {isCredit ? '+' : '-'}₹{Math.abs(tx.amount_deducted).toFixed(2)}
                      </td>
                      <td className="p-3 text-right pr-4 font-mono font-bold text-slate-700">
                        ₹{(tx.balance_snapshot || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                {filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 font-bold uppercase tracking-wider italic">
                      No ledger records transacted in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LedgerReport;
