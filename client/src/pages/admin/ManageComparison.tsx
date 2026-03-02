import React, { useState } from 'react';
import { apiService } from '../../services/api';
import PageHeader from '../../components/PageHeader';

const ManageComparison: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            alert("Please select an Excel file.");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('sheet', file);
            await apiService.uploadComparisonData(formData);

            setFile(null);
            alert("Comparison data uploaded successfully! The new estimates page will now use this data.");
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Failed to upload comparison sheet. Make sure it's a valid Excel file.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto my-10 p-6 bg-white rounded-xl shadow-lg">
            <PageHeader title="Manage Estimate Comparison" showActingAs={false} />

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mt-6">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Upload Comparison Sheet</h2>
                <p className="text-slate-600 mb-6 text-sm">
                    Upload an Excel file (.xlsx or .xls) containing your lab comparison data.
                    <br /><br />
                    <strong>Format required:</strong>
                    <br />- Row 1 (Header): Column A should be "Test Name". Column B onwards should be the Lab Names (e.g., "Lab 1", "Dr. Lal PathLabs", etc).
                    <br />- Row 2 onwards: Column A is the specific test/package name, and subsequent columns contain the numeric price for that lab.
                </p>

                <form onSubmit={handleUpload} className="max-w-md">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Select Excel File</label>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-300 rounded-lg p-2 bg-white"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={uploading}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2"
                    >
                        {uploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-excel"></i>}
                        {uploading ? 'Uploading and Parsing...' : 'Upload Data'}
                    </button>
                </form>

                <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                    <p className="text-sm text-yellow-800">
                        <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                        <strong>Warning:</strong> Uploading a new sheet will completely overwrite the existing comparison mapping data.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ManageComparison;
