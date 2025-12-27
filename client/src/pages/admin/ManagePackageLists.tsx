import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { PackageList, Package } from '../../types';

declare var XLSX: any;
declare var ExcelJS: any;

const ManagePackageLists: React.FC = () => {
    const [lists, setLists] = useState<PackageList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingList, setEditingList] = useState<PackageList | null>(null);
    const [packages, setPackages] = useState<Package[]>([]);

    // Form States
    const [newListName, setNewListName] = useState('');
    const [newPackage, setNewPackage] = useState({ name: '', mrp: '', b2b_price: '' });

    useEffect(() => {
        fetchLists();
    }, []);

    const fetchLists = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getPackageLists();
            setLists(data);
        } catch (error) {
            console.error("Failed to fetch package lists", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredLists = React.useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return lists;
        return lists.filter(l => l.name.toLowerCase().includes(query));
    }, [lists, searchTerm]);

    const handleAddList = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiService.createPackageList(newListName);
            setNewListName('');
            fetchLists();
        } catch (error) {
            alert(`Error adding list: ${error}`);
        }
    };

    const handleDeleteList = async (listId: number) => {
        if (window.confirm("Are you sure you want to delete this entire rate list and all its packages? This action cannot be undone.")) {
            try {
                await apiService.deletePackageList(listId);
                fetchLists();
            } catch (error) {
                alert(`Error deleting list: ${error}`);
            }
        }
    };

    const handleFileUpload = (listId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (typeof ExcelJS === 'undefined') {
            alert('Excel library could not be loaded. Please check your internet connection or ad blocker and refresh the page.');
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const buffer = event.target?.result as ArrayBuffer;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);

                const worksheet = workbook.worksheets[0];
                if (!worksheet) {
                    throw new Error("No worksheets found in the Excel file.");
                }

                const json: any[] = [];
                // Get header row, filtering out any empty cells
                const headerRow = worksheet.getRow(1);
                const headers = headerRow.values as string[];
                headers.shift(); // Remove the empty value at the beginning if it exists

                // Iterate over all rows starting from the second row
                worksheet.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
                    if (rowNumber > 1) {
                        let rowData: any = {};
                        // Use the header array to map cell values to keys
                        row.values.forEach((value: any, index: number) => {
                            if (index > 0 && headers[index - 1]) { // Ensure index is valid
                                rowData[headers[index - 1]] = value;
                            }
                        });
                        json.push(rowData);
                    }
                });

                const requiredHeaders = ['name', 'mrp', 'b2b_price'];
                if (headers.length < 1 || !requiredHeaders.every(h => headers.includes(h))) {
                    throw new Error(`Invalid Excel format. The first row must contain these exact column headers: ${requiredHeaders.join(', ')}`);
                }

                const { inserted, updated } = await apiService.uploadPackages(listId, json);
                alert(`Import complete! ${inserted} new packages added, ${updated} packages updated.`);
                fetchLists();

            } catch (error) {
                alert(`Error importing file: ${error}`);
            } finally {
                e.target.value = ''; // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const openEditModal = async (list: PackageList) => {
        setEditingList(list);
        setIsModalOpen(true);
        try {
            const pkgs = await apiService.getPackagesForList(list.id);
            setPackages(pkgs);
        } catch (error) {
            console.error("Failed to fetch packages for list", error);
        }
    };

    const handlePackageChange = (id: number, field: 'name' | 'mrp' | 'b2b_price', value: string | number) => {
        setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    }

    const handleSavePackage = async (pkg: Package) => {
        try {
            await apiService.updatePackageInList(pkg);
            alert("Package saved!");
        } catch (error) {
            alert(`Error saving package: ${error}`);
        }
    };

    const handleAddNewPackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingList) return;
        try {
            const newPkg = await apiService.addPackageToList({
                name: newPackage.name,
                mrp: parseFloat(newPackage.mrp),
                b2b_price: parseFloat(newPackage.b2b_price),
                package_list_id: editingList.id
            });
            setPackages(prev => [...prev, newPkg]);
            setNewPackage({ name: '', mrp: '', b2b_price: '' });
        } catch (error) {
            alert(`Error adding package: ${error}`);
        }
    }


    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title="Rate Database Management" />

                {/* Add Rate List Form */}
                <fieldset className="border-2 border-gray-300 p-6 rounded-xl mb-10">
                    <legend className="px-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <i className="fa-solid fa-database text-xs"></i>
                        </div>
                        <span className="text-lg font-bold text-gray-800">Add Rate List</span>
                    </legend>

                    <form onSubmit={handleAddList} className="flex flex-col sm:flex-row items-end gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                        <div className="flex-grow w-full space-y-1">
                            <label htmlFor="newListName" className="text-[10px] font-bold text-gray-400 uppercase ml-1">Database Name (e.g. B2B 2024)</label>
                            <div className="relative">
                                <i className="fa-solid fa-tag absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                <input id="newListName" type="text" value={newListName} onChange={e => setNewListName(e.target.value)} required className="w-full pl-9 p-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-50 outline-none transition-all text-sm" />
                            </div>
                        </div>
                        <button type="submit" className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2 text-sm h-[38px] whitespace-nowrap">
                            <i className="fa-solid fa-plus-circle"></i> Create List
                        </button>
                    </form>
                </fieldset>
                {/* Existing Rate Lists Table */}
                <div className="relative">
                    <fieldset className="border-2 border-gray-300 p-6 rounded-xl">
                        <legend className="px-3 flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                <i className="fa-solid fa-layer-group text-xs"></i>
                            </div>
                            <span className="text-lg font-bold text-gray-800">Available Rate Lists</span>
                        </legend>

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full bg-white divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Database Name</th>
                                        <th className="py-3 px-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Packages</th>
                                        <th className="py-3 px-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300 w-24">Sync</th>
                                        <th className="py-3 px-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300 w-24">Import</th>
                                        <th className="py-3 px-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {isLoading ? (
                                        <tr><td colSpan={6} className="text-center py-12 text-gray-400 italic text-sm">Loading rate databases...</td></tr>
                                    ) : filteredLists.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-12 text-gray-400 italic text-sm">No rate lists matching your search.</td></tr>
                                    ) : (
                                        filteredLists.map(list => (
                                            <tr key={list.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="py-3 px-4">
                                                    <div className="text-sm font-bold text-gray-800">{list.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono italic">REF: #{list.id.toString().padStart(3, '0')}</div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100">
                                                        {list.package_count || 0} ITEMS
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button onClick={() => openEditModal(list)} className="px-3 py-1.5 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded border border-blue-100 transition-all font-bold text-[10px] mx-auto shadow-sm whitespace-nowrap" title="Sync Rates">
                                                        <i className="fa-solid fa-rotate"></i>
                                                        <span>Sync</span>
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <label className="px-3 py-1.5 flex items-center justify-center gap-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded border border-green-100 transition-all cursor-pointer font-bold text-[10px] mx-auto shadow-sm whitespace-nowrap" title="Import Packages">
                                                        <i className="fa-solid fa-file-import"></i>
                                                        <span>Import XLSX</span>
                                                        <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(list.id, e)} className="hidden" />
                                                    </label>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button onClick={() => handleDeleteList(list.id)} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-red-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm ml-auto" title="Delete Database">
                                                        <i className="fa-solid fa-trash-can text-xs"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </fieldset>

                    <div className="absolute top-0 right-6 -translate-y-[5px]">
                        <div className="search-container md:w-64 bg-white">
                            <i className="fa-solid fa-magnifying-glass text-gray-700 text-xs mr-2"></i>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search lists..."
                                className="search-input"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && editingList && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-200">
                        <div className="flex items-center justify-between mb-6 border-b border-gray-300 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-yellow-500 flex items-center justify-center text-white shadow-sm">
                                    <i className="fa-solid fa-cubes text-xs"></i>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">Inventory Management</h2>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{editingList.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <i className="fa-solid fa-circle-xmark text-xl"></i>
                            </button>
                        </div>

                        {/* Add new package form */}
                        <form onSubmit={handleAddNewPackage} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end mb-6 p-4 bg-gray-50/50 rounded-lg border border-gray-100">
                            <div className="sm:col-span-5 space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Package Label</label>
                                <input value={newPackage.name} onChange={e => setNewPackage({ ...newPackage, name: e.target.value })} placeholder="e.g. Master Panel" className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-yellow-50 text-sm" required />
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">MRP (₹)</label>
                                <input type="number" value={newPackage.mrp} onChange={e => setNewPackage({ ...newPackage, mrp: e.target.value })} placeholder="0.00" className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-yellow-50 text-sm" required />
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">B2B (₹)</label>
                                <input type="number" value={newPackage.b2b_price} onChange={e => setNewPackage({ ...newPackage, b2b_price: e.target.value })} placeholder="0.00" className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-yellow-50 text-sm" required />
                            </div>
                            <button type="submit" className="sm:col-span-3 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2 text-sm h-[38px]">
                                <i className="fa-solid fa-plus-circle"></i> Add Item
                            </button>
                        </form>

                        {/* Existing packages table */}
                        <div className="overflow-y-auto flex-grow rounded-lg border border-gray-200 bg-white shadow-inner custom-scrollbar-minimal">
                            <table className="w-full text-sm divide-y divide-gray-100">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-4 border-b border-gray-200">Package Name</th>
                                        <th className="p-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest w-24 border-b border-gray-200">MRP</th>
                                        <th className="p-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest w-24 border-b border-gray-200">B2B Price</th>
                                        <th className="p-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest pr-4 border-b border-gray-200">Save</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {packages.map(pkg => (
                                        <tr key={pkg.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="p-1 pl-4">
                                                <input value={pkg.name} onChange={e => handlePackageChange(pkg.id, 'name', e.target.value)} className="w-full p-1.5 bg-transparent border-b border-transparent focus:border-yellow-400 outline-none font-medium text-gray-700 text-sm" />
                                            </td>
                                            <td className="p-1">
                                                <div className="relative">
                                                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]">₹</span>
                                                    <input type="number" value={pkg.mrp} onChange={e => handlePackageChange(pkg.id, 'mrp', Number(e.target.value))} className="w-full p-1.5 pl-4 bg-transparent border-b border-transparent focus:border-yellow-400 outline-none text-gray-600 text-sm" />
                                                </div>
                                            </td>
                                            <td className="p-1">
                                                <div className="relative font-bold">
                                                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-blue-200 text-[10px]">₹</span>
                                                    <input type="number" value={pkg.b2b_price} onChange={e => handlePackageChange(pkg.id, 'b2b_price', Number(e.target.value))} className="w-full p-1.5 pl-4 bg-transparent border-b border-transparent focus:border-yellow-400 outline-none text-blue-700 font-bold text-sm" />
                                                </div>
                                            </td>
                                            <td className="p-1 text-right pr-4">
                                                <button onClick={() => handleSavePackage(pkg)} className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-blue-600 hover:text-white rounded border border-gray-100 transition-all" title="Save Product">
                                                    <i className="fa-solid fa-floppy-disk text-[10px]"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end mt-4 pt-4 border-t border-gray-300">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 transition-all border border-gray-200 text-xs">Finish Editing</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagePackageLists;