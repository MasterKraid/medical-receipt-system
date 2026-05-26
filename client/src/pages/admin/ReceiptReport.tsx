import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/api';
import { User, Document, Transaction } from '../../types';
import SearchableDropdown from '../../components/SearchableDropdown';
import CleanSelect from '../../components/CleanSelect';

const ReceiptReport: React.FC = () => {
    const [clients, setClients] = useState<User[]>([]);
    const [receipts, setReceipts] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'B2B' | 'WALK_IN'>('ALL');
    const [paymentFilter, setPaymentFilter] = useState<string>('');
    const [sizeFilter, setSizeFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Custom interactive SVG tooltip state
    const [tooltip, setTooltip] = useState<{
        x: number;
        y: number;
        show: boolean;
        date: string;
        amount: number;
        mrp: number;
        b2b: number;
        count: number;
        profit: number;
    }>({
        x: 0,
        y: 0,
        show: false,
        date: '',
        amount: 0,
        mrp: 0,
        b2b: 0,
        count: 0,
        profit: 0
    });

    const [activeTab, setActiveTab] = useState<'BI' | 'LEDGER'>('BI');

    // Ledger States
    const [selectedLedgerClientId, setSelectedLedgerClientId] = useState<string>('');
    const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
    const [ledgerEndDate, setLedgerEndDate] = useState<string>('');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTxs, setLoadingTxs] = useState(false);
    const [selectedLedgerClient, setSelectedLedgerClient] = useState<User | null>(null);

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
                if (fetchedClients.length > 0) {
                    setSelectedLedgerClientId(fetchedClients[0].id.toString());
                }
            } catch (err) {
                console.error("Failed to load report data", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (!selectedLedgerClientId) return;
        const clientIdNum = parseInt(selectedLedgerClientId, 10);
        
        setLoadingTxs(true);
        Promise.all([
          apiService.getTransactionsByUser(clientIdNum),
          apiService.getUserById(clientIdNum)
        ]).then(([txsData, clientData]) => {
          setTransactions(txsData);
          setSelectedLedgerClient(clientData);
        }).catch(console.error)
          .finally(() => setLoadingTxs(false));
    }, [selectedLedgerClientId]);

    const parseTxDate = (dateStr: string): Date => {
      try {
        const datePart = dateStr.split(' | ')[0]; // "DD/MM/YYYY"
        const [d, m, y] = datePart.split('/').map(Number);
        return new Date(y, m - 1, d);
      } catch (e) {
        return new Date();
      }
    };

    const filteredTxs = useMemo(() => {
      const chronological = [...transactions].sort((a, b) => a.id - b.id);
      
      return chronological.filter(tx => {
        const txDate = parseTxDate(tx.date);
        
        if (ledgerStartDate) {
          const start = new Date(ledgerStartDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        
        if (ledgerEndDate) {
          const end = new Date(ledgerEndDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
        
        return true;
      });
    }, [transactions, ledgerStartDate, ledgerEndDate]);

    const ledgerMetrics = useMemo(() => {
      let startingBalance = 0;
      let totalCredits = 0;
      let totalDebits = 0;
      
      if (filteredTxs.length === 0) {
        const currentBal = selectedLedgerClient?.wallet_balance || 0;
        return { startingBalance: currentBal, totalCredits: 0, totalDebits: 0, endingBalance: currentBal };
      }

      const firstFilteredTx = filteredTxs[0];
      const lastFilteredTx = filteredTxs[filteredTxs.length - 1];

      startingBalance = (firstFilteredTx.balance_snapshot || 0) + firstFilteredTx.amount_deducted;

      filteredTxs.forEach(tx => {
        if (tx.amount_deducted < 0) {
          totalCredits += Math.abs(tx.amount_deducted);
        } else {
          totalDebits += tx.amount_deducted;
        }
      });

      const endingBalance = lastFilteredTx.balance_snapshot || 0;

      return {
        startingBalance,
        totalCredits,
        totalDebits,
        endingBalance
      };
    }, [filteredTxs, selectedLedgerClient]);

    const clientOptions = useMemo(() => {
      return clients.map(c => ({
        value: c.id.toString(),
        label: `${c.alias || c.username} [UID: ${c.id}]`
      }));
    }, [clients]);

    const handleExportCSV = () => {
      if (!selectedLedgerClient) return;
      
      const headers = ['Date', 'Type', 'Amount (INR)', 'Balance Snapshot (INR)', 'Description/Notes'];
      const rows = filteredTxs.map(tx => {
        const type = tx.amount_deducted < 0 ? 'CREDIT' : 'DEBIT';
        const amount = Math.abs(tx.amount_deducted).toFixed(2);
        const snapshot = (tx.balance_snapshot || 0).toFixed(2);
        const notes = (tx.notes || '').replace(/,/g, ';');
        return [tx.date, type, amount, snapshot, notes];
      });

      const csvContent = [
        `B2B LEDGER STATEMENT - ${selectedLedgerClient.alias || selectedLedgerClient.username} (UID: ${selectedLedgerClient.id})`,
        `Statement Period: ${ledgerStartDate || 'Beginning'} to ${ledgerEndDate || 'Present'}`,
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
      link.setAttribute('download', `ledger_statement_${selectedLedgerClient.username}_${ledgerStartDate || 'start'}_to_${ledgerEndDate || 'end'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handlePrint = () => {
      window.print();
    };

    // Filter logic
    const filteredReceipts = useMemo(() => {
        return receipts.filter(r => {
            // Search query filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase().trim();
                const matchesSearch =
                    r.customer_name.toLowerCase().includes(q) ||
                    r.display_doc_id.toLowerCase().includes(q) ||
                    (r.display_customer_id && r.display_customer_id.toLowerCase().includes(q));
                if (!matchesSearch) return false;
            }

            // B2B Client specific selection filter
            if (selectedClientId) {
                const clientIdNum = parseInt(selectedClientId, 10);
                const matchesClient = r.acting_as_client_id === clientIdNum ||
                    (!r.acting_as_client_id && r.created_by_user_id === clientIdNum);
                if (!matchesClient) return false;
            }

            // Type filter (B2B vs Walk-in)
            if (typeFilter === 'B2B') {
                if (!r.acting_as_client_id) return false;
            } else if (typeFilter === 'WALK_IN') {
                if (r.acting_as_client_id) return false;
            }

            // Payment method filter
            if (paymentFilter) {
                if (paymentFilter === 'B2B_WALLET') {
                    if (!r.acting_as_client_id) return false;
                } else {
                    if (r.acting_as_client_id) return false; // Non-B2B general payments
                    if (r.payment_method?.toUpperCase() !== paymentFilter) return false;
                }
            }

            // Size / value bucket filter
            if (sizeFilter) {
                const amt = r.amount_final || parseFloat(r.display_amount.replace('₹', '').replace(/,/g, '')) || 0;
                if (sizeFilter === 'SMALL' && amt >= 1000) return false;
                if (sizeFilter === 'MEDIUM' && (amt < 1000 || amt > 2500)) return false;
                if (sizeFilter === 'PREMIUM' && (amt < 2500 || amt > 5000)) return false;
                if (sizeFilter === 'ENTERPRISE' && amt <= 5000) return false;
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
    }, [receipts, selectedClientId, startDate, endDate, typeFilter, paymentFilter, sizeFilter, searchQuery]);

    // Grouping & Chart Datasets
    const revenueByDate = useMemo(() => {
        const groups: {
            [date: string]: {
                amount: number;
                mrp: number;
                b2b: number;
                profit: number;
                count: number;
            }
        } = {};

        filteredReceipts.forEach(r => {
            const dateStr = r.display_date.split(' ')[0]; // DD/MM/YYYY
            const amt = r.amount_final || parseFloat(r.display_amount.replace('₹', '').replace(/,/g, '')) || 0;
            const mrp = r.total_mrp || amt;
            const b2b = r.b2b_cost || 0;
            const profit = mrp - b2b;

            if (!groups[dateStr]) {
                groups[dateStr] = { amount: 0, mrp: 0, b2b: 0, profit: 0, count: 0 };
            }
            groups[dateStr].amount += amt;
            groups[dateStr].mrp += mrp;
            groups[dateStr].b2b += b2b;
            groups[dateStr].profit += profit;
            groups[dateStr].count += 1;
        });

        return Object.entries(groups)
            .map(([date, data]) => {
                const [d, m, y] = date.split('/').map(Number);
                return {
                    date,
                    dateObj: new Date(y, m - 1, d),
                    ...data
                };
            })
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    }, [filteredReceipts]);

    const revenueByClient = useMemo(() => {
        const groups: { [client: string]: number } = {};
        filteredReceipts.forEach(r => {
            const client = r.created_by_user || 'Direct Entry';
            const amt = r.amount_final || parseFloat(r.display_amount.replace('₹', '').replace(/,/g, '')) || 0;

            // Clean up the client name string
            const cleanName = client.split(' [M.ENTRY')[0];
            groups[cleanName] = (groups[cleanName] || 0) + amt;
        });
        return Object.entries(groups)
            .map(([client, amount]) => ({ client, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5); // Top 5 clients
    }, [filteredReceipts]);

    const ticketSizeBuckets = useMemo(() => {
        const buckets = {
            'Small (<₹1k)': 0,
            'Medium (₹1k-₹2.5k)': 0,
            'Premium (₹2.5k-₹5k)': 0,
            'Enterprise (>₹5k)': 0
        };
        filteredReceipts.forEach(r => {
            const amt = r.amount_final || parseFloat(r.display_amount.replace('₹', '').replace(/,/g, '')) || 0;
            if (amt < 1000) buckets['Small (<₹1k)']++;
            else if (amt <= 2500) buckets['Medium (₹1k-₹2.5k)']++;
            else if (amt <= 5000) buckets['Premium (₹2.5k-₹5k)']++;
            else buckets['Enterprise (>₹5k)']++;
        });
        return Object.entries(buckets).map(([name, count]) => ({ name, count }));
    }, [filteredReceipts]);

    // Calculate metrics
    const totalCount = filteredReceipts.length;
    const metrics = useMemo(() => {
        let amount = 0;
        let mrp = 0;
        let b2b = 0;
        let profit = 0;

        filteredReceipts.forEach(r => {
            const amt = r.amount_final || parseFloat(r.display_amount.replace('₹', '').replace(/,/g, '')) || 0;
            const mVal = r.total_mrp || amt;
            const bVal = r.b2b_cost || 0;

            amount += amt;
            mrp += mVal;
            b2b += bVal;
            profit += (mVal - bVal);
        });

        return { amount, mrp, b2b, profit, average: totalCount > 0 ? amount / totalCount : 0 };
    }, [filteredReceipts, totalCount]);

    const totalAmount = metrics.amount;
    const totalMRP = metrics.mrp;
    const totalB2BCost = metrics.b2b;
    const totalProfit = metrics.profit;
    const averageAmount = metrics.average;

    // Custom SVG Line Chart for revenue trend
    const renderLineChart = () => {
        if (revenueByDate.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-slate-400">
                    <i className="fa-solid fa-chart-line text-2xl mb-2 opacity-55"></i>
                    <p className="text-xs font-semibold uppercase tracking-wider italic">No timeline data available</p>
                </div>
            );
        }

        const width = 600;
        const height = 325;
        const paddingLeft = 40;
        const paddingRight = 20;
        const paddingTop = 20;
        const paddingBottom = 30;

        const minAmt = 0;
        const maxAmt = Math.max(...revenueByDate.map(d => d.amount), 1000) * 1.1; // 10% ceiling room

        const points = revenueByDate.map((d, i) => {
            const x = paddingLeft + (i / (revenueByDate.length - 1 || 1)) * (width - paddingLeft - paddingRight);
            const y = height - paddingBottom - ((d.amount - minAmt) / (maxAmt - minAmt)) * (height - paddingTop - paddingBottom);
            return { x, y, ...d };
        });

        let pathD = "";
        if (points.length > 0) {
            pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        }

        let areaD = "";
        if (points.length > 0) {
            areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
        }

        return (
            <div className="relative">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                    <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    <style>{`
                        .chart-point {
                            transition: r 0.15s ease-in-out, stroke-width 0.15s ease-in-out, fill 0.15s ease-in-out;
                        }
                        .chart-point:hover {
                            r: 7px;
                            stroke-width: 3.5px;
                            fill: #6366f1;
                            stroke: #ffffff;
                        }
                    `}</style>

                    {/* Horizontal grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                        const y = paddingTop + ratio * (height - paddingTop - paddingBottom);
                        const labelVal = maxAmt - ratio * (maxAmt - minAmt);
                        return (
                            <g key={index}>
                                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#f1f5f9" strokeWidth="1.5" />
                                <text x={paddingLeft - 8} y={y + 3} fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="end">
                                    ₹{labelVal >= 1000 ? `${(labelVal / 1000).toFixed(1)}k` : labelVal.toFixed(0)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Area under curve */}
                    {areaD && <path d={areaD} fill="url(#areaGradient)" className="transition-all duration-500 ease-in-out" />}

                    {/* Line path */}
                    {pathD && <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500 ease-in-out" />}

                    {/* Data dots */}
                    {points.map((p, i) => (
                        <g
                            key={i}
                            className="group cursor-pointer"
                            onMouseEnter={() => {
                                setTooltip({
                                    x: p.x,
                                    y: p.y,
                                    show: true,
                                    date: p.date,
                                    amount: p.amount,
                                    mrp: p.mrp,
                                    b2b: p.b2b,
                                    count: p.count,
                                    profit: p.profit
                                });
                            }}
                            onMouseLeave={() => {
                                setTooltip(prev => ({ ...prev, show: false }));
                            }}
                        >
                            <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" className="chart-point" />
                        </g>
                    ))}

                    {/* X Axis Labels */}
                    {points.map((p, i) => {
                        const step = Math.max(1, Math.ceil(points.length / 6));
                        if (i % step !== 0 && i !== points.length - 1) return null;
                        return (
                            <text key={i} x={p.x} y={height - 8} fill="#94a3b8" fontSize="8" fontWeight="black" textAnchor="middle">
                                {p.date.split('/').slice(0, 2).join('/')}
                            </text>
                        );
                    })}
                </svg>

                {/* Custom hovering interactive tooltip modal */}
                {tooltip.show && (
                    <div
                        className="absolute bg-slate-950/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-800/80 pointer-events-none transition-all duration-150 z-30"
                        style={{
                            left: `${(tooltip.x / width) * 100}%`,
                            top: `${(tooltip.y / height) * 100 - 10}%`,
                            transform: 'translate(-50%, -100%)',
                            minWidth: '220px'
                        }}
                    >
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center border-b border-slate-850 pb-1.5 mb-1.5">
                                <span className="font-mono text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">{tooltip.date}</span>
                                <span className="bg-indigo-500/25 text-indigo-300 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">
                                    {tooltip.count} Receipt{tooltip.count > 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium">MRP Billing:</span>
                                <span className="font-extrabold text-white">₹{tooltip.mrp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium">B2B Base Cost:</span>
                                <span className="font-extrabold text-slate-300">₹{tooltip.b2b.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>

                            <div className="border-t border-slate-800/80 pt-1.5 flex justify-between items-center">
                                <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                                    <i className="fa-solid fa-chart-line text-[9px]"></i>
                                    Net Profit:
                                </span>
                                <span className="font-black text-emerald-400 text-sm">
                                    ₹{tooltip.profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-slate-500 italic mt-1 font-semibold pt-1 border-t border-slate-850">
                                <span>Collected Cash:</span>
                                <span>₹{tooltip.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Custom SVG Bar Chart for clients comparison
    const renderClientChart = () => {
        if (revenueByClient.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-slate-400">
                    <i className="fa-solid fa-users text-2xl mb-2 opacity-55"></i>
                    <p className="text-xs font-semibold uppercase tracking-wider italic">No client share data available</p>
                </div>
            );
        }

        const maxVal = Math.max(...revenueByClient.map(c => c.amount), 100);

        return (
            <div className="space-y-3.5">
                {revenueByClient.map((item, index) => {
                    const pct = (item.amount / maxVal) * 100;
                    return (
                        <div key={index} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-700 truncate max-w-[180px]">{item.client}</span>
                                <span className="text-indigo-600 font-black">₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${pct}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Custom SVG Ticket Size Donut chart
    const renderTicketChart = () => {
        const totalTickets = ticketSizeBuckets.reduce((sum, t) => sum + t.count, 0);
        if (totalTickets === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-slate-400">
                    <i className="fa-solid fa-ticket text-2xl mb-2 opacity-55"></i>
                    <p className="text-xs font-semibold uppercase tracking-wider italic">No sales breakdown available</p>
                </div>
            );
        }

        let accumulatedPercent = 0;
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

        return (
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <div className="relative w-32 h-32 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        {/* Background ring */}
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />

                        {ticketSizeBuckets.map((bucket, idx) => {
                            const pct = (bucket.count / totalTickets) * 100;
                            if (pct === 0) return null;
                            const strokeDasharray = `${pct} ${100 - pct}`;
                            const strokeDashoffset = 100 - accumulatedPercent;
                            accumulatedPercent += pct;

                            return (
                                <circle
                                    key={idx}
                                    cx="18"
                                    cy="18"
                                    r="15.915"
                                    fill="none"
                                    stroke={colors[idx % colors.length]}
                                    strokeWidth="3.2"
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    className="transition-all duration-500 ease-in-out"
                                />
                            );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-base font-black text-slate-800">{totalTickets}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Sales</span>
                    </div>
                </div>

                <div className="flex-1 space-y-2 w-full">
                    {ticketSizeBuckets.map((bucket, idx) => {
                        const pct = totalTickets > 0 ? (bucket.count / totalTickets) * 100 : 0;
                        return (
                            <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 font-semibold text-slate-600">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                                    <span>{bucket.name}</span>
                                </div>
                                <span className="font-bold text-slate-800">
                                    {bucket.count} ({pct.toFixed(0)}%)
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:max-w-full">

            {/* Header Banner - Hidden on print */}
            <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 text-white relative overflow-hidden shadow-lg border border-slate-800 flex flex-row justify-between items-center gap-4 print:hidden">
                <div className="absolute -right-24 -bottom-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -left-16 -top-16 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl"></div>

                <div className="relative z-10">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
                        <i className="fa-solid fa-chart-pie text-indigo-400"></i>
                        Business Intelligence
                    </h1>
                </div>

                <Link
                    to="/admin-dashboard"
                    className="relative z-10 px-4 py-2 bg-slate-800 hover:bg-slate-700/80 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border border-slate-700 whitespace-nowrap"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                    Back to Dashboard
                </Link>
            </div>

            {/* Print Only Brand Header */}
            {activeTab === 'LEDGER' && selectedLedgerClient && (
                <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 m-0">LEDGER STATEMENT</h1>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mt-1">
                                Generated via Project LISP Database Portal
                            </span>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold text-slate-700 m-0">{selectedLedgerClient.alias || selectedLedgerClient.username}</h2>
                            <span className="text-xs text-slate-400 font-mono">UID: #{selectedLedgerClient.id.toString().padStart(4, '0')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-gray-300 pb-px print:hidden">
                <button
                    onClick={() => setActiveTab('BI')}
                    className={`pb-3 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                        activeTab === 'BI'
                            ? 'border-black text-black font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    <i className="fa-solid fa-chart-pie mr-2"></i>
                    Sales & Revenue BI
                </button>
                <button
                    onClick={() => setActiveTab('LEDGER')}
                    className={`pb-3 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                        activeTab === 'LEDGER'
                            ? 'border-black text-black font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    <i className="fa-solid fa-wallet mr-2"></i>
                    Franchise Ledger Statements
                </button>
            </div>

            {activeTab === 'BI' ? (
                <>
                    {/* Filter Control Box */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Filter & Refine Matrix</h3>
                        </div>

                        {/* Search Bar */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Patient, Customer, or Receipt</label>
                                <div className="relative">
                                    <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Type patient name, customer ID (e.g. CUST-0000000001), or receipt ID (e.g. RCPT-000001)..."
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 outline-none text-xs font-bold text-slate-700 transition-all font-sans"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                            {/* B2B Client Selector */}
                            <div className="space-y-1.5 lg:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">B2B Client / Operator</label>
                                <SearchableDropdown
                                    options={[
                                        { value: '', label: 'All Registered Clients' },
                                        ...clients.map(c => ({ value: c.id.toString(), label: `${c.alias || c.username} (UID: ${c.id})` }))
                                    ]}
                                    value={selectedClientId}
                                    onChange={(val) => setSelectedClientId(val)}
                                    placeholder="Type client alias or name..."
                                />
                            </div>

                            {/* Receipt Type */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Receipt Type</label>
                                <CleanSelect
                                    options={[
                                        { value: 'ALL', label: 'All Billings' },
                                        { value: 'B2B', label: 'B2B Clients Only' },
                                        { value: 'WALK_IN', label: 'Direct Walk-ins Only' }
                                    ]}
                                    value={typeFilter}
                                    onChange={(val) => setTypeFilter(val as any)}
                                />
                            </div>

                            {/* Payment Method */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Payment Method</label>
                                <CleanSelect
                                    options={[
                                        { value: '', label: 'All' },
                                        { value: 'CASH', label: 'Cash Only' },
                                        { value: 'UPI', label: 'UPI Only' },
                                        { value: 'B2B_WALLET', label: 'B2B Wallet Only' }
                                    ]}
                                    value={paymentFilter}
                                    onChange={(val) => setPaymentFilter(val)}
                                />
                            </div>

                            {/* Value Size */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Value Size</label>
                                <CleanSelect
                                    options={[
                                        { value: '', label: 'All Sizes' },
                                        { value: 'SMALL', label: 'Small (<₹1k)' },
                                        { value: 'MEDIUM', label: 'Medium (₹1k-₹2.5k)' },
                                        { value: 'PREMIUM', label: 'Premium (₹2.5k-₹5k)' },
                                        { value: 'ENTERPRISE', label: 'Enterprise (>₹5k)' }
                                    ]}
                                    value={sizeFilter}
                                    onChange={(val) => setSizeFilter(val)}
                                />
                            </div>

                            {/* Start Date */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Period From</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full p-2 border border-gray-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 outline-none text-xs font-bold text-slate-700 transition-all h-[38px]"
                                />
                            </div>

                            {/* End Date */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Period To</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full p-2 border border-gray-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 outline-none text-xs font-bold text-slate-700 transition-all h-[38px]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Metrics Dashboard */}
                    {loading ? (
                        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-lg flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 rounded-full border-4 border-indigo-600/20 border-t-indigo-600 animate-spin"></div>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 italic">Processing statements...</span>
                        </div>
                    ) : (
                        <>
                            {/* Highlight Metrics Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

                                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex justify-between items-center">
                                    <div className="space-y-1.5 min-w-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Receipts Count</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-bold text-slate-800">{totalCount}</span>
                                            <span className="text-[9px] font-medium text-slate-400 uppercase">items</span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base shrink-0">
                                        <i className="fa-solid fa-receipt"></i>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex justify-between items-center">
                                    <div className="space-y-1.5 min-w-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Total MRP Billing</span>
                                        <div className="flex items-baseline">
                                            <span className="text-2xl font-bold text-slate-850">₹{totalMRP.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-base shrink-0">
                                        <i className="fa-solid fa-file-invoice"></i>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex justify-between items-center">
                                    <div className="space-y-1.5 min-w-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Franchise Base Cost</span>
                                        <div className="flex items-baseline">
                                            <span className="text-2xl font-bold text-slate-800">₹{totalB2BCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-base shrink-0">
                                        <i className="fa-solid fa-wallet"></i>
                                    </div>
                                </div>

                                <div className="bg-emerald-50/40 p-5 rounded-3xl border border-emerald-100 shadow-sm flex justify-between items-center">
                                    <div className="space-y-1.5 min-w-0">
                                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block truncate">Net Operational Profit</span>
                                        <div className="flex items-baseline">
                                            <span className="text-2xl font-bold text-emerald-800">₹{totalProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-base shrink-0">
                                        <i className="fa-solid fa-calculator"></i>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex justify-between items-center">
                                    <div className="space-y-1.5 min-w-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Final Billings (Cash)</span>
                                        <div className="flex items-baseline">
                                            <span className="text-2xl font-bold text-slate-850">₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                        <div className="text-[9px] font-medium text-slate-400 uppercase tracking-wider block truncate">Avg Transactions: ₹{averageAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-base shrink-0">
                                        <i className="fa-solid fa-cash-register"></i>
                                    </div>
                                </div>

                            </div>

                            {/* Custom SVG Charts Panel */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                                {/* Line Chart Card */}
                                <div className="lg:col-span-8 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-chart-line text-indigo-600 text-xs"></i>
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Revenue Stream Timeline</h4>
                                        </div>
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase">Dynamic Trend</span>
                                    </div>
                                    <div className="pt-2">
                                        {renderLineChart()}
                                    </div>
                                </div>

                                {/* Side breakdown Charts */}
                                <div className="lg:col-span-4 grid grid-cols-1 gap-6">

                                    {/* Bar Chart / Share Card */}
                                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
                                        <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-ranking-star text-indigo-600 text-xs"></i>
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Top client allocations</h4>
                                        </div>
                                        <div className="pt-1">
                                            {renderClientChart()}
                                        </div>
                                    </div>

                                    {/* Ticket Size Donut Card */}
                                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
                                        <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-sliders text-indigo-600 text-xs"></i>
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Sales volume segments</h4>
                                        </div>
                                        <div className="pt-1">
                                            {renderTicketChart()}
                                        </div>
                                    </div>

                                </div>

                            </div>

                            {/* Detailed Data Table */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Audit Registry</h3>
                                    </div>
                                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">
                                        {totalCount} records indexed
                                    </span>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-inner">
                                    <table className="w-full min-w-[800px] text-left border-collapse">
                                        <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-md">
                                            <tr className="border-b border-slate-100">
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4 w-28">Receipt ID</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Date / Time</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Name</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Customer ID</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator / Context</th>
                                                <th className="p-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest pr-4 w-32">Transacted Value</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-xs">
                                            {filteredReceipts.map(receipt => (
                                                <tr key={receipt.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3 pl-4 font-semibold text-slate-600 font-mono">
                                                        {receipt.display_doc_id}
                                                    </td>
                                                    <td className="p-3 text-slate-500 font-normal">
                                                        {receipt.display_date}
                                                    </td>
                                                    <td className="p-3 text-slate-700 font-medium text-sm">
                                                        {receipt.customer_name}
                                                    </td>
                                                    <td className="p-3 text-slate-500 font-mono font-normal">
                                                        {receipt.display_customer_id}
                                                    </td>
                                                    <td className="p-3 text-slate-600 font-normal">
                                                        {receipt.created_by_user}
                                                    </td>
                                                    <td className="p-3 text-right pr-4 font-bold text-slate-900 text-sm">
                                                        {receipt.display_amount}
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredReceipts.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="p-12 text-center text-slate-400 italic font-bold tracking-widest uppercase text-xs">
                                                        No receipts match the selected filters.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            ) : (
                <div className="space-y-6">
                    {/* Filter Controls Panel - Hidden on Print */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-4 print:hidden">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Ledger Statement Filters</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
                                    B2B Corporate Client
                                </label>
                                <SearchableDropdown
                                    options={clientOptions}
                                    value={selectedLedgerClientId}
                                    onChange={setSelectedLedgerClientId}
                                    placeholder="Select Client..."
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
                                    Start Date Limit
                                </label>
                                <div className="flex items-center gap-2 bg-slate-50/50 px-3 py-1.5 border border-gray-200 rounded-xl h-[38px]">
                                    <i className="fa-solid fa-calendar text-slate-400 text-sm"></i>
                                    <input
                                        type="date"
                                        value={ledgerStartDate}
                                        onChange={e => setLedgerStartDate(e.target.value)}
                                        className="w-full border-none outline-none text-xs font-bold text-slate-700 font-mono bg-transparent"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
                                    End Date Limit
                                </label>
                                <div className="flex items-center gap-2 bg-slate-50/50 px-3 py-1.5 border border-gray-200 rounded-xl h-[38px]">
                                    <i className="fa-solid fa-calendar text-slate-400 text-sm"></i>
                                    <input
                                        type="date"
                                        value={ledgerEndDate}
                                        onChange={e => setLedgerEndDate(e.target.value)}
                                        className="w-full border-none outline-none text-xs font-bold text-slate-700 font-mono bg-transparent"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 h-[38px] shrink-0">
                                <button
                                    onClick={handlePrint}
                                    disabled={!selectedLedgerClient}
                                    className="flex-grow sm:flex-none px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-gray-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    <i className="fa-solid fa-print"></i> Print
                                </button>
                                <button
                                    onClick={handleExportCSV}
                                    disabled={!selectedLedgerClient}
                                    className="flex-grow sm:flex-none px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                                >
                                    <i className="fa-solid fa-file-csv"></i> Export CSV
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Ledger Summary Cards Block */}
                    {selectedLedgerClient && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-indigo-50/75 border border-indigo-150 p-5 rounded-3xl flex justify-between items-center shadow-sm hover:scale-[1.01] transition-transform duration-200">
                                <div className="space-y-1.5 min-w-0">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block truncate">Starting Balance</span>
                                    <div className="text-2xl font-bold text-indigo-900 leading-none">
                                        ₹{ledgerMetrics.startingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-base shrink-0 shadow-sm">
                                    <i className="fa-solid fa-wallet"></i>
                                </div>
                            </div>

                            <div className="bg-emerald-50/75 border border-emerald-150 p-5 rounded-3xl flex justify-between items-center shadow-sm hover:scale-[1.01] transition-transform duration-200">
                                <div className="space-y-1.5 min-w-0">
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block truncate">Total Deposits (+)</span>
                                    <div className="text-2xl font-bold text-emerald-900 leading-none">
                                        ₹{ledgerMetrics.totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-base shrink-0 shadow-sm">
                                    <i className="fa-solid fa-arrow-down-long"></i>
                                </div>
                            </div>

                            <div className="bg-rose-50/75 border border-rose-150 p-5 rounded-3xl flex justify-between items-center shadow-sm hover:scale-[1.01] transition-transform duration-200">
                                <div className="space-y-1.5 min-w-0">
                                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block truncate">Total Debits (-)</span>
                                    <div className="text-2xl font-bold text-rose-900 leading-none">
                                        ₹{ledgerMetrics.totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-base shrink-0 shadow-sm">
                                    <i className="fa-solid fa-arrow-up-long"></i>
                                </div>
                            </div>

                            <div className="bg-indigo-50/75 border border-indigo-150 p-5 rounded-3xl flex justify-between items-center shadow-sm hover:scale-[1.01] transition-transform duration-200">
                                <div className="space-y-1.5 min-w-0">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block truncate">Ending Balance</span>
                                    <div className="text-2xl font-bold text-indigo-900 leading-none">
                                        ₹{ledgerMetrics.endingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-base shrink-0 shadow-sm">
                                    <i className="fa-solid fa-wallet"></i>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ledger Registry Table */}
                    {loadingTxs ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                            <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-600"></i>
                            <span className="text-xs font-bold uppercase tracking-widest italic animate-pulse">
                                Computing ledger transactions...
                            </span>
                        </div>
                    ) : (
                        <div className="overflow-hidden border border-slate-200/80 rounded-3xl shadow-sm bg-white print:border-none">
                            <table className="w-full min-w-[700px] text-left border-collapse bg-white print:min-w-full">
                                <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-150 print:bg-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6 w-36">Transaction Date</th>
                                        <th className="p-4">Reference / Description</th>
                                        <th className="p-4 w-28">Type</th>
                                        <th className="p-4 text-right w-40">Debit / Credit</th>
                                        <th className="p-4 text-right pr-6 w-40">Balance Snap</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                                    {filteredTxs.map((tx) => {
                                        const isCredit = tx.amount_deducted < 0;
                                        return (
                                            <tr key={tx.id} className="hover:bg-indigo-50/20 transition-colors print:hover:bg-transparent">
                                                <td className="p-4 pl-6 font-mono font-medium text-slate-500">{tx.date.split(' | ')[0]}</td>
                                                <td className="p-4">
                                                    <span className="font-bold text-slate-800 block leading-tight">{tx.notes || 'N/A'}</span>
                                                    {tx.receipt_id && (
                                                        <span className="text-[9px] font-mono text-slate-400 font-bold block mt-0.5">
                                                            RCPT ID: #{String(tx.receipt_id).padStart(6, '0')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {isCredit ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-150">
                                                            CREDIT
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-150">
                                                            DEBIT
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`p-4 text-right font-bold text-sm ${isCredit ? 'text-green-600' : 'text-rose-600'}`}>
                                                    {isCredit ? '+' : '-'}₹{Math.abs(tx.amount_deducted).toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right pr-6 font-mono font-bold text-slate-750">
                                                    ₹{(tx.balance_snapshot || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredTxs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-400 font-bold uppercase tracking-wider italic">
                                                No ledger records transacted in this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default ReceiptReport;
