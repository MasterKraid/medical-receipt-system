import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import CleanSelect from '../components/CleanSelect';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { Lab, PackageList, Package } from '../types';
import MultiSelectSearch from '../components/MultiSelectSearch';

const ClientRatelist: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Data states
    const [labs, setLabs] = useState<Lab[]>([]);
    const [packageLists, setPackageLists] = useState<PackageList[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);

    // Flow states
    const [step, setStep] = useState(1);
    
    // Step 1 states
    const [selectedLabId, setSelectedLabId] = useState('');
    const [selectedListId, setSelectedListId] = useState('');

    // Step 2 states
    const [showMRP, setShowMRP] = useState(true);
    const [showB2B, setShowB2B] = useState(true);

    // Step 3 states
    const [selectedTests, setSelectedTests] = useState<string[]>([]);

    useEffect(() => {
        apiService.getLabs().then(data => {
            setLabs(data);
            if (data.length > 0 && !selectedLabId) {
                setSelectedLabId(data[0].id.toString());
            }
        });
    }, []);

    useEffect(() => {
        setPackageLists([]);
        setPackages([]);
        setSelectedListId('');
        setSelectedTests([]);
        if (selectedLabId && user) {
            apiService.getPackageListsForLab(parseInt(selectedLabId)).then(data => {
                setPackageLists(data);
                if (data.length > 0) {
                    setSelectedListId(data[0].id.toString());
                }
            });
        }
    }, [selectedLabId, user]);

    useEffect(() => {
        setPackages([]);
        setSelectedTests([]);
        if (selectedListId) {
            apiService.getPackagesForList(parseInt(selectedListId)).then(data => {
                setPackages(data.filter(p => p.name && p.name.trim() !== ''));
            });
        }
    }, [selectedListId]);

    /* Auto-advance removed as requested to prevent skipping Step 1 when labs auto-select */
    /* 
    useEffect(() => {
        if (step === 1 && selectedLabId && selectedListId) {
            const timer = setTimeout(() => {
                setStep(2);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [selectedLabId, selectedListId, step]);
    */

    const nextStep = () => Math.min(4, step + 1);
    const prevStep = () => Math.max(1, step - 1);

    const calculations = useMemo(() => {
        let totalMrp = 0;
        let totalB2B = 0;
        
        const selectedPackages = packages.filter(p => selectedTests.includes(p.name));
        
        selectedPackages.forEach(pkg => {
            totalMrp += pkg.mrp || 0;
            totalB2B += pkg.b2b_price || 0;
        });

        return { 
            totalMrp, 
            totalB2B, 
            count: selectedPackages.length,
            selectedPackages
        };
    }, [selectedTests, packages]);

    const renderStep1 = () => (
        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl space-y-4 w-full min-w-0">
            <legend className="px-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
                    <i className="fa-solid fa-flask-vial text-xs"></i>
                </div>
                <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">Select Ratelist Source</span>
            </legend>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Laboratory</label>
                    <CleanSelect 
                        options={labs.map(lab => ({ value: lab.id.toString(), label: lab.name }))} 
                        value={selectedLabId} 
                        onChange={val => setSelectedLabId(val)} 
                        placeholder="Select Lab" 
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Rate Category</label>
                    <CleanSelect 
                        options={packageLists.map(list => ({ value: list.id.toString(), label: list.name }))} 
                        value={selectedListId} 
                        onChange={val => setSelectedListId(val)} 
                        disabled={!selectedLabId} 
                        placeholder="Select Rate System" 
                    />
                </div>
            </div>
            <div className="pt-4 flex justify-end">
                <button 
                    onClick={() => {
                        if (!selectedLabId || !selectedListId) {
                            alert("Please select both a Lab and a Ratelist category.");
                            return;
                        }
                        setStep(nextStep());
                    }} 
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition-colors"
                >
                    Next
                </button>
            </div>
        </fieldset>
    );

    const renderStep2 = () => (
        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl space-y-4 w-full min-w-0">
            <legend className="px-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
                    <i className="fa-solid fa-sliders text-xs"></i>
                </div>
                <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">Display Options</span>
            </legend>
            <div className="space-y-4">
                <p className="text-sm text-slate-600 mb-4 cursor-default">Select the pricing you want to view in your ratelist.</p>
                
                <label className="flex items-center p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                        type="checkbox" 
                        checked={showB2B} 
                        onChange={(e) => setShowB2B(e.target.checked)} 
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-4">
                        <div className="font-bold text-slate-800">Show B2B Price</div>
                        <div className="text-xs text-slate-500">Your specific business-to-business cost</div>
                    </div>
                </label>
                
                <label className="flex items-center p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                        type="checkbox" 
                        checked={showMRP} 
                        onChange={(e) => setShowMRP(e.target.checked)} 
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-4">
                        <div className="font-bold text-slate-800">Show MRP</div>
                        <div className="text-xs text-slate-500">Maximum Retail Price for the customer</div>
                    </div>
                </label>
            </div>
            <div className="pt-4 flex justify-between">
                <button onClick={() => setStep(prevStep())} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Back</button>
                <button 
                    onClick={() => {
                        if (!showB2B && !showMRP) {
                            alert("Please select at least one price to display.");
                            return;
                        }
                        setStep(nextStep());
                    }} 
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition-colors"
                >
                    Next
                </button>
            </div>
        </fieldset>
    );

    const renderStep3 = () => {
        const dropdownOptions = packages.map(p => ({ value: p.name, label: p.name }));
        
        return (
            <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl space-y-4 text-left w-full min-w-0">
                <legend className="px-3 flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
                        <i className="fa-solid fa-magnifying-glass text-xs"></i>
                    </div>
                    <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">Search & Select Tests</span>
                </legend>
                
                <div className="mb-4">
                    <MultiSelectSearch 
                        options={dropdownOptions}
                        selectedValues={selectedTests}
                        onChange={setSelectedTests}
                        placeholder="Type here to search tests..."
                    />
                </div>
                
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center">
                    <span className="font-bold text-blue-800">Selected Tests</span>
                    <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">
                        {selectedTests.length}
                    </span>
                </div>

                {selectedTests.length > 0 && (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                        {selectedTests.map(testName => (
                            <div key={testName} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-red-200 group transition-all">
                                <span className="font-medium text-slate-700 text-sm truncate pr-4">{testName}</span>
                                <button 
                                    onClick={() => setSelectedTests(prev => prev.filter(t => t !== testName))}
                                    className="text-red-400 group-hover:text-red-600 transition-colors p-1"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="pt-4 flex justify-between">
                    <button onClick={() => setStep(prevStep())} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Back</button>
                    <button 
                        onClick={() => {
                            if (selectedTests.length === 0) {
                                alert("Please select at least one test.");
                                return;
                            }
                            setStep(nextStep());
                        }} 
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition-colors"
                    >
                        View Summary
                    </button>
                </div>
            </fieldset>
        );
    };

    const renderStep4 = () => (
        <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl space-y-6 w-full min-w-0">
            <legend className="px-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                    <i className="fa-solid fa-calculator text-xs"></i>
                </div>
                <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">Ratelist Summary</span>
            </legend>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Tests</div>
                    <div className="text-2xl font-black text-slate-800">{calculations.count}</div>
                </div>
                
                {showB2B && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-center shadow-sm shadow-green-100">
                        <div className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Total B2B</div>
                        <div className="text-2xl font-black text-green-700">₹{calculations.totalB2B.toFixed(0)}</div>
                    </div>
                )}
                
                {showMRP && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center shadow-sm shadow-blue-100">
                        <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Total MRP</div>
                        <div className="text-2xl font-black text-blue-700">₹{calculations.totalMrp.toFixed(0)}</div>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
                <table className="min-w-full text-sm table-fixed">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 text-left font-bold text-slate-600 uppercase tracking-wider text-xs">Test Name</th>
                            {showB2B && <th className="p-4 text-right font-bold text-slate-600 uppercase tracking-wider text-xs w-24">B2B</th>}
                            {showMRP && <th className="p-4 text-right font-bold text-slate-600 uppercase tracking-wider text-xs w-24">MRP</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {calculations.selectedPackages.map((pkg, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-800 break-words line-clamp-2">{pkg.name}</td>
                                {showB2B && <td className="p-4 text-right font-bold text-green-700 bg-green-50/30">₹{pkg.b2b_price.toFixed(0)}</td>}
                                {showMRP && <td className="p-4 text-right font-bold text-slate-700">₹{pkg.mrp.toFixed(0)}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="pt-6 flex justify-between items-center border-t border-slate-200">
                <button onClick={() => setStep(prevStep())} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Edit Tests</button>
                <button 
                    onClick={() => navigate('/dashboard')} 
                    className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 shadow-xl shadow-slate-200 transition-all active:scale-95"
                >
                    Exit to Dashboard
                </button>
            </div>
        </fieldset>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <div className="max-w-4xl mx-auto px-4 pt-10">
                <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-xl shadow-slate-100/50 border border-slate-100 text-left pb-[60vh] max-w-full overflow-hidden">
                    <PageHeader title="My Ratelist" backLink="/dashboard" />
                    
                    {/* Progress Indicators */}
                    <div className="mb-10 overflow-x-auto pb-6 pt-6 hide-scrollbar">
                        <div className="flex justify-between items-center min-w-[500px] px-2 relative">
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 rounded-full -translate-y-1/2"></div>
                            
                            <div className={`absolute top-1/2 left-0 h-1 bg-blue-600 -z-10 transition-all duration-300 rounded-full -translate-y-1/2`} style={{ width: `${((step - 1) / 3) * 100}%` }}></div>

                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className="flex flex-col items-center gap-2 relative bg-white px-2 cursor-pointer" onClick={() => { if (s < step) setStep(s); }}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                                        step > s ? 'bg-blue-600 text-white ring-4 ring-blue-50' :
                                        step === s ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-md scale-110' :
                                        'bg-white text-slate-400 border-2 border-slate-200'
                                    }`}>
                                        {step > s ? <i className="fa-solid fa-check"></i> : s}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= s ? 'text-blue-800' : 'text-slate-400'}`}>
                                        {s === 1 ? 'Lab' : s === 2 ? 'Options' : s === 3 ? 'Tests' : 'Summary'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                        {step === 4 && renderStep4()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientRatelist;
