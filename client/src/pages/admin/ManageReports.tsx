import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { User, LabReport } from '../../types';
import PageHeader from '../../components/PageHeader';
import SearchableDropdown from '../../components/SearchableDropdown';

const ManageReports: React.FC = () => {
    const [clients, setClients] = useState<User[]>([]);
    const [reports, setReports] = useState<LabReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [customerName, setCustomerName] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [fetchedClients, fetchedReports] = await Promise.all([
                apiService.getClientWallets(), // Generic method to get all CLIENT role users
                apiService.getReportsAdmin()
            ]);
            setClients(fetchedClients);
            setReports(fetchedReports);
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
            const response = await fetch(report.file_path);
            if (!response.ok) throw new Error('File download failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const filename = report.file_path.split('/').pop() || `lab_report_${report.customer_name.replace(/\s+/g, '_')}.pdf`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Download failed:", err);
            alert("Failed to download file directly. Please use the View button instead.");
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId || !customerName.trim() || !file) {
            alert("Please fill in all fields and select a PDF.");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('client_id', selectedClientId);
            formData.append('customer_name', customerName);
            formData.append('report', file);

            await apiService.uploadReport(formData);

            // Reset form
            setSelectedClientId('');
            setCustomerName('');
            setFile(null);

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

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Lab Reports Management" showActingAs={false} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 min-w-0">
                        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl min-w-0">
                            <legend className="px-3 flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                                    <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                                </div>
                                <span className="text-base md:text-lg font-bold text-gray-800 uppercase">Upload Report</span>
                            </legend>

                            <form onSubmit={handleUpload} className="space-y-4">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Assign to Client</label>
                                        <SearchableDropdown
                                            options={[
                                                { value: '', label: 'Select a Client...' },
                                                ...clients.map(c => ({ value: c.id.toString(), label: c.alias || c.username }))
                                            ]}
                                            value={clients.find(c => c.id.toString() === selectedClientId)?.alias || clients.find(c => c.id.toString() === selectedClientId)?.username || ''}
                                            onChange={(val) => setSelectedClientId(val)}
                                            placeholder="Search client..."
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Patient/Customer Name</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                            <input
                                                type="text"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                placeholder="e.g. John Doe"
                                                className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all outline-none text-sm font-bold"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Select PDF File</label>
                                        <input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                            className="w-full p-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-50 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                                            required
                                        />
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

                    <div className="lg:col-span-8 min-w-0">
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
                                    <table className="w-full min-w-[800px] text-left border-collapse">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr className="border-b border-gray-200">
                                                <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-4">Assigned To</th>
                                                <th className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Patient Name</th>
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
                                                                href={report.file_path}
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
                                                    <td colSpan={5} className="p-10 text-center text-gray-400 italic text-xs uppercase font-bold tracking-widest">
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
