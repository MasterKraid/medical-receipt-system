import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import { ComparisonTest, ComparisonLab, ComparisonPrice } from '../../types';

const ManageComparison: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const [tests, setTests] = useState<ComparisonTest[]>([]);
    const [labs, setLabs] = useState<ComparisonLab[]>([]);
    const [prices, setPrices] = useState<ComparisonPrice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [newTestName, setNewTestName] = useState('');
    const [newTestPrices, setNewTestPrices] = useState<{ [labId: number]: string }>({});
    
    // Add Lab State
    const [newLabName, setNewLabName] = useState('');

    // Modal State
    const [editingTest, setEditingTest] = useState<ComparisonTest | null>(null);
    const [modalPrices, setModalPrices] = useState<{ [labId: number]: string }>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getComparisonData();
            setTests(data.tests);
            setLabs(data.labs);
            setPrices(data.prices);
        } catch (err: any) {
            console.error("Failed to fetch comparison data", err);
        } finally {
            setIsLoading(false);
        }
    };

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
            fetchData();
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Failed to upload comparison sheet. Make sure it's a valid Excel file.");
        } finally {
            setUploading(false);
        }
    };

    // --- Lab CRUD ---
    const handleAddLab = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiService.addComparisonLab(newLabName);
            setNewLabName('');
            fetchData();
            alert("Lab added successfully!");
        } catch (e: any) {
            alert(e.message || "Failed to add lab");
        }
    };

    const handleDeleteLab = async (labId: number) => {
        if (!window.confirm("Are you sure you want to delete this specific lab and all its prices across all tests? This cannot be undone.")) return;
        try {
            await apiService.deleteComparisonLab(labId);
            fetchData();
        } catch (e: any) {
            alert(e.message || "Failed to delete lab");
        }
    };

    // --- Test CRUD ---
    const handleAddTest = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const priceArr = Object.entries(newTestPrices).map(([labIdStr, priceStr]) => ({
                lab_id: parseInt(labIdStr),
                price: parseFloat(priceStr) || 0
            })).filter(p => !isNaN(p.price) && p.price > 0);

            await apiService.addComparisonTest(newTestName, priceArr);
            setNewTestName('');
            setNewTestPrices({});
            fetchData();
            alert("Test added successfully!");
        } catch (e: any) {
             alert(e.message || "Failed to add test");
        }
    };

    const handleDeleteTest = async (testId: number) => {
        if (!window.confirm("Are you sure you want to delete this test?")) return;
        try {
            await apiService.deleteComparisonTest(testId);
            fetchData();
            if (editingTest && editingTest.id === testId) {
                 setEditingTest(null);
            }
        } catch (e: any) {
            alert(e.message || "Failed to delete test");
        }
    };

    // --- Modal Editing ---
    const openEditModal = (test: ComparisonTest) => {
        const initialPrices: { [labId: number]: string } = {};
        labs.forEach(lab => {
            const p = prices.find(price => price.test_id === test.id && price.lab_id === lab.id);
            if (p) {
                initialPrices[lab.id] = p.price.toString();
            }
        });
        setEditingTest(test);
        setModalPrices(initialPrices);
    };

    const handleSaveTestModal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTest) return;

        try {
             const priceArr = Object.entries(modalPrices).map(([labIdStr, priceStr]) => ({
                lab_id: parseInt(labIdStr),
                price: parseFloat(priceStr) || 0
            })).filter(p => !isNaN(p.price) && p.price > 0);

            await apiService.updateComparisonTest(editingTest.id, editingTest.name, priceArr);
            alert("Test updated successfully!");
            setEditingTest(null);
            fetchData();
        } catch(e: any) {
             alert(e.message || "Failed to save test");
        }
    };

    const filteredTests = tests.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Manage Estimate Comparison" showActingAs={false} />

                {/* File Upload Section */}
                <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl mb-10 min-w-0">
                    <legend className="px-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <i className="fa-solid fa-file-excel text-xs"></i>
                        </div>
                        <span className="text-base md:text-lg font-bold text-gray-800 uppercase">Mass Import Excel</span>
                    </legend>
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 text-slate-600 text-sm">
                            <p className="mb-4">Upload an Excel file (.xlsx or .xls) containing your lab comparison data. <strong>Warning:</strong> Uploading a new sheet will completely overwrite the existing comparison mapping data.</p>
                            <p className="font-bold">Format required:</p>
                            <ul className="list-disc list-inside mt-1 ml-2">
                                <li>Row 1: Column A "Test Name", Column B+ Lab Names.</li>
                                <li>Row 2+: Column A specific test name, Column B+ numeric price.</li>
                            </ul>
                        </div>
                        <div className="flex-1">
                            <form onSubmit={handleUpload} className="bg-slate-50 p-4 rounded-lg border border-slate-100 h-full flex flex-col justify-center">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Select Excel File</label>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-300 rounded-lg p-2 bg-white mb-4"
                                    required
                                />
                                <button type="submit" disabled={uploading} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50">
                                    {uploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                                    {uploading ? 'Uploading and Parsing...' : 'Overwite & Import Data'}
                                </button>
                            </form>
                        </div>
                    </div>
                </fieldset>

                {/* Manual Sync Section */}
                <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl min-w-0">
                    <legend className="px-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                        </div>
                        <span className="text-base md:text-lg font-bold text-gray-800 uppercase">Manual Records Sync</span>
                    </legend>
                    
                    {/* Add Lab Form */}
                    <div className="bg-rose-50/50 p-4 rounded-lg border border-rose-100 mb-6">
                        <h3 className="text-sm font-bold text-rose-800 uppercase tracking-widest mb-3">Manage Labs (Columns)</h3>
                        <div className="flex flex-col md:flex-row gap-6">
                            <form onSubmit={handleAddLab} className="flex-1 flex gap-2 items-end">
                                <div className="flex-1 space-y-1">
                                     <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">New Lab Name</label>
                                     <input value={newLabName} onChange={e => setNewLabName(e.target.value)} required placeholder="e.g. Healthians" className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-rose-400 text-sm" />
                                </div>
                                <button type="submit" className="px-4 py-2 bg-rose-500 text-white font-bold rounded-lg hover:bg-rose-600 transition-all shadow-sm flex items-center justify-center gap-2 text-sm h-[38px] whitespace-nowrap">
                                    <i className="fa-solid fa-vial"></i> Add Lab
                                </button>
                            </form>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-1">Current Labs (Click to Delete)</label>
                                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                    {labs.map(lab => (
                                        <button key={lab.id} onClick={() => handleDeleteLab(lab.id)} title="Delete this lab" className="bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center gap-1 group">
                                            <span>{lab.name}</span>
                                            <i className="fa-solid fa-times opacity-50 group-hover:opacity-100"></i>
                                        </button>
                                    ))}
                                    {labs.length === 0 && <span className="text-xs text-slate-400 italic">No labs found. Upload an excel sheet or add one manually.</span>}
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Add New Test Form */}
                    {labs.length > 0 && (
                        <div className="bg-yellow-50/50 p-4 rounded-lg border border-yellow-100 mb-6">
                            <form onSubmit={handleAddTest} className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-12 lg:col-span-4 space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">New Test Name</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-flask absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                            <input value={newTestName} onChange={e => setNewTestName(e.target.value)} required placeholder="e.g. Lipid Profile" className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-yellow-50 text-sm font-bold" />
                                        </div>
                                    </div>
                                    <div className="md:col-span-12 lg:col-span-8 overflow-x-auto pb-2 custom-scrollbar-minimal">
                                        <div className="flex gap-3 min-w-max p-1">
                                            {labs.map(lab => (
                                                <div key={lab.id} className="w-32 space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 truncate block" title={lab.name}>{lab.name} (₹)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">₹</span>
                                                        <input type="number" step="0.01" value={newTestPrices[lab.id] || ''} onChange={e => setNewTestPrices({ ...newTestPrices, [lab.id]: e.target.value })} placeholder="0.00" className="w-full pl-6 p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-yellow-50 text-xs font-mono" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button type="submit" className="px-6 py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 transition-all shadow-sm flex items-center justify-center gap-2 text-sm h-[38px] w-full md:w-auto">
                                        <i className="fa-solid fa-plus-circle"></i> Add Single Record
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Existing Data Table */}
                    <div className="relative flex flex-col pt-4">
                        <div className="md:absolute static top-0 right-0 md:-translate-y-2 mb-4 md:mb-0 flex justify-end order-1 md:order-none">
                            <div className="search-container w-full md:w-64 bg-white shadow-sm md:shadow-none">
                                <i className="fa-solid fa-magnifying-glass text-gray-700 text-xs mr-2"></i>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search mapping records..."
                                    className="search-input"
                                />
                            </div>
                        </div>
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 order-2">Master Mapping Directory</h3>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-h-[60vh] overflow-y-auto custom-scrollbar-minimal">
                        <table className="w-full min-w-max text-sm divide-y divide-slate-200">
                            <thead className="bg-gray-50 sticky top-0 z-20">
                                <tr>
                                    <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest min-w-[200px] border-r border-gray-200 bg-gray-50 shadow-[0_1px_0_0_#e2e8f0]">Test Name</th>
                                    {labs.map(lab => (
                                        <th key={lab.id} className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest w-28 whitespace-nowrap bg-gray-50 shadow-[0_1px_0_0_#e2e8f0]" title={lab.name}>{lab.name}</th>
                                    ))}
                                    <th className="p-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest w-24 border-l border-gray-200 bg-gray-50 sticky right-0 shadow-[0_1px_0_0_#e2e8f0,-1px_0_0_0_#e2e8f0]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {isLoading ? (
                                    <tr><td colSpan={labs.length + 2} className="text-center py-8 text-slate-400 italic">Loading comparison data...</td></tr>
                                ) : filteredTests.length === 0 ? (
                                    <tr><td colSpan={labs.length + 2} className="text-center py-8 text-slate-400 italic">No tests found. Upload a sheet or add one manually.</td></tr>
                                ) : (
                                    filteredTests.map(test => (
                                        <tr key={test.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-3 font-medium text-slate-700 text-sm border-r border-slate-100">
                                                {test.name}
                                            </td>
                                            {labs.map(lab => {
                                                const priceInfo = prices.find(p => p.test_id === test.id && p.lab_id === lab.id);
                                                return (
                                                    <td key={lab.id} className="p-3 text-sm text-slate-600 font-mono">
                                                        {priceInfo && priceInfo.price > 0 ? `₹${priceInfo.price.toFixed(2)}` : <span className="text-slate-300">-</span>}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-2 border-l border-slate-100 sticky right-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[-1px_0_0_0_#f1f5f9]">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => openEditModal(test)} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded border border-blue-100 transition-all" title="Edit Test">
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button onClick={() => handleDeleteTest(test.id)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded border border-red-100 transition-all" title="Delete Test">
                                                        <i className="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </fieldset>
            </div>

            {/* Editing Modal */}
            {editingTest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                     <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md flex flex-col border border-slate-200">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
                             <div>
                                <h2 className="text-lg font-bold text-slate-800">Edit Test Breakdown</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase">{editingTest.name}</p>
                            </div>
                            <button onClick={() => setEditingTest(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <i className="fa-solid fa-circle-xmark text-xl"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveTestModal} className="flex flex-col gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Test Name</label>
                                <input value={editingTest.name} onChange={e => setEditingTest({ ...editingTest, name: e.target.value })} required className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-50 text-sm font-medium" />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-[40vh] overflow-y-auto custom-scrollbar-minimal">
                                 <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Lab Prices (₹)</h3>
                                 <div className="space-y-3">
                                      {labs.map(lab => (
                                         <div key={lab.id} className="flex items-center gap-3">
                                             <label className="text-sm font-bold text-slate-600 w-1/2 truncate" title={lab.name}>{lab.name}</label>
                                             <div className="relative w-1/2">
                                                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">₹</span>
                                                 <input type="number" step="0.01" value={modalPrices[lab.id] || ''} onChange={e => setModalPrices({ ...modalPrices, [lab.id]: e.target.value })} placeholder="0.00" className="w-full pl-7 p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-50 text-sm font-mono" />
                                             </div>
                                         </div>
                                      ))}
                                      {labs.length === 0 && <span className="text-xs text-slate-400 italic">No labs configured.</span>}
                                 </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-200">
                                <button type="button" onClick={() => setEditingTest(null)} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-all text-sm">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all text-sm shadow-sm flex items-center justify-center gap-2">
                                     <i className="fa-solid fa-floppy-disk"></i> Save Changes
                                </button>
                            </div>
                        </form>
                     </div>
                </div>
            )}
        </div>
    );
};

export default ManageComparison;
