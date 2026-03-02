import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { LabReport } from '../types';
import PageHeader from '../components/PageHeader';

const ClientReports: React.FC = () => {
    const [reports, setReports] = useState<LabReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchReports = async () => {
        try {
            setLoading(true);
            const data = await apiService.getReportsClient();
            setReports(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleView = async (report: LabReport) => {
        // Open file in new tab
        window.open(report.file_path, '_blank');

        // Mark as read if not already
        if (!report.is_read) {
            try {
                await apiService.markReportAsRead(report.id);
                fetchReports(); // Refresh the list to update the badge
            } catch (err) {
                console.error("Failed to mark report as read", err);
            }
        }
    };

    const handleDownload = async (report: LabReport) => {
        try {
            // Fetch the PDF as a blob to force download instead of viewing
            const response = await fetch(report.file_path);
            if (!response.ok) throw new Error('File download failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use original filename or generate a friendly one
            const filename = report.file_path.split('/').pop() || `lab_report_${report.customer_name.replace(/\s+/g, '_')}.pdf`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Mark as read
            if (!report.is_read) {
                await apiService.markReportAsRead(report.id);
                fetchReports();
            }
        } catch (err) {
            console.error("Download failed:", err);
            alert("Failed to download file directly. Please use the View button instead.");
        }
    };

    if (loading) return <div className="text-center mt-10"><i className="fa-solid fa-spinner fa-spin text-3xl text-indigo-500"></i></div>;
    if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg max-w-4xl mx-auto mt-10 text-center">{error}</div>;

    return (
        <div className="max-w-4xl mx-auto my-10 p-6 bg-white rounded-xl shadow-lg">
            <PageHeader title="My Lab Reports" showActingAs={false} />

            {reports.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <i className="fa-solid fa-file-pdf text-4xl text-slate-300 mb-3 block"></i>
                    <p className="text-slate-500 font-medium">No lab reports available.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-y border-slate-200">
                                <th className="p-3 text-sm font-bold text-slate-600">Date Uploaded</th>
                                <th className="p-3 text-sm font-bold text-slate-600">Patient Name</th>
                                <th className="p-3 text-sm font-bold text-slate-600">Status</th>
                                <th className="p-3 text-sm font-bold text-slate-600 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reports.map((report) => (
                                <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-sm font-medium text-slate-700">{report.uploaded_at.split(' | ')[0]}</td>
                                    <td className="p-3 text-sm font-medium text-slate-900">{report.customer_name}</td>
                                    <td className="p-3 text-sm">
                                        {!report.is_read ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                                                New
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs font-medium">Viewed</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                        <button
                                            onClick={() => handleView(report)}
                                            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-bold transition-colors shadow-sm inline-flex items-center gap-2"
                                            title="View PDF"
                                        >
                                            <i className="fa-solid fa-eye"></i> View
                                        </button>
                                        <button
                                            onClick={() => handleDownload(report)}
                                            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold transition-colors shadow-sm inline-flex items-center gap-2"
                                            title="Download PDF"
                                        >
                                            <i className="fa-solid fa-download"></i> Download
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ClientReports;
