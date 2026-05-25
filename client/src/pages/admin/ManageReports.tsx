import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import { User, LabReport, FormattedCustomer } from '../../types';
import PageHeader from '../../components/PageHeader';
import SearchableDropdown from '../../components/SearchableDropdown';

const ManageReports: React.FC = () => {
    const [clients, setClients] = useState<User[]>([]);
    const [customers, setCustomers] = useState<FormattedCustomer[]>([]);
    const [reports, setReports] = useState<LabReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [activeCategory, setActiveCategory] = useState<'With Header' | 'Without Header' | 'Bill' | 'Others' | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const tempCategoryRef = useRef<'With Header' | 'Without Header' | 'Bill' | 'Others' | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [fetchedClients, fetchedReports, fetchedCustomers] = await Promise.all([
                apiService.getClientWallets(), // Generic method to get all CLIENT role users
                apiService.getReportsAdmin(),
                apiService.getAllCustomers()
            ]);
            setClients(fetchedClients);
            setReports(fetchedReports);
            setCustomers(fetchedCustomers);
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

    const handleCustomerChange = (customerId: string) => {
        setSelectedCustomerId(customerId);
        if (customerId) {
            const cust = customers.find(c => c.id.toString() === customerId);
            if (cust) {
                // Find if the creator is a client
                const isClientCreator = clients.some(client => client.id === cust.created_by_user_id);
                if (isClientCreator) {
                    setSelectedClientId(cust.created_by_user_id.toString());
                }
            }
        }
    };

    const filteredCustomerOptions = React.useMemo(() => {
        let list = customers;
        if (selectedClientId) {
            list = customers.filter(c => c.created_by_user_id === Number(selectedClientId));
        }
        return list.map(c => ({
            value: c.id.toString(),
            label: `${c.name} (UID: ${c.id})`
        }));
    }, [customers, selectedClientId]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId || !selectedCustomerId || !activeCategory || !file) {
            alert("Please fill in all fields (Client, Customer, and file in a category dropzone).");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('client_id', selectedClientId);
            formData.append('customer_id', selectedCustomerId);
            formData.append('category', activeCategory);
            formData.append('report', file);

            await apiService.uploadReport(formData);

            // Reset form
            setSelectedClientId('');
            setSelectedCustomerId('');
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

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Lab Reports Management" showActingAs={false} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-5 min-w-0">
                        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl min-w-0">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                                    <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                                </div>
                                <span className="text-base md:text-lg font-bold text-gray-800 uppercase">Upload Report</span>
                            </legend>

                            <form onSubmit={handleUpload} className="space-y-4">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Assign to Client</label>
                                            <SearchableDropdown
                                                options={[
                                                    { value: '', label: 'Select a Client...' },
                                                    ...clients.map(c => ({ value: c.id.toString(), label: `${c.alias || c.username} (UID: ${c.id})` }))
                                                ]}
                                                value={selectedClientId}
                                                onChange={(val) => setSelectedClientId(val)}
                                                placeholder="Search client..."
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Select Patient/Customer</label>
                                            <SearchableDropdown
                                                options={[
                                                    { value: '', label: 'Select a Customer...' },
                                                    ...filteredCustomerOptions
                                                ]}
                                                value={selectedCustomerId}
                                                onChange={handleCustomerChange}
                                                placeholder="Search customer..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block">Drag and Drop PDF into Category Dropzone</label>
                                        
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />

                                        <div className="grid grid-cols-2 gap-3">
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

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={uploading}
                                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-sm flex justify-center items-center gap-2 text-sm"
                                        >
                                            {uploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                                            {uploading ? 'Processing...' : 'Upload Report'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </fieldset>
                    </div>

                    <div className="lg:col-span-7 min-w-0">
                        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl min-w-0 h-full">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                    <i className="fa-solid fa-folder-open text-xs"></i>
                                </div>
                                <span className="text-base md:text-lg font-bold text-gray-800 uppercase">Report Directory</span>
                            </legend>

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                                    <i className="fa-solid fa-spinner fa-spin text-3xl"></i>
                                    <span className="text-xs font-bold uppercase tracking-widest italic">Retrieving secure records...</span>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-h-[60vh] overflow-y-auto custom-scrollbar-minimal">
                                    <table className="w-full min-w-[700px] text-left border-collapse">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
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
                                                                onClick={() => handleDownload(report)}
                                                                className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-indigo-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm"
                                                                title="Download PDF"
                                                            >
                                                                <i className="fa-solid fa-download text-xs"></i>
                                                            </button>
                                                            <button
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
                        </fieldset>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageReports;
