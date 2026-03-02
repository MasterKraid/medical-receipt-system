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
        <div className="max-w-6xl mx-auto my-10 p-6 bg-white rounded-xl shadow-lg">
            <PageHeader title="Manage Lab Reports" showActingAs={false} />

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <form onSubmit={handleUpload} className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 inline-flex items-center gap-2">
                            <i className="fa-solid fa-cloud-arrow-up text-indigo-500"></i> Upload New Report
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Assign to Client</label>
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

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Patient/Customer Name</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">PDF File</label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2"
                            >
                                {uploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                                {uploading ? 'Uploading...' : 'Upload Report'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="md:col-span-2">
                    {loading ? (
                        <div className="text-center py-10"><i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400"></i></div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">Assigned To</th>
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">Patient</th>
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                                        <th className="p-3 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {reports.map(report => (
                                        <tr key={report.id} className="hover:bg-slate-50">
                                            <td className="p-3 font-medium text-slate-800">{report.alias || report.username}</td>
                                            <td className="p-3 text-slate-600">{report.customer_name}</td>
                                            <td className="p-3 text-slate-500">{report.uploaded_at.split(' | ')[0]}</td>
                                            <td className="p-3">
                                                {report.is_read ? (
                                                    <span className="text-green-600 font-medium text-xs"><i className="fa-solid fa-check mr-1"></i> Read</span>
                                                ) : (
                                                    <span className="text-orange-500 font-medium text-xs"><i className="fa-solid fa-envelope mr-1"></i> Unread</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right space-x-2">
                                                <a
                                                    href={report.file_path}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                                                    title="View PDF"
                                                >
                                                    <i className="fa-solid fa-eye"></i>
                                                </a>
                                                <button
                                                    onClick={() => handleDownload(report)}
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                                    title="Download PDF"
                                                >
                                                    <i className="fa-solid fa-download"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(report.id)}
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                    title="Delete"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {reports.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-6 text-center text-slate-500 italic">No reports uploaded yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManageReports;
