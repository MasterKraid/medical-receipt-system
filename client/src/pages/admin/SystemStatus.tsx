import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';

interface SystemStats {
    memory: {
        total: number;
        free: number;
        used: number;
        percentage: number;
    };
    disk: {
        total: number;
        used: number;
        free: number;
        percentage: number;
    };
    db: {
        size: number;
    };
    uptime: number;
    load: number[];
}

const SystemStatus: React.FC = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000); // refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const data = await apiService.getSystemStatus();
            setStats(data);
            setError(null);
        } catch (err: any) {
            console.error("Failed to load system stats", err);
            setError(err.message || "Failed to fetch system metrics");
        } finally {
            setIsLoading(false);
        }
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds: number): string => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0 || d > 0) parts.push(`${h}h`);
        if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
        parts.push(`${s}s`);

        return parts.join(' ');
    };

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                <PageHeader title="System Status & Telemetry" showActingAs={false} />

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center gap-3 mb-6 shadow-sm">
                        <i className="fa-solid fa-triangle-exclamation text-lg animate-pulse"></i>
                        <div>
                            <span className="font-bold">Error loading system telemetry:</span> {error}
                        </div>
                    </div>
                )}

                {isLoading && !stats ? (
                    <div className="text-center py-20 text-gray-400 italic text-sm flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Initializing telemetry streams...</span>
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        
                        {/* Memory Panel */}
                        <fieldset className="border-2 border-gray-300 p-5 rounded-xl bg-white shadow-sm flex flex-col justify-between min-w-0">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                                    <i className="fa-solid fa-memory text-xs"></i>
                                </div>
                                <span className="text-base font-bold text-gray-800 uppercase tracking-tight">RAM Utilization</span>
                            </legend>

                            <div className="space-y-4 w-full">
                                <div className="flex justify-between items-center text-xs font-bold uppercase mt-1">
                                    <span className="text-slate-450">Active Usage:</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                                        stats.memory.percentage > 90 ? 'bg-red-50 text-red-700 border-red-100' :
                                        stats.memory.percentage > 75 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                        'bg-green-50 text-green-700 border-green-100'
                                    }`}>
                                        {stats.memory.percentage}%
                                    </span>
                                </div>
                                
                                <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner flex">
                                    <div
                                        className={`h-full transition-all duration-1000 ${
                                            stats.memory.percentage > 90 ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                                            stats.memory.percentage > 75 ? 'bg-gradient-to-r from-amber-500 to-orange-600' :
                                            'bg-gradient-to-r from-green-500 to-emerald-600'
                                        }`}
                                        style={{ width: `${stats.memory.percentage}%` }}
                                    ></div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-500">
                                    <div className="p-3 bg-slate-50 rounded-lg border border-gray-150 shadow-inner">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase">Active Used</div>
                                        <div className="text-sm font-black text-gray-800 mt-1">{formatBytes(stats.memory.used)}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-gray-150 shadow-inner">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase">Total Capacity</div>
                                        <div className="text-sm font-black text-gray-800 mt-1">{formatBytes(stats.memory.total)}</div>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Disk Storage Panel */}
                        <fieldset className="border-2 border-gray-300 p-5 rounded-xl bg-white shadow-sm flex flex-col justify-between min-w-0">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-cyan-600 flex items-center justify-center text-white shadow-sm shrink-0">
                                    <i className="fa-solid fa-hard-drive text-xs"></i>
                                </div>
                                <span className="text-base font-bold text-gray-800 uppercase tracking-tight">Storage Disk</span>
                            </legend>

                            <div className="space-y-4 w-full">
                                <div className="flex justify-between items-center text-xs font-bold uppercase mt-1">
                                    <span className="text-slate-450">Partition "/home":</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                                        stats.disk.percentage > 90 ? 'bg-red-50 text-red-700 border-red-100' :
                                        stats.disk.percentage > 75 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                        'bg-green-50 text-green-700 border-green-100'
                                    }`}>
                                        {stats.disk.percentage}%
                                    </span>
                                </div>

                                <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner flex">
                                    <div
                                        className={`h-full transition-all duration-1000 ${
                                            stats.disk.percentage > 90 ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                                            stats.disk.percentage > 75 ? 'bg-gradient-to-r from-amber-500 to-orange-600' :
                                            'bg-gradient-to-r from-green-500 to-emerald-600'
                                        }`}
                                        style={{ width: `${stats.disk.percentage}%` }}
                                    ></div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-500">
                                    <div className="p-3 bg-slate-50 rounded-lg border border-gray-150 shadow-inner">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase">Consumed</div>
                                        <div className="text-sm font-black text-gray-800 mt-1">{formatBytes(stats.disk.used)}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-gray-150 shadow-inner">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase">Available</div>
                                        <div className="text-sm font-black text-gray-800 mt-1">{formatBytes(stats.disk.free)}</div>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Database Size Panel */}
                        <fieldset className="border-2 border-gray-300 p-5 rounded-xl bg-white shadow-sm flex flex-col justify-between min-w-0">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-amber-600 flex items-center justify-center text-white shadow-sm shrink-0">
                                    <i className="fa-solid fa-database text-xs"></i>
                                </div>
                                <span className="text-base font-bold text-gray-800 uppercase tracking-tight">SQLite Database</span>
                            </legend>

                            <div className="space-y-4 w-full">
                                <div className="flex justify-between items-center text-xs font-bold uppercase mt-1">
                                    <span className="text-slate-450">data.db Status:</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-100">
                                        ONLINE
                                    </span>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-xl border border-gray-150 flex flex-col justify-center items-center h-[120px] shadow-inner">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active File Footprint</div>
                                    <div className="text-2xl font-black text-gray-800 mt-2">{formatBytes(stats.db.size)}</div>
                                    <div className="text-[9px] font-bold text-gray-400 mt-1 font-mono">/server/data/data.db</div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Uptime & Loads Panel */}
                        <fieldset className="border-2 border-gray-300 p-5 rounded-xl bg-white shadow-sm md:col-span-2 min-w-0">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
                                    <i className="fa-solid fa-clock text-xs"></i>
                                </div>
                                <span className="text-base font-bold text-gray-800 uppercase tracking-tight">System Reliability</span>
                            </legend>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-1">
                                <div className="p-4 bg-slate-50 rounded-xl border border-gray-150 flex flex-col justify-center shadow-inner">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase">OS Continuous Uptime</div>
                                    <div className="text-xl font-black text-gray-800 mt-1">{formatUptime(stats.uptime)}</div>
                                    <div className="text-[9px] text-gray-400 mt-1">Uptime clock parsed in GMT+5:30 context</div>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-xl border border-gray-150 flex flex-col justify-center shadow-inner">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">CPU Load Averages</div>
                                    <div className="flex gap-2">
                                        {stats.load.map((l, index) => {
                                            const times = ['1m', '5m', '15m'];
                                            return (
                                                <div key={index} className="flex-grow text-center p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                                                    <div className="text-[8px] font-bold text-gray-400 uppercase">{times[index]}</div>
                                                    <div className="text-xs font-black text-gray-800 mt-0.5">{l.toFixed(2)}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Process details / Server Engine Panel */}
                        <fieldset className="border-2 border-gray-300 p-5 rounded-xl bg-white shadow-sm flex flex-col justify-between min-w-0">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
                                    <i className="fa-solid fa-gears text-xs"></i>
                                </div>
                                <span className="text-base font-bold text-gray-800 uppercase tracking-tight">Server Engine</span>
                            </legend>

                            <div className="text-xs text-gray-650 space-y-2 font-medium w-full mt-1">
                                <div className="flex justify-between border-b border-gray-150 pb-1.5">
                                    <span className="text-gray-400 font-bold">Node.js Version:</span>
                                    <span className="font-mono font-bold text-gray-800">v18.x / v20.x</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-150 pb-1.5">
                                    <span className="text-gray-400 font-bold">OS Platform:</span>
                                    <span className="font-bold text-gray-800">Linux (x86_64)</span>
                                </div>
                                <div className="flex justify-between pb-0.5">
                                    <span className="text-gray-400 font-bold">Active Engine:</span>
                                    <span className="font-bold text-indigo-650">Project LISP Express</span>
                                </div>
                            </div>
                        </fieldset>

                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default SystemStatus;
