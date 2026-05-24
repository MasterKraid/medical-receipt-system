import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
    const filteredReceipts = useMemo(() => {
        return receipts.filter(r => {
            if (selectedClientId) {
                const clientIdNum = parseInt(selectedClientId, 10);
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
    }, [receipts, selectedClientId, startDate, endDate]);

    // Grouping & Chart Datasets
    const revenueByDate = useMemo(() => {
        const groups: { [date: string]: number } = {};
        filteredReceipts.forEach(r => {
            const dateStr = r.display_date.split(' ')[0]; // DD/MM/YYYY
            const amt = parseFloat(r.display_amount.replace('₹', '').replace(/,/g, '')) || 0;
            groups[dateStr] = (groups[dateStr] || 0) + amt;
        });

        return Object.entries(groups)
            .map(([date, amount]) => {
                const [d, m, y] = date.split('/').map(Number);
                return { date, dateObj: new Date(y, m - 1, d), amount };
            })
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    }, [filteredReceipts]);

    const revenueByClient = useMemo(() => {
        const groups: { [client: string]: number } = {};
        filteredReceipts.forEach(r => {
            const client = r.created_by_user || 'Direct Entry';
            const amt = parseFloat(r.display_amount.replace('₹', '').replace(/,/g, '')) || 0;

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
            const amt = parseFloat(r.display_amount.replace('₹', '').replace(/,/g, '')) || 0;
            if (amt < 1000) buckets['Small (<₹1k)']++;
            else if (amt <= 2500) buckets['Medium (₹1k-₹2.5k)']++;
            else if (amt <= 5000) buckets['Premium (₹2.5k-₹5k)']++;
            else buckets['Enterprise (>₹5k)']++;
        });
        return Object.entries(buckets).map(([name, count]) => ({ name, count }));
    }, [filteredReceipts]);

    // Calculate metrics
    const totalCount = filteredReceipts.length;
    const totalAmount = useMemo(() => {
        return filteredReceipts.reduce((sum, r) => {
            const valStr = r.display_amount.replace('₹', '').replace(/,/g, '');
            return sum + parseFloat(valStr || '0');
        }, 0);
    }, [filteredReceipts]);

    const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

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
                            r: 6.5px;
                            stroke-width: 3.5px;
                            fill: #e0e7ff;
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
                        <g key={i} className="group cursor-pointer">
                            <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" className="chart-point" />
                            <title>{`${p.date}: ₹${p.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}</title>
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
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">

            {/* Header Banner */}
            <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 text-white relative overflow-hidden shadow-lg border border-slate-800 flex flex-row justify-between items-center gap-4">
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

            {/* Filter Control Box */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Filter & Refine Matrix</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* B2B Client Selector */}
                    <div className="space-y-1.5">
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

                    {/* Start Date */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Period From</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 outline-none text-xs font-bold text-slate-700 transition-all"
                        />
                    </div>

                    {/* End Date */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Period To</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 outline-none text-xs font-bold text-slate-700 transition-all"
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md flex justify-between items-center group hover:border-indigo-100 transition-all">
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transacted</span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl font-black text-slate-800">{totalCount}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase">receipts</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-black group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                <i className="fa-solid fa-receipt"></i>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md flex justify-between items-center group hover:border-emerald-100 transition-all">
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Revenue</span>
                                <div className="flex items-baseline">
                                    <span className="text-2xl font-black text-slate-800">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase ml-1">INR</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-black group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                <i className="fa-solid fa-wallet"></i>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md flex justify-between items-center group hover:border-purple-100 transition-all">
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mean Transaction Value</span>
                                <div className="flex items-baseline">
                                    <span className="text-2xl font-black text-slate-800">₹{averageAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase ml-1">mean</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-black group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                                <i className="fa-solid fa-calculator"></i>
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
                                            <td className="p-3 pl-4 font-black text-slate-700 font-mono">
                                                {receipt.display_doc_id}
                                            </td>
                                            <td className="p-3 text-slate-500 font-medium">
                                                {receipt.display_date}
                                            </td>
                                            <td className="p-3 text-slate-800 font-extrabold text-sm">
                                                {receipt.customer_name}
                                            </td>
                                            <td className="p-3 text-slate-500 font-mono font-medium">
                                                {receipt.display_customer_id}
                                            </td>
                                            <td className="p-3 text-slate-600 font-bold">
                                                {receipt.created_by_user}
                                            </td>
                                            <td className="p-3 text-right pr-4 font-black text-slate-900 text-sm">
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

        </div>
    );
};

export default ReceiptReport;
