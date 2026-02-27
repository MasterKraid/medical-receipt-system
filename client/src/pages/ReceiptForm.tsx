import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CleanSelect from '../components/CleanSelect';
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

    // Mobile specific states
    const [step, setStep] = useState(1);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    const handlePrefixChange = (newPrefix: string) => {
        let customerData = { ...newCustomer, prefix: newPrefix };
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
        setNewCustomer(customerData);
        setIsGenderDisabled(isGenderLocked);
    };

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let customerData = { ...newCustomer };

        if (name === 'mobile') {
            const mobileValue = value.replace(/[^0-9]/g, '');
            if (mobileValue.length <= 10) {
                customerData.mobile = mobileValue;
            }
        } else if (name === 'prefix') {
            handlePrefixChange(value);
            return;
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
        let netPayable = Math.round(subtotal);
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
            setStep(1);
        }
    };

    const nextStep = () => {
        if (step === 1) {
            if (!newCustomer.name.trim()) {
                alert("Please enter the customer's name.");
                return;
            }
        } else if (step === 2) {
            if (!selectedLabId) {
                alert("Please select a laboratory.");
                return;
            }
            if (!selectedListId) {
                alert("Please select a rate category.");
                return;
            }
        } else if (step === 3) {
            const hasValidItem = items.some(i => i.name && i.name.trim() !== '');
            if (!hasValidItem) {
                alert("Please add at least one test/package.");
                return;
            }
        }
        setStep(prev => Math.min(4, prev + 1));
    };
    const prevStep = () => setStep(prev => Math.max(1, prev - 1));

    // --- RESTRUCTURED RENDER FUNCTIONS ---

    const renderCustomerStep = () => (
        <fieldset className="border-2 border-slate-200 p-4 rounded-xl space-y-4">
            <legend className="px-2 font-bold text-lg text-slate-700">1. Customer Information</legend>
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mb-2">
                <span className="text-sm font-medium text-slate-600">
                    {customerMode === 'search' ? 'Search Existing' : 'Register New'}
                </span>
                <button type="button" onClick={() => customerMode === 'search' ? clearCustomer() : setCustomerMode('search')} className="text-blue-600 text-sm font-bold flex items-center gap-1">
                    {customerMode === 'search' ? <><i className="fa-solid fa-user-plus"></i> New</> : <><i className="fa-solid fa-magnifying-glass"></i> Search</>}
                </button>
            </div>
            {customerMode === 'search' && (
                <div className="relative mb-2">
                    <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search name/mobile..." className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm" />
                    {customerSuggestions.length > 0 && (
                        <ul className="absolute z-50 w-full bg-white border border-slate-200 mt-1 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                            {customerSuggestions.map(cust => (
                                <li key={cust.id} onClick={() => handleSelectCustomer(cust)} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 border-slate-100 transition-colors flex justify-between items-center text-sm">
                                    <span>{cust.name}</span>
                                    <span className="text-slate-400 text-xs font-mono">{cust.mobile}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {selectedCustomer && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex justify-between items-center shadow-inner">
                    <span className="text-sm font-bold text-blue-800">CUST-{String(selectedCustomer.id).padStart(10, '0')}</span>
                    <button type="button" onClick={clearCustomer} className="text-red-500 font-bold text-xs">DISC</button>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-2 md:col-span-2">
                    <CleanSelect options={prefixOptions.map(p => ({ value: p, label: p }))} value={newCustomer.prefix || ''} onChange={handlePrefixChange} disabled={selectedCustomer !== null} className="w-24" />
                    <input type="text" name="name" placeholder="Full Name" value={newCustomer.name} onChange={handleCustomerChange} disabled={selectedCustomer !== null} required className="flex-grow p-3 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 transition-all text-sm font-medium" />
                </div>
                <input type="tel" name="mobile" placeholder="Mobile (Optional)" value={newCustomer.mobile} onChange={handleCustomerChange} disabled={selectedCustomer !== null} pattern="\d{10}" className="p-3 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                    <input type="number" name="age" placeholder="Age" max="120" value={newCustomer.age} onChange={handleCustomerChange} disabled={selectedCustomer !== null} className="p-3 border border-slate-200 rounded-xl text-sm" />
                    <input type="date" name="dob" value={newCustomer.dob} onChange={handleCustomerChange} disabled={selectedCustomer !== null} className="p-3 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div className="md:col-span-2">
                    <div className="grid grid-cols-2 gap-2">
                        <CleanSelect options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]} value={newCustomer.gender || ''} onChange={val => setNewCustomer({ ...newCustomer, gender: val as 'Male' | 'Female' })} disabled={isGenderDisabled || selectedCustomer !== null} placeholder="Gender" />
                        <input type="text" value={details.referred_by} onChange={e => setDetails({ ...details, referred_by: e.target.value })} className="p-3 border border-slate-200 rounded-xl text-sm" placeholder="Self or Doctor Name" />
                    </div>
                </div>
            </div>
        </fieldset>
    );

    const renderReceiptDetailsStep = () => (
        <fieldset className="border-2 border-slate-200 p-4 rounded-xl space-y-4">
            <legend className="px-2 font-bold text-lg text-slate-700">2. Lab Selection</legend>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Laboratory</label>
                    <CleanSelect options={labs.map(lab => ({ value: lab.id.toString(), label: lab.name }))} value={selectedLabId} onChange={val => setSelectedLabId(val)} placeholder="Select Lab" />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Rate Category</label>
                    <CleanSelect options={packageLists.map(list => ({ value: list.id.toString(), label: list.name }))} value={selectedListId} onChange={val => setSelectedListId(val)} disabled={!selectedLabId} placeholder="Select Rate System" />
                </div>
            </div>
        </fieldset>
    );

    const renderPackagesStep = () => (
        <fieldset className="border-2 border-slate-200 p-4 rounded-xl space-y-4">
            <legend className="px-2 font-bold text-lg text-slate-700">3. Select Tests</legend>
            <div className="hidden md:grid md:grid-cols-12 gap-2 text-xs font-black text-slate-400 uppercase tracking-tighter mb-2 px-1">
                <div className={`${user?.role === 'CLIENT' ? 'col-span-5' : 'col-span-7'}`}>Test Name/Package</div>
                {user?.role === 'CLIENT' && <div className="col-span-2 text-right">B2B Cost</div>}
                <div className="col-span-2 text-right">MRP (₹)</div>
                <div className="col-span-1 text-right">Disc %</div>
                <div className="col-span-1 text-right px-1">Disc ₹</div>
                <div className="col-span-1"></div>
            </div>

            <div className="space-y-3">
                {items.map((item) => {
                    const otherSelectedNames = new Set(items.filter(i => i.id !== item.id && i.name).map(i => i.name));
                    const dropdownOptions = packages.filter(p => !otherSelectedNames.has(p.name)).map(p => ({ value: p.name, label: p.name }));
                    return (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-end border-b pb-4 last:border-0 hover:bg-slate-50 transition-colors">
                            <div className={`${user?.role === 'CLIENT' ? 'col-span-12 md:col-span-5' : 'col-span-12 md:col-span-7'}`}>
                                <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Test Name</label>
                                <SearchableDropdown options={dropdownOptions} value={item.name} onChange={name => handlePackageSelect(item.id, name)} placeholder="Choose Package..." disabled={!selectedListId} />
                            </div>
                            {user?.role === 'CLIENT' && (
                                <div className="col-span-4 md:col-span-2 text-right">
                                    <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">B2B</label>
                                    <div className="p-2.5 bg-green-50 text-green-700 rounded-xl font-bold text-xs border border-green-100">₹{item.b2b_price.toFixed(0)}</div>
                                </div>
                            )}
                            <div className="col-span-4 md:col-span-2">
                                <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">MRP</label>
                                <input type="number" step="0.01" value={item.mrp} onChange={e => handleItemChange(item.id, 'mrp', parseFloat(e.target.value))} required className="w-full p-2.5 border border-slate-200 rounded-xl text-right text-xs font-bold" readOnly={item.isFromDb || user?.role === 'CLIENT'} />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Disc %</label>
                                <input type="number" step="0.1" value={item.discount} onChange={e => handleItemChange(item.id, 'discount', parseFloat(e.target.value))} className="w-full p-2.5 border border-slate-200 rounded-xl text-right text-xs font-bold" />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Disc ₹</label>
                                <div className="p-2.5 bg-slate-50 text-slate-700 rounded-xl text-right font-bold text-xs border border-slate-100 h-[38px] flex items-center justify-end">
                                    ₹{(item.mrp * (item.discount / 100)).toFixed(0)}
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-1 text-right flex justify-end items-center h-10">
                                <button type="button" onClick={() => removeItem(item.id)} className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-full border border-red-200 hover:bg-red-500 hover:text-white transition-all shadow-sm"><i className="fa-solid fa-trash-can text-sm"></i></button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button type="button" onClick={addItem} disabled={!selectedListId} className="w-full md:w-auto mt-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-200 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:bg-slate-300">
                <i className="fa-solid fa-plus"></i> Add Another Test
            </button>
        </fieldset>
    );

    const renderPaymentStep = () => (
        <fieldset className="border-2 border-slate-200 p-4 rounded-xl space-y-4">
            <legend className="px-2 font-bold text-lg text-slate-700">4. Payment & Finalize</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Bulk Discount (%)</label>
                    <div className="flex gap-2">
                        <input type="number" value={applyDiscount} onChange={e => setApplyDiscount(e.target.value)} className="flex-grow p-3 border border-slate-200 rounded-xl text-sm" placeholder="0%" />
                        <button type="button" onClick={handleApplyDiscountToAll} className="px-4 bg-slate-800 text-white rounded-xl"><i className="fa-solid fa-check"></i></button>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Received Amount</label>
                        <input type="number" value={details.amount_received} onChange={e => setDetails({ ...details, amount_received: e.target.value })} placeholder="Full Payment (Leave Blank)" className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-blue-700" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Payment via</label>
                        <CleanSelect options={[{ value: 'Cash', label: 'Cash' }, { value: 'Card', label: 'Card' }, { value: 'UPI', label: 'UPI' }, { value: 'Mixed', label: 'Mixed' }, { value: 'Other', label: 'Other' }]} value={details.payment_method} onChange={val => setDetails({ ...details, payment_method: val })} />
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Administrative Notes</label>
                    <textarea value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} rows={2} className="w-full p-3 border border-slate-200 rounded-xl text-sm" placeholder="Special instructions..." />
                </div>
                <div className="md:col-span-2 bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4">
                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                        <span className="text-slate-500">Gross Total (MRP)</span>
                        <span className="text-right font-medium">₹{calculations.totalMrp.toFixed(0)}</span>

                        <span className="text-slate-500">Total Discount</span>
                        <span className="text-right font-medium text-green-600">- ₹{calculations.totalDiscountAmount.toFixed(0)}</span>

                        <div className="col-span-2 border-t border-slate-200 my-1"></div>

                        <span className="text-lg font-black text-slate-900">Net Payable</span>
                        <span className="text-right text-xl font-black text-blue-600">₹{calculations.netPayable.toFixed(0)}</span>

                        <span className="text-sm text-slate-500 mt-2">Amount Received</span>
                        <span className="text-right font-bold text-slate-700 mt-2">₹{calculations.received.toFixed(0)}</span>
                    </div>

                    <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex justify-between items-center">
                        <span className="text-xs font-black text-orange-600 uppercase tracking-widest">Pending Balance</span>
                        <span className="text-xl font-black text-orange-700">₹{calculations.amountDue.toFixed(0)}</span>
                    </div>
                </div>
            </div>
        </fieldset>
    );

    if (showPreview) {
        return (
            <div className="p-4 sm:p-8 max-w-4xl mx-auto">
                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl space-y-6 border border-slate-100">
                    <header className="border-b border-slate-100 pb-5">
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Review Order</h1>
                        <p className="text-sm font-medium text-slate-400 tracking-wide uppercase">Final Validation</p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <section className="space-y-3">
                            <h3 className="font-black text-xs text-blue-600 uppercase tracking-widest">Customer</h3>
                            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                                <p className="font-bold text-slate-800">{newCustomer.prefix} {newCustomer.name}</p>
                                <p className="text-sm text-slate-500">{newCustomer.mobile || 'No Mobile'}</p>
                                <p className="text-sm text-slate-500">{newCustomer.age || 'N/A'} yrs • {newCustomer.gender}</p>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="font-black text-xs text-blue-600 uppercase tracking-widest">Receipt Info</h3>
                            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                                <p className="font-bold text-slate-800">{labs.find(l => l.id === parseInt(selectedLabId))?.name}</p>
                                <p className="text-sm text-slate-500">{packageLists.find(p => p.id === parseInt(selectedListId))?.name}</p>
                                <p className="text-sm font-bold text-slate-600">Payment: {details.payment_method}</p>
                            </div>
                        </section>
                    </div>

                    <section className="space-y-3">
                        <h3 className="font-black text-xs text-blue-600 uppercase tracking-widest">Tests & Pricing</h3>
                        <div className="overflow-hidden border border-slate-100 rounded-xl">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="p-3 text-left font-bold text-slate-600">Package</th>
                                        <th className="p-3 text-right font-bold text-slate-600">MRP</th>
                                        <th className="p-3 text-right font-bold text-slate-600">Net</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.filter(i => i.name).map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3 font-medium">{item.name}</td>
                                            <td className="p-3 text-right text-slate-400">₹{item.mrp.toFixed(0)}</td>
                                            <td className="p-3 text-right font-bold">₹{(item.mrp * (1 - item.discount / 100)).toFixed(0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="bg-slate-900 text-white p-6 rounded-2xl space-y-3 shadow-2xl">
                        <div className="flex justify-between text-sm opacity-60"><span>Gross Value</span> <span>₹{calculations.totalMrp.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm text-red-400 font-bold"><span>Total Discount</span> <span>- ₹{calculations.totalDiscountAmount.toFixed(2)}</span></div>
                        <div className="flex justify-between text-2xl font-black border-t border-slate-800 pt-3 text-green-400"><span>NET PAYABLE</span> <span>₹{calculations.netPayable.toFixed(0)}</span></div>
                        <div className="flex justify-between text-sm font-bold text-blue-400 pt-1"><span>Received</span> <span>₹{calculations.received.toFixed(0)}</span></div>
                        <div className="flex justify-between text-lg font-black text-orange-400"><span>DUE BALANCE</span> <span>₹{calculations.amountDue.toFixed(0)}</span></div>
                    </section>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button type="button" onClick={handleDiscard} className="flex-1 py-4 px-4 bg-slate-50 text-slate-400 font-black rounded-xl hover:bg-red-50 hover:text-red-500 transition-all uppercase text-xs tracking-widest">
                            Discard
                        </button>
                        <button type="button" onClick={() => setShowPreview(false)} className="flex-1 py-4 px-4 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-800 hover:text-white transition-all uppercase text-xs tracking-widest">
                            Edit
                        </button>
                        <button type="button" onClick={handleConfirmSave} className="flex-[2] py-4 px-4 bg-green-500 text-white font-black rounded-xl hover:bg-green-600 shadow-xl shadow-green-100 transform active:scale-95 transition-all flex items-center justify-center gap-2 uppercase text-sm tracking-widest">
                            Save & Generate Receipt
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto min-h-screen">
            <form onSubmit={handleSubmit} className="space-y-6">
                {!isMobileView ? (
                    <div className="bg-white p-8 rounded-2xl shadow-2xl space-y-8 border border-slate-100">
                        <header className="flex justify-between items-center border-b border-slate-100 pb-6 mb-2">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">New Receipt</h1>
                                <div className="flex items-center gap-3 mt-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <span>{branch?.name}</span>
                                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                    <span>{user?.username}</span>
                                </div>
                            </div>
                            <Link to={user?.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard'} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-800 hover:text-white transition-all text-xs uppercase">
                                Dashboard
                            </Link>
                        </header>

                        {renderCustomerStep()}
                        {renderReceiptDetailsStep()}
                        {renderPackagesStep()}
                        {renderPaymentStep()}

                        <div className="pt-6 border-t border-slate-100">
                            <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black text-lg rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-100 transform active:scale-[0.98] transition-all uppercase tracking-widest">
                                Preview & Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-50 flex flex-col min-h-[85vh]">
                        <header className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">{step}</div>
                                <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Step {step} of 4</h2>
                            </div>
                            <button type="button" onClick={handleDiscard} className="text-slate-400 hover:text-red-500 transition-colors">
                                <i className="fa-solid fa-circle-xmark text-xl"></i>
                            </button>
                        </header>

                        <div className="p-5 flex-grow overflow-y-auto">
                            {step === 1 && renderCustomerStep()}
                            {step === 2 && renderReceiptDetailsStep()}
                            {step === 3 && renderPackagesStep()}
                            {step === 4 && renderPaymentStep()}
                        </div>

                        <footer className="p-6 bg-slate-50 rounded-b-3xl border-t border-slate-100 grid grid-cols-2 gap-4">
                            {step > 1 ? (
                                <button type="button" onClick={prevStep} className="py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest">
                                    Back
                                </button>
                            ) : (
                                <Link to={user?.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard'} className="py-4 bg-white border border-slate-200 text-slate-400 font-bold rounded-2xl text-center text-xs uppercase tracking-widest">
                                    Exit
                                </Link>
                            )}

                            {step < 4 ? (
                                <button type="button" onClick={nextStep} className="py-4 bg-blue-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-blue-100 text-xs uppercase tracking-widest disabled:bg-slate-300 disabled:shadow-none">
                                    Next
                                </button>
                            ) : (
                                <button type="submit" className="py-4 bg-green-500 text-white font-black rounded-2xl active:scale-95 transition-all shadow-lg shadow-green-100 text-xs uppercase tracking-widest">
                                    Review
                                </button>
                            )}
                        </footer>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ReceiptForm;