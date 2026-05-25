import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import { LabReport, Document } from '../../types';
import PageHeader from '../../components/PageHeader';

const ManageReports: React.FC = () => {
    const [reports, setReports] = useState<LabReport[]>([]);
    const [receipts, setReceipts] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [selectedReceipt, setSelectedReceipt] = useState<Document | null>(null);
    const [activeCategory, setActiveCategory] = useState<'With Header' | 'Without Header' | 'Bill' | 'Others' | null>(null);
    const [file, setFile] = useState<File | null>(null);

    // Right side tabs & date filters
    const [activeRightTab, setActiveRightTab] = useState<'pending' | 'directory'>('pending');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const tempCategoryRef = useRef<'With Header' | 'Without Header' | 'Bill' | 'Others' | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [fetchedReports, fetchedReceipts] = await Promise.all([
                apiService.getReportsAdmin(),
                apiService.getReceipts()
            ]);
            setReports(fetchedReports);
            setReceipts(fetchedReceipts);
        } catch (err) {
            console.error("Failed to fetch data", err);
            alert("Error loading data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDownload = async (report: any) => {
        try {
            const response = await fetch(`/api/reports/${report.id}/download`);
            if (response.status === 403) {
                const errData = await response.json();
                alert(errData.message || "Download blocked: Wallet account balance is negative.");
                return;
            }
            if (!response.ok) throw new Error('File download failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            const sanitizedCustomerName = report.customer_name.replace(/[^a-zA-Z0-9]/g, '_');
            const sanitizedCategory = (report.category || 'report').toLowerCase().replace(/\s+/g, '_');
            const filename = `${sanitizedCustomerName}_${sanitizedCategory}.pdf`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Download failed:", err);
            alert("Failed to download file.");
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReceipt || !activeCategory || !file) {
            alert("Please select a target customer and choose a category dropzone.");
            return;
        }

        const clientId = selectedReceipt.acting_as_client_id || selectedReceipt.created_by_user_id;
        const customerId = selectedReceipt.customer_id;

        if (!clientId || !customerId) {
            alert("Invalid client or customer record associated with this receipt.");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('client_id', clientId.toString());
            formData.append('customer_id', customerId.toString());
            formData.append('category', activeCategory);
            formData.append('report', file);

            await apiService.uploadReport(formData);

            // Reset selected receipt and file
            setSelectedReceipt(null);
            setFile(null);
            setActiveCategory(null);

            // Refresh list
            fetchData();
            alert("Report uploaded successfully!");
        } catch (err: any) {
            console.error("Upload error", err);
            alert(err.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure you want to delete this report?")) return;
        try {
            await apiService.deleteReport(id);
            fetchData();
        } catch (err: any) {
            alert("Failed to delete report.");
        }
    };

    // Drag & Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, category: 'With Header' | 'Without Header' | 'Bill' | 'Others') => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.pdf')) {
                setFile(droppedFile);
                setActiveCategory(category);
            } else {
                alert("Only PDF files are supported.");
            }
        }
    };

    const handleDropzoneClick = (category: 'With Header' | 'Without Header' | 'Bill' | 'Others') => {
        if (fileInputRef.current) {
            tempCategoryRef.current = category;
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
                setFile(selectedFile);
                if (tempCategoryRef.current) {
                    setActiveCategory(tempCategoryRef.current);
                }
            } else {
                alert("Only PDF files are supported.");
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClearFile = () => {
        setFile(null);
        setActiveCategory(null);
        tempCategoryRef.current = null;
    };

    const categories = [
        { id: 'With Header', label: 'With Header', icon: 'fa-file-invoice', color: 'indigo', desc: 'Official report with letterhead' },
        { id: 'Without Header', label: 'Without Header', icon: 'fa-file-signature', color: 'amber', desc: 'Plain report without letterhead' },
        { id: 'Bill', label: 'Bill', icon: 'fa-receipt', color: 'emerald', desc: 'Invoices & billing statements' },
        { id: 'Others', label: 'Others', icon: 'fa-ellipsis-h', color: 'slate', desc: 'Additional charts or documents' }
    ] as const;

    const filteredReceipts = React.useMemo(() => {
        if (!selectedDate) return [];
        return receipts.filter(rcpt => {
            if (!rcpt.display_date) return false;
            const [y, m, d] = selectedDate.split('-');
            const datePart = rcpt.display_date.split(' ')[0];
            const [rcptD, rcptM, rcptY] = datePart.split('/');
            return Number(y) === Number(rcptY) && Number(m) === Number(rcptM) && Number(d) === Number(rcptD);
        });
    }, [receipts, selectedDate]);

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Lab Reports Management" showActingAs={false} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Upload Form Panel */}
                    <div className="lg:col-span-5 min-w-0">
                        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl min-w-0 h-full">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                                    <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                                </div>
                                <span className="text-base md:text-lg font-bold text-gray-800 uppercase">Upload Report</span>
                            </legend>

                            <form onSubmit={handleUpload} className="space-y-4 h-full flex flex-col">
                                <div className="space-y-4 flex-grow">
                                    {/* Selected Target Customer Card */}
                                    {!selectedReceipt ? (
                                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 font-bold text-xs mb-4 uppercase tracking-wider flex flex-col items-center justify-center gap-2 min-h-[140px] animate-pulse">
                                            <i className="fa-solid fa-arrow-pointer text-xl text-slate-355"></i>
                                            <span>Select a customer from the right panel to upload</span>
                                        </div>
                                    ) : (
                                        <div className="bg-indigo-50/70 border border-indigo-150 rounded-2xl p-4 mb-4 flex justify-between items-center gap-4 shadow-sm animate-in fade-in duration-200">
                                            <div className="space-y-0.5 min-w-0 flex-1">
                                                <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Active Target Customer</div>
                                                <div className="text-sm font-black text-indigo-900 truncate">{selectedReceipt.customer_name}</div>
                                                <div className="text-[9px] text-indigo-600 font-mono font-bold uppercase tracking-wider truncate">
                                                    {selectedReceipt.display_doc_id} • UID: {selectedReceipt.customer_id}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedReceipt(null)}
                                                className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-500 rounded-lg border border-indigo-200 hover:border-red-200 text-[10px] font-bold transition-all shrink-0 active:scale-95"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    )}

                                    {/* 2x2 Dropzones Panel */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block">Drag and Drop PDF into Category Dropzone</label>
                                        
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />

                                        <div className={`grid grid-cols-2 gap-3 transition-all duration-300 ${!selectedReceipt ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                                            {categories.map(cat => {
                                                const isSelected = activeCategory === cat.id && file !== null;
                                                const colorClasses = {
                                                    indigo: isSelected ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/10',
                                                    amber: isSelected ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-200' : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/10',
                                                    emerald: isSelected ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-200' : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/10',
                                                    slate: isSelected ? 'border-slate-500 bg-slate-50/50 ring-2 ring-slate-200' : 'border-gray-200 hover:border-slate-300 hover:bg-slate-50/10',
                                                }[cat.color];

                                                return (
                                                    <div
                                                        key={cat.id}
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDrop(e, cat.id)}
                                                        onClick={() => handleDropzoneClick(cat.id)}
                                                        className={`flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center space-y-1 h-36 ${colorClasses}`}
                                                    >
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                                                            isSelected ? 'bg-white shadow-sm' : 'bg-gray-50'
                                                        }`}>
                                                            {isSelected ? (
                                                                <i className="fa-solid fa-circle-check text-green-500 text-base animate-scale"></i>
                                                            ) : (
                                                                <i className={`fa-solid ${cat.icon} text-gray-400 text-xs`}></i>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-[11px] font-bold text-gray-800 leading-tight">{cat.label}</div>
                                                            <div className="text-[9px] text-gray-400 font-medium px-1 leading-tight">{cat.desc}</div>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="w-full mt-1 bg-white/95 px-1.5 py-0.5 rounded border border-gray-200 shadow-sm text-[9px] font-bold text-gray-700 truncate flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                                                                <span className="truncate flex-1 text-left">{file.name}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleClearFile}
                                                                    className="text-red-500 hover:text-red-700 font-bold"
                                                                >
                                                                    <i className="fa-solid fa-xmark"></i>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="pt-4 mt-auto">
                                        <button
                                            type="submit"
                                            disabled={uploading || !selectedReceipt || !activeCategory || !file}
                                            className={`w-full py-3 font-bold rounded-xl transition-all shadow-md flex justify-center items-center gap-2 text-sm ${
                                                (!selectedReceipt || !activeCategory || !file)
                                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 hover:scale-[1.01] active:scale-95'
                                            }`}
                                        >
                                            {uploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-circle-check"></i>}
                                            {uploading ? 'Processing Upload...' : 'Confirm & Upload Report'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </fieldset>
                    </div>

                    {/* Right Directory / Pending Panel */}
                    <div className="lg:col-span-7 min-w-0">
                        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl min-w-0 h-full">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                    <i className="fa-solid fa-folder-open text-xs"></i>
                                </div>
                                <span className="text-base md:text-lg font-bold text-gray-800 uppercase">Automated Workspace</span>
                            </legend>

                            {/* Dual Tabs Selector */}
                            <div className="flex border-b border-slate-200 mb-4 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveRightTab('pending')}
                                    className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${
                                        activeRightTab === 'pending'
                                            ? 'border-indigo-600 text-indigo-650'
                                            : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    Pending Uploads
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveRightTab('directory')}
                                    className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${
                                        activeRightTab === 'directory'
                                            ? 'border-indigo-600 text-indigo-650'
                                            : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    Uploaded Directory
                                </button>
                            </div>

                            {activeRightTab === 'pending' ? (
                                <div className="space-y-4">
                                    {/* Date and count filters */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-calendar-days text-slate-400 text-xs"></i>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Statement Date:</label>
                                            <input
                                                type="date"
                                                value={selectedDate}
                                                onChange={e => setSelectedDate(e.target.value)}
                                                className="p-1 border border-slate-200 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-100 outline-none text-slate-700 font-mono"
                                            />
                                        </div>
                                        <span className="text-[10px] font-black bg-indigo-50 border border-indigo-100 text-indigo-600 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            {filteredReceipts.length} Generated on Date
                                        </span>
                                    </div>

                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                                            <i className="fa-solid fa-spinner fa-spin text-3xl text-indigo-550"></i>
                                            <span className="text-xs font-bold uppercase tracking-widest italic">Synchronizing transacted registry...</span>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm max-h-[50vh] overflow-y-auto custom-scrollbar-minimal">
                                            <table className="w-full min-w-[600px] text-left border-collapse">
                                                <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
                                                    <tr className="border-b border-slate-200">
                                                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-4">Patient Name</th>
                                                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Receipt ID</th>
                                                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transacted</th>
                                                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                                        <th className="p-3 text-right pr-4 w-24">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs">
                                                    {filteredReceipts.map(rcpt => {
                                                        const isSelected = selectedReceipt?.id === rcpt.id;
                                                        const hasUploadedReport = reports.some(r => r.customer_id === rcpt.customer_id);

                                                        return (
                                                            <tr
                                                                key={rcpt.id}
                                                                onClick={() => setSelectedReceipt(rcpt)}
                                                                className={`hover:bg-slate-50 border-b border-slate-100 cursor-pointer transition-all duration-155 ${
                                                                    isSelected ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600 font-medium' : ''
                                                                }`}
                                                            >
                                                                <td className="p-3 pl-4">
                                                                    <div className="relative group cursor-help inline-block">
                                                                        <span className="font-bold text-slate-800 hover:text-indigo-650 transition-colors">
                                                                            {rcpt.customer_name}
                                                                        </span>
                                                                        
                                                                        {/* Glassmorphic Metadata Tooltip Card */}
                                                                        <div className="absolute left-0 bottom-full mb-2 w-72 p-4 bg-slate-950/95 backdrop-blur-md text-white rounded-2xl border border-slate-800 shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-205 z-50 transform translate-y-1 group-hover:translate-y-0">
                                                                            <div className="space-y-2 text-xs text-left">
                                                                                <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center">
                                                                                    <span className="font-mono text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Billing Creator Metadata</span>
                                                                                    <span className="bg-blue-500/20 text-blue-300 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">
                                                                                        SYSTEM REF
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="text-slate-400 font-medium">Creator/Operator:</span>
                                                                                    <span className="font-bold text-white">{rcpt.created_by_user}</span>
                                                                                </div>
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="text-slate-400 font-medium">Client UID:</span>
                                                                                    <span className="font-mono font-bold text-slate-300">
                                                                                        {rcpt.acting_as_client_id || rcpt.created_by_user_id || 'N/A'}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex justify-between items-center pt-1 border-t border-slate-850">
                                                                                    <span className="text-slate-400 font-medium">Transacted Date:</span>
                                                                                    <span className="font-bold text-slate-300 font-mono">{rcpt.display_date}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-[9px] text-slate-400 font-mono">{rcpt.display_customer_id}</div>
                                                                </td>
                                                                <td className="p-3 font-mono font-medium text-slate-650">{rcpt.display_doc_id}</td>
                                                                <td className="p-3 font-bold text-slate-900">{rcpt.display_amount}</td>
                                                                <td className="p-3">
                                                                    {hasUploadedReport ? (
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-150">
                                                                            <i className="fa-solid fa-check-circle mr-1"></i> Uploaded
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-150 animate-pulse">
                                                                            <i className="fa-solid fa-clock mr-1"></i> Pending
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="p-3 text-right pr-4 w-24">
                                                                    <button
                                                                        type="button"
                                                                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all shadow-sm ${
                                                                            isSelected
                                                                                ? 'bg-indigo-650 text-white'
                                                                                : 'bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200'
                                                                        }`}
                                                                    >
                                                                        {isSelected ? 'Selected' : 'Select'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {filteredReceipts.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="p-10 text-center text-slate-400 italic font-bold text-xs uppercase tracking-wider">
                                                                No receipts generated on this date.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                                            <i className="fa-solid fa-spinner fa-spin text-3xl"></i>
                                            <span className="text-xs font-bold uppercase tracking-widest italic">Retrieving secure records...</span>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-h-[50vh] overflow-y-auto custom-scrollbar-minimal">
                                            <table className="w-full min-w-[700px] text-left border-collapse">
                                                <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10">
                                                    <tr className="border-b border-gray-200">
                                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-4">Assigned To</th>
                                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Patient Name</th>
                                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category</th>
                                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Upload Date</th>
                                                        <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                                        <th className="p-3 text-right pr-4">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 text-sm">
                                                    {reports.map(report => (
                                                        <tr key={report.id} className="hover:bg-gray-50/50 transition-colors group">
                                                            <td className="p-3 pl-4">
                                                                <div className="font-bold text-gray-800">{report.alias || report.username}</div>
                                                                <div className="text-[10px] text-gray-400 font-mono italic">REF: #{report.id.toString().padStart(4, '0')}</div>
                                                            </td>
                                                            <td className="p-3 text-gray-600 font-medium">{report.customer_name}</td>
                                                            <td className="p-3">
                                                                {report.category === 'With Header' && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">With Header</span>
                                                                )}
                                                                {report.category === 'Without Header' && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">Without Header</span>
                                                                )}
                                                                {report.category === 'Bill' && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">Bill</span>
                                                                )}
                                                                {(!report.category || report.category === 'Others') && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-sm">Others</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-gray-500 text-xs">{report.uploaded_at.split(' | ')[0]}</td>
                                                            <td className="p-3">
                                                                {report.is_read ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-100">
                                                                        <i className="fa-solid fa-check-circle mr-1"></i> READ
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-100 animate-pulse">
                                                                        <i className="fa-solid fa-envelope mr-1"></i> UNREAD
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right pr-4">
                                                                <div className="flex justify-end gap-1.5">
                                                                    <a
                                                                        href={`/api/reports/${report.id}/download?inline=true`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-blue-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm"
                                                                        title="View PDF"
                                                                    >
                                                                        <i className="fa-solid fa-eye text-xs"></i>
                                                                    </a>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDownload(report)}
                                                                        className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-indigo-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm"
                                                                        title="Download PDF"
                                                                    >
                                                                        <i className="fa-solid fa-download text-xs"></i>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDelete(report.id)}
                                                                        className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-red-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm"
                                                                        title="Delete"
                                                                    >
                                                                        <i className="fa-solid fa-trash-can text-xs"></i>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {reports.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="p-10 text-center text-gray-400 italic text-xs uppercase font-bold tracking-widest">
                                                                No digital reports found in directory.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </fieldset>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageReports;
