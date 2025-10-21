import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { PackageList, Package } from '../../types';

declare var XLSX: any;

const ManagePackageLists: React.FC = () => {
    const [lists, setLists] = useState<PackageList[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
        if(window.confirm("Are you sure you want to delete this entire rate list and all its packages? This action cannot be undone.")){
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
                           if (index > 0 && headers[index-1]) { // Ensure index is valid
                               rowData[headers[index-1]] = value;
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
        setPackages(prev => prev.map(p => p.id === id ? {...p, [field]: value} : p));
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
        if(!editingList) return;
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
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <PageHeader title="Manage Rate Databases (Package Lists)" />
                
                <section className="mb-8">
                     <h2 className="text-xl font-semibold mb-4 border-b pb-2">Add New List</h2>
                     <form onSubmit={handleAddList} className="flex items-end gap-4">
                         <div className="flex-grow">
                             <label htmlFor="newListName" className="block text-sm font-medium text-gray-700">List Name</label>
                             <input id="newListName" type="text" value={newListName} onChange={e => setNewListName(e.target.value)} required className="mt-1 w-full p-2 border rounded"/>
                         </div>
                         <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded h-fit">Create List</button>
                     </form>
                </section>
                
                <section>
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">Existing Lists</h2>
                     <div className="overflow-x-auto">
                        <table className="min-w-full bg-white text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="py-2 px-4 border-b text-left">List Name</th>
                                    <th className="py-2 px-4 border-b text-left">Packages</th>
                                    <th className="py-2 px-4 border-b text-left">Import from Excel</th>
                                    <th className="py-2 px-4 border-b text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={4} className="text-center py-4">Loading...</td></tr>
                                ) : (
                                    lists.map(list => (
                                        <tr key={list.id}>
                                            <td className="py-2 px-4 border-b font-semibold">{list.name}</td>
                                            <td className="py-2 px-4 border-b">{list.package_count}</td>
                                            <td className="py-2 px-4 border-b">
                                                <label className="px-3 py-1 bg-green-600 text-white rounded text-xs cursor-pointer hover:bg-green-700">
                                                    <i className="fa-solid fa-file-excel mr-1"></i> Upload
                                                    <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(list.id, e)} className="hidden" />
                                                </label>
                                            </td>
                                            <td className="py-2 px-4 border-b space-x-2">
                                                <button onClick={() => openEditModal(list)} className="px-3 py-1 bg-yellow-500 text-white rounded text-xs">View/Edit</button>
                                                <button onClick={() => handleDeleteList(list.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
            
            {isModalOpen && editingList && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <h2 className="text-xl font-bold mb-4">Editing Packages in: {editingList.name}</h2>
                        {/* Add new package form */}
                        <form onSubmit={handleAddNewPackage} className="grid grid-cols-12 gap-2 items-end mb-4 p-2 border rounded">
                             <input value={newPackage.name} onChange={e => setNewPackage({...newPackage, name: e.target.value})} placeholder="New Package Name" className="col-span-5 p-2 border rounded" required/>
                             <input type="number" value={newPackage.mrp} onChange={e => setNewPackage({...newPackage, mrp: e.target.value})} placeholder="MRP" className="col-span-2 p-2 border rounded" required/>
                             <input type="number" value={newPackage.b2b_price} onChange={e => setNewPackage({...newPackage, b2b_price: e.target.value})} placeholder="B2B Price" className="col-span-2 p-2 border rounded" required/>
                             <button type="submit" className="col-span-3 h-full px-4 py-2 bg-green-500 text-white rounded">Add Package</button>
                        </form>
                        
                        {/* Existing packages table */}
                        <div className="overflow-y-auto">
                             <table className="w-full text-sm">
                                <thead className="bg-gray-100 sticky top-0"><tr>
                                    <th className="p-2 border-b text-left">Package Name</th>
                                    <th className="p-2 border-b text-left w-24">MRP</th>
                                    <th className="p-2 border-b text-left w-24">B2B Price</th>
                                    <th className="p-2 border-b text-left w-20">Action</th>
                                </tr></thead>
                                <tbody>
                                    {packages.map(pkg => (
                                        <tr key={pkg.id}>
                                            <td className="p-1"><input value={pkg.name} onChange={e => handlePackageChange(pkg.id, 'name', e.target.value)} className="w-full p-1 border rounded" /></td>
                                            <td className="p-1"><input type="number" value={pkg.mrp} onChange={e => handlePackageChange(pkg.id, 'mrp', Number(e.target.value))} className="w-full p-1 border rounded" /></td>
                                            <td className="p-1"><input type="number" value={pkg.b2b_price} onChange={e => handlePackageChange(pkg.id, 'b2b_price', Number(e.target.value))} className="w-full p-1 border rounded" /></td>
                                            <td className="p-1"><button onClick={() => handleSavePackage(pkg)} className="w-full px-2 py-1 bg-blue-500 text-white rounded text-xs">Save</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-300 rounded">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagePackageLists;