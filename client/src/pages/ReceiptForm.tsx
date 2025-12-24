import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { Customer, Lab, PackageList, Package } from '../types';
import SearchableDropdown from '../components/SearchableDropdown';

interface ItemRow {
    id: number;
    name: string;
    mrp: number;
    b2b_price: number;
    discount: number;
    isFromDb: boolean;
}

const prefixOptions = ['Mr.', 'Mrs.', 'Miss.', 'Baby.', 'Master.', 'Dr.', 'B/O', 'Ms.', 'C/O', 'S/O'];

const ReceiptForm: React.FC = () => {
    const { user, branch, updateUser } = useAuth();
    const navigate = useNavigate();

    // Data states
    const [labs, setLabs] = useState<Lab[]>([]);
    const [packageLists, setPackageLists] = useState<PackageList[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);

    // Form states
    const [selectedLabId, setSelectedLabId] = useState('');
    const [selectedListId, setSelectedListId] = useState('');

    const [customerMode, setCustomerMode] = useState<'new' | 'search'>('new');
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    const [newCustomer, setNewCustomer] = useState({ prefix: 'Mr.', name: '', mobile: '', dob: '', age: '', gender: 'Male' as 'Male' | 'Female' });
    const [isGenderDisabled, setIsGenderDisabled] = useState(true);

    const [items, setItems] = useState<ItemRow[]>([{ id: Date.now(), name: '', mrp: 0, b2b_price: 0, discount: 0, isFromDb: false }]);

    const [applyDiscount, setApplyDiscount] = useState('');

    const [details, setDetails] = useState({
        amount_received: '',
        due_amount_manual: '',
        num_tests: '',
        referred_by: '',
        payment_method: 'Cash',
        notes: '',
    });
    const [showPreview, setShowPreview] = useState(false);

    // Fetch initial data
    useEffect(() => {
        apiService.getLabs().then(setLabs);
    }, []);

    // Handle cascading dropdowns
    useEffect(() => {
        setPackageLists([]);
        setPackages([]);
        setSelectedListId('');
        if (selectedLabId && user) {
            // Fix: Call the correct API method 'getPackageListsForLab' which was missing.
            apiService.getPackageListsForLab(parseInt(selectedLabId)).then(setPackageLists);
        }
    }, [selectedLabId, user]);

    useEffect(() => {
        setPackages([]);
        if (selectedListId) {
            apiService.getPackagesForList(parseInt(selectedListId)).then(setPackages);
        }
    }, [selectedListId]);

    // Customer search logic
    useEffect(() => {
        if (customerSearch.length > 0) {
            const timer = setTimeout(() => {
                // Fix: Call the correct API method 'searchCustomers' which was missing.
                apiService.searchCustomers(customerSearch).then(setCustomerSuggestions);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setCustomerSuggestions([]);
        }
    }, [customerSearch]);

    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        const prefix = customer.prefix || 'Mr.';
        const gender = customer.gender || 'Male';
        setNewCustomer({
            prefix,
            name: customer.name,
            mobile: customer.mobile || '',
            dob: customer.dob || '',
            age: customer.age?.toString() || '',
            gender
        });

        const isLocked = ['Mr.', 'Master.', 'B/O', 'S/O', 'Mrs.', 'Miss.', 'Ms.'].includes(prefix);
        setIsGenderDisabled(isLocked);

        setCustomerSearch('');
        setCustomerSuggestions([]);
    };

    const clearCustomer = () => {
        setSelectedCustomer(null);
        setNewCustomer({ prefix: 'Mr.', name: '', mobile: '', dob: '', age: '', gender: 'Male' });
        setIsGenderDisabled(true);
        setCustomerMode('new');
    }

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let customerData = { ...newCustomer };

        if (name === 'mobile') {
            const mobileValue = value.replace(/[^0-9]/g, '');
            if (mobileValue.length <= 10) {
                customerData.mobile = mobileValue;
            }
        } else if (name === 'prefix') {
            const newPrefix = value;
            customerData.prefix = newPrefix;
            let isGenderLocked = false;

            switch (newPrefix) {
                case 'Mr.':
                case 'Master.':
                case 'B/O':
                case 'S/O':
                    customerData.gender = 'Male';
                    isGenderLocked = true;
                    break;
                case 'Mrs.':
                case 'Miss.':
                case 'Ms.':
                    customerData.gender = 'Female';
                    isGenderLocked = true;
                    break;
                default:
                    isGenderLocked = false;
                    break;
            }
            setIsGenderDisabled(isGenderLocked);
        } else {
            customerData = { ...customerData, [name]: value };
        }
        setNewCustomer(customerData);
    };

    const handleItemChange = (id: number, field: keyof ItemRow, value: string | number) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handlePackageSelect = (id: number, name: string) => {
        const pkg = packages.find(p => p.name === name);

        setItems(prevItems => {
            const updated = prevItems.map(item =>
                item.id === id ? {
                    ...item,
                    name: pkg ? pkg.name : name,
                    mrp: pkg ? pkg.mrp : item.mrp,
                    b2b_price: pkg ? pkg.b2b_price : item.b2b_price,
                    isFromDb: !!pkg
                } : item
            );

            // Auto-add row if this is the last row and name is selected
            const selectedItemIndex = updated.findIndex(i => i.id === id);
            if (selectedItemIndex === updated.length - 1 && name.trim() !== '') {
                return [...updated, { id: Date.now() + 1, name: '', mrp: 0, b2b_price: 0, discount: 0, isFromDb: false }];
            }
            return updated;
        });
    };

    const addItem = () => setItems(prev => [...prev, { id: Date.now(), name: '', mrp: 0, b2b_price: 0, discount: 0, isFromDb: false }]);
    const removeItem = (id: number) => items.length > 1 && setItems(items.filter(item => item.id !== id));

    const handleApplyDiscountToAll = () => {
        const disc = parseFloat(applyDiscount);
        if (!isNaN(disc) && disc >= 0 && disc <= 100) {
            setItems(items.map(item => ({ ...item, discount: disc })));
            setApplyDiscount('');
        }
    };

    // Add safety check for age
    const validateAge = (age: string) => {
        const num = parseInt(age);
        return !isNaN(num) && num >= 0 && num <= 100;
    }



    const calculations = useMemo(() => {
        let totalMrp = 0;
        let totalDiscountAmount = 0;
        let totalB2B = 0;

        items.forEach(item => {
            const mrp = Number(item.mrp) || 0;
            const b2b = Number(item.b2b_price) || 0;
            const discountPercent = Number(item.discount) || 0;

            totalMrp += mrp;
            totalDiscountAmount += mrp * (discountPercent / 100);
            totalB2B += b2b;
        });

        const subtotal = totalMrp - totalDiscountAmount;

        // ROUNDING LOGIC: < 0.50 -> floor, >= 0.50 -> ceil
        let netPayable = Math.round(subtotal);

        // Empty = Fully Paid logic
        const receivedInput = details.amount_received.trim();
        const received = receivedInput === '' ? netPayable : (parseFloat(receivedInput) || 0);

        const dueOverride = parseFloat(details.due_amount_manual);
        const amountDue = !isNaN(dueOverride) ? dueOverride : Math.max(0, netPayable - received);

        return { totalMrp, totalDiscountAmount, totalB2B, subtotal, netPayable, amountDue, received };
    }, [items, details.amount_received, details.due_amount_manual]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user || !branch) {
            alert("User or branch information is missing. Please log in again.");
            return;
        }

        if (newCustomer.age && !validateAge(newCustomer.age)) {
            alert("Age must be between 0 and 100.");
            return;
        }

        const receivedStr = details.amount_received.trim();
        const receivedValue = receivedStr === '' ? calculations.netPayable : parseFloat(receivedStr);

        if (receivedValue > calculations.netPayable) {
            alert("INVALID! RECEIVED AMOUNT CANNOT EXCEED NET PAYABLE. LEAVE BLANK FOR FULL PAYMENT.");
            return;
        }

        if (calculations.amountDue < 0) {
            alert("Received amount cannot be more than the final amount.");
            return;
        }

        // Filter empty rows
        const validItems = items.filter(i => i.name && i.name.trim() !== '');
        if (validItems.length === 0) {
            alert("Please add at least one test/package.");
            return;
        }

        setShowPreview(true);
    };

    const handleConfirmSave = async () => {
        if (!user || !branch) return;

        const validItems = items.filter(i => i.name && i.name.trim() !== '');
        const payload = {
            customer_data: { id: selectedCustomer?.id, ...newCustomer },
            lab_id: parseInt(selectedLabId),
            package_list_id: parseInt(selectedListId),
            items: validItems.map(({ id, isFromDb, ...rest }) => ({
                ...rest,
                discount: isNaN(rest.discount) ? 0 : rest.discount
            })),
            ...details,
            amount_received: details.amount_received.trim() === '' ? calculations.netPayable.toString() : details.amount_received,
            referred_by: details.referred_by || 'Self',
            amount_final: calculations.netPayable,
            amount_due: calculations.amountDue,
            total_mrp: calculations.totalMrp,
        };

        try {
            const { newReceipt, updatedUser } = await apiService.createReceipt(payload, user, branch);
            if (updatedUser) {
                updateUser(updatedUser);
            }
            navigate(`/receipt/${newReceipt.id}`);
        } catch (error) {
            alert(`Failed to create receipt: ${error}`);
        }
    };

    const handleDiscard = () => {
        if (window.confirm("Are you sure you want to discard this receipt? All entered data will be lost.")) {
            // Reset everything
            setItems([{ id: Date.now(), name: '', mrp: 0, b2b_price: 0, discount: 0, isFromDb: false }]);
            setNewCustomer({ prefix: 'Mr.', name: '', mobile: '', dob: '', age: '', gender: 'Male' });
            setSelectedCustomer(null);
            setCustomerSearch('');
            setCustomerMode('new');
            setSelectedLabId('');
            setSelectedListId('');
            setDetails({
                amount_received: '',
                due_amount_manual: '',
                num_tests: '',
                referred_by: '',
                payment_method: 'Cash',
                notes: '',
            });
            setShowPreview(false);
        }
    };

    if (showPreview) {
        return (
            <div className="p-4 sm:p-8 max-w-4xl mx-auto">
                <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg space-y-6">
                    <header className="border-b pb-4">
                        <h1 className="text-3xl font-bold text-gray-800">Preview Receipt</h1>
                        <p className="text-sm text-gray-500">Please review the details before saving.</p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Customer Info */}
                        <section className="space-y-2">
                            <h3 className="font-bold text-lg text-blue-800 border-b">Customer Information</h3>
                            <p><strong>Name:</strong> {newCustomer.prefix} {newCustomer.name}</p>
                            <p><strong>Mobile:</strong> {newCustomer.mobile || 'N/A'}</p>
                            <p><strong>Age/Gender:</strong> {newCustomer.age || 'N/A'} / {newCustomer.gender}</p>
                            <p><strong>Referred By:</strong> {details.referred_by || 'Self'}</p>
                        </section>

                        {/* Lab Info */}
                        <section className="space-y-2">
                            <h3 className="font-bold text-lg text-blue-800 border-b">Receipt Details</h3>
                            <p><strong>Lab:</strong> {labs.find(l => l.id === parseInt(selectedLabId))?.name}</p>
                            <p><strong>Rate List:</strong> {packageLists.find(p => p.id === parseInt(selectedListId))?.name}</p>
                            <p><strong>Payment Method:</strong> {details.payment_method}</p>
                        </section>
                    </div>

                    {/* Items Table */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-lg text-blue-800 border-b">Tests / Packages</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2 text-left">Test Name</th>
                                        <th className="p-2 text-right">MRP</th>
                                        <th className="p-2 text-right">Disc %</th>
                                        <th className="p-2 text-right">Net</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {items.filter(i => i.name).map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-2">{item.name}</td>
                                            <td className="p-2 text-right">₹{item.mrp.toFixed(2)}</td>
                                            <td className="p-2 text-right">{item.discount}%</td>
                                            <td className="p-2 text-right">₹{(item.mrp * (1 - item.discount / 100)).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Totals */}
                    <section className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm"><span>Total MRP:</span> <span>₹{calculations.totalMrp.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm text-red-600"><span>Total Discount:</span> <span>- ₹{calculations.totalDiscountAmount.toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Net Payable:</span> <span>₹{calculations.netPayable.toFixed(2)}</span></div>
                        <div className="flex justify-between text-blue-700 font-semibold"><span>Received Amount:</span> <span>₹{parseFloat(details.amount_received || '0').toFixed(2)}</span></div>
                        <div className="flex justify-between text-red-700 font-bold"><span>Balance Due:</span> <span>₹{calculations.amountDue.toFixed(2)}</span></div>
                    </section>

                    {details.notes && (
                        <div className="text-sm p-3 bg-yellow-50 rounded border border-yellow-200">
                            <strong>Notes:</strong> {details.notes}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t">
                        <button type="button" onClick={handleDiscard} className="flex-1 py-3 px-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2">
                            <i className="fa-solid fa-trash-can"></i> Discard
                        </button>
                        <button type="button" onClick={() => setShowPreview(false)} className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-2">
                            <i className="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button type="button" onClick={handleConfirmSave} className="flex-[2] py-3 px-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transform active:scale-95 transition-all flex items-center justify-center gap-2">
                            <i className="fa-solid fa-check-double"></i> Save & Confirm
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto">
            <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-xl shadow-lg space-y-6">
                <header>
                    <h1 className="text-3xl font-bold text-gray-800">Money Receipt Form</h1>
                    {branch && user && (
                        <p className="text-sm text-gray-500 mt-2">
                            Branch: <strong>{branch.name}</strong> | User: {user.username} | <Link to={user.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard'} className="text-blue-600">Dashboard</Link>
                        </p>
                    )}
                </header>

                <fieldset className="border-2 border-gray-300 p-4 rounded-lg">
                    <legend className="px-2 font-semibold text-lg text-gray-700">Customer</legend>
                    <div className="flex justify-end mb-2">
                        <button type="button" onClick={() => {
                            if (customerMode === 'search') {
                                clearCustomer();
                            } else {
                                setCustomerMode('search');
                            }
                        }} className="text-blue-600 text-sm">
                            {customerMode === 'search' ? <><i className="fa-solid fa-user-plus mr-1"></i> Enter New</> : <><i className="fa-solid fa-magnifying-glass mr-1"></i> Search Existing</>}
                        </button>
                    </div>
                    {customerMode === 'search' && (
                        <div className="relative mb-2">
                            <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search by name, mobile, or ID..." className="w-full p-2 border rounded" />
                            {customerSuggestions.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border mt-1 rounded shadow-lg max-h-48 overflow-y-auto">
                                    {customerSuggestions.map(cust => (
                                        <li key={cust.id} onClick={() => handleSelectCustomer(cust)} className="p-2 hover:bg-gray-100 cursor-pointer">{cust.name} - {cust.mobile}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    {selectedCustomer && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span><strong>Selected:</strong> {selectedCustomer.name} (ID: CUST-{String(selectedCustomer.id).padStart(10, '0')})</span>
                                <button type="button" onClick={clearCustomer} className="text-red-600 text-xs">Clear</button>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 md:col-span-2">
                            <select name="prefix" value={newCustomer.prefix} onChange={handleCustomerChange} disabled={selectedCustomer !== null} className="p-2 border rounded disabled:bg-gray-100 w-1/4">
                                {prefixOptions.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="text" name="name" placeholder="Customer Name" value={newCustomer.name} onChange={handleCustomerChange} disabled={selectedCustomer !== null} required className="p-2 border rounded disabled:bg-gray-100 w-3/4" />
                        </div>
                        <input type="tel" name="mobile" placeholder="10-digit Mobile (Optional)" value={newCustomer.mobile} onChange={handleCustomerChange} disabled={selectedCustomer !== null} pattern="\d{10}" title="Must be 10 digits" className="p-2 border rounded disabled:bg-gray-100" />
                        <input type="date" name="dob" placeholder="DOB" value={newCustomer.dob} onChange={handleCustomerChange} disabled={selectedCustomer !== null} className="p-2 border rounded disabled:bg-gray-100" />
                        <input type="number" name="age" placeholder="Age" max="100" value={newCustomer.age} onChange={handleCustomerChange} disabled={selectedCustomer !== null} className="p-2 border rounded disabled:bg-gray-100" />
                        <select name="gender" value={newCustomer.gender} onChange={handleCustomerChange} disabled={isGenderDisabled || selectedCustomer !== null} className="p-2 border rounded disabled:bg-gray-100">
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Referred By Dr.</label>
                            <input type="text" value={details.referred_by} onChange={e => setDetails({ ...details, referred_by: e.target.value })} className="w-full p-2 border rounded" placeholder="Doctor Name or 'Self'" />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="border-2 border-gray-300 p-4 rounded-lg">
                    <legend className="px-2 font-semibold text-lg text-gray-700">Receipt Details</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select value={selectedLabId} onChange={e => setSelectedLabId(e.target.value)} required className="p-2 border rounded">
                            <option value="">-- Select Lab --</option>
                            {labs.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
                        </select>
                        <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)} disabled={!selectedLabId} required className="p-2 border rounded">
                            <option value="">-- Select Rate Database --</option>
                            {packageLists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
                        </select>
                    </div>
                </fieldset>

                <fieldset className="border-2 border-gray-300 p-4 rounded-lg">
                    <legend className="px-2 font-semibold text-lg text-gray-700">Tests / Packages</legend>
                    {/* Item Headers */}
                    <div className="hidden md:grid md:grid-cols-12 gap-2 text-sm font-bold text-gray-600 mb-2 px-1">
                        <div className={`${user?.role === 'CLIENT' ? 'col-span-4' : 'col-span-5'}`}>Test Name</div>
                        {user?.role === 'CLIENT' && <div className="col-span-2 text-right">B2B (₹)</div>}
                        <div className="col-span-2 text-right">MRP (₹)</div>
                        <div className="col-span-2 text-right">Disc (%)</div>
                        <div className="col-span-1 text-right">Disc Amt</div>
                        <div className="col-span-1 text-right"></div>
                    </div>

                    <div className="space-y-4">
                        {items.map((item) => {
                            const otherSelectedNames = new Set(
                                items.filter(i => i.id !== item.id && i.name).map(i => i.name)
                            );
                            const dropdownOptions = packages
                                .filter(p => !otherSelectedNames.has(p.name))
                                .map(p => ({ value: p.name, label: p.name }));

                            return (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                                    <div className={`${user?.role === 'CLIENT' ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-5'}`}>
                                        <label className="md:hidden text-xs font-bold">Package</label>
                                        <SearchableDropdown options={dropdownOptions} value={item.name} onChange={name => handlePackageSelect(item.id, name)} placeholder="Select or type package" disabled={!selectedListId} />
                                    </div>
                                    {user?.role === 'CLIENT' && <div className="col-span-6 md:col-span-2"><label className="md:hidden text-xs font-bold">B2B (₹)</label><input type="number" value={item.b2b_price} readOnly className="w-full p-2 border rounded text-right bg-gray-100" /></div>}
                                    <div className="col-span-6 md:col-span-2"><label className="md:hidden text-xs font-bold">MRP (₹)</label><input type="number" step="0.01" value={item.mrp} onChange={e => handleItemChange(item.id, 'mrp', parseFloat(e.target.value))} required className="w-full p-2 border rounded text-right" readOnly={item.isFromDb || user?.role === 'CLIENT'} /></div>
                                    <div className="col-span-6 md:col-span-2"><label className="md:hidden text-xs font-bold">Disc (%)</label><input type="number" step="0.1" value={item.discount} onChange={e => handleItemChange(item.id, 'discount', parseFloat(e.target.value))} className="w-full p-2 border rounded text-right" /></div>
                                    <div className="col-span-6 md:col-span-1 text-right text-sm text-gray-500 font-mono"><label className="md:hidden text-xs font-bold">Disc Amt</label>₹{(item.mrp * item.discount / 100).toFixed(2)}</div>
                                    <div className="col-span-12 md:col-span-1 text-right">
                                        <button type="button" onClick={() => removeItem(item.id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs w-full md:w-auto"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <button type="button" onClick={addItem} disabled={!selectedListId} className="mt-4 px-3 py-1 bg-green-500 text-white rounded text-sm disabled:bg-gray-300">Add Item</button>
                </fieldset>

                <fieldset className="border-2 border-gray-300 p-4 rounded-lg">
                    <legend className="px-2 font-semibold text-lg text-gray-700">Payment & Details</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="flex items-center gap-2">
                            <input type="number" placeholder="Apply Disc to All (%)" value={applyDiscount} onChange={e => setApplyDiscount(e.target.value)} className="w-full p-2 border rounded" />
                            <button type="button" onClick={handleApplyDiscountToAll} className="p-2 bg-blue-500 text-white rounded"><i className="fa-solid fa-check"></i></button>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Received Amount</label>
                            <input type="number" value={details.amount_received} onChange={e => setDetails({ ...details, amount_received: e.target.value })} placeholder="Leave blank for full payment" className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Due Amount Override <span className="text-xs">(Optional)</span></label>
                            <input type="number" value={details.due_amount_manual} onChange={e => setDetails({ ...details, due_amount_manual: e.target.value })} placeholder="Auto-calculated" className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">No. of Tests <span className="text-xs">(Optional)</span></label>
                            <input type="number" value={details.num_tests} onChange={e => setDetails({ ...details, num_tests: e.target.value })} placeholder={`Auto: ${items.length}`} className="w-full p-2 border rounded" />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Payment Method</label>
                            <select value={details.payment_method} onChange={e => setDetails({ ...details, payment_method: e.target.value })} className="w-full p-2 border rounded">
                                <option>Cash</option><option>Card</option><option>UPI</option><option>Mixed</option><option>Other</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Notes</label>
                            <textarea value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} rows={2} className="w-full p-2 border rounded" />
                        </div>

                        {/* Live Calculation */}
                        <div className="md:col-span-2 mt-4 p-4 bg-gray-50 rounded-lg text-right space-y-1 text-sm font-medium">
                            <div className="flex justify-between"><span>Total MRP:</span> <span className="font-mono">₹{calculations.totalMrp.toFixed(2)}</span></div>
                            <div className="flex justify-between text-red-600"><span>Total Discount:</span> <span className="font-mono">- ₹{calculations.totalDiscountAmount.toFixed(2)}</span></div>
                            <hr />
                            <div className="flex justify-between font-bold text-base"><span>Net Payable:</span> <span className="font-mono">₹{calculations.netPayable.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Received:</span> <span className="font-mono">₹{calculations.received.toFixed(2)}</span></div>
                            <div className="flex justify-between font-bold text-base text-red-700"><span>Amount Due:</span> <span className="font-mono">₹{calculations.amountDue.toFixed(2)}</span></div>
                            {user?.role === 'CLIENT' && (
                                <div className="pt-2 border-t mt-2">
                                    <div className="flex justify-between font-bold text-green-700"><span>Your B2B Cost:</span><span className="font-mono">₹{calculations.totalB2B.toFixed(2)}</span></div>
                                </div>
                            )}
                        </div>
                    </div>
                </fieldset>

                <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition">Preview</button>
            </form>
        </div>
    );
};

export default ReceiptForm;