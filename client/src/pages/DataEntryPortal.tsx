import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import PageHeader from '../components/PageHeader';

interface DataEntryReceipt {
  id: number;
  customer_id: number;
  branch_id: number;
  created_at: string;
  referred_by?: string;
  notes?: string;
  num_tests: number;
  created_by_user_id: number;
  acting_as_client_id?: number;
  data_entry_done: number;
  prefix?: string;
  customer_name: string;
  mobile?: string;
  email?: string;
  dob?: string;
  age_years?: number;
  age_months?: number;
  age_days?: number;
  gender?: 'Male' | 'Female';
  created_by_user?: string;
  display_doc_id: string;
  display_date: string;
  display_customer_id: string;
  items: { package_name: string }[];
  lab_id?: number;
  lab_name?: string;
}

const CopyableField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <div
      onClick={handleCopy}
      className="group relative bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 p-3 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between"
    >
      <div className="min-w-0 pr-4">
        <div className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-550 uppercase tracking-wider leading-none mb-1">
          {label}
        </div>
        <div className="text-sm font-semibold text-slate-700 group-hover:text-indigo-900 truncate leading-tight select-none">
          {value || 'N/A'}
        </div>
      </div>
      <div className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0">
        <i className="fa-solid fa-copy text-xs"></i>
      </div>
      {copied && (
        <div className="absolute right-3 -top-2 bg-emerald-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded shadow-lg animate-bounce z-50">
          Copied!
        </div>
      )}
    </div>
  );
};

const CopyableBadge: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <div
      onClick={handleCopy}
      className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-900 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 select-none"
    >
      <span>{text}</span>
      <i className="fa-solid fa-copy text-[10px] text-slate-400 group-hover:text-indigo-550"></i>
      {copied && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow z-50">
          Copied!
        </div>
      )}
    </div>
  );
};

const DataEntryPortal: React.FC = () => {
  const { user } = useAuth();

  const [dateFilter, setDateFilter] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [receipts, setReceipts] = useState<DataEntryReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<DataEntryReceipt | null>(null);

  const [labs, setLabs] = useState<any[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>('');

  useEffect(() => {
    apiService.getLabs().then(data => {
      setLabs(data);
      if (data.length > 0) {
        setSelectedLabId(data[0].id.toString());
      }
    }).catch(console.error);
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      // Format YYYY-MM-DD to DD/MM/YYYY for SQLite pattern matching
      const [y, m, d] = dateFilter.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      const data = await apiService.getDataEntryReceipts(formattedDate);
      setReceipts(data);
    } catch (err) {
      console.error('Failed to load data entry receipts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const handleMarkDone = async (id: number) => {
    try {
      await apiService.updateDataEntryStatus(id, true);
      setSelectedReceipt(null);
      fetchReceipts();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleMarkIncomplete = async (id: number) => {
    const confirmRevert = window.confirm(
      '⚠️ Warning: Reverting this receipt will allow it to be edited in the software.\n\nPlease remember to edit data in the master website if changing here.\n\nAre you sure you want to mark this receipt as Incomplete?'
    );
    if (!confirmRevert) return;

    try {
      await apiService.updateDataEntryStatus(id, false);
      setSelectedReceipt(null);
      fetchReceipts();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const filteredReceipts = receipts.filter(r => {
    if (!selectedLabId) return true;
    return r.lab_id === parseInt(selectedLabId);
  });

  const pendingList = filteredReceipts.filter((r) => r.data_entry_done === 0);
  const completedList = filteredReceipts.filter((r) => r.data_entry_done === 1);

  const activeList = activeTab === 'pending' ? pendingList : completedList;

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
      <fieldset className="border-2 border-gray-300 p-4 sm:p-6 rounded-2xl bg-white shadow-sm space-y-6">
        <legend className="px-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <i className="fa-solid fa-keyboard text-xs"></i>
          </div>
          <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Data Entry Workspace</span>
        </legend>

        <PageHeader title="Data Entry Workspace" showActingAs={false} />

        {/* Labs Horizontal Pill Selector */}
        {labs.length > 0 && (
          <div className="space-y-2 mb-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
              Select Processing Laboratory
            </label>
            <div className="flex flex-wrap gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
              {labs.map((lab) => (
                <button
                  key={lab.id}
                  onClick={() => setSelectedLabId(lab.id.toString())}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                    selectedLabId === lab.id.toString()
                      ? 'bg-indigo-650 text-white border-indigo-750 shadow-md shadow-indigo-100 scale-[1.01]'
                      : 'bg-white text-slate-650 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <i className="fa-solid fa-flask mr-1.5 text-[10px]"></i>
                  {lab.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters and Date Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">
              Filter Transaction Date
            </label>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl h-10 w-full sm:w-60 shadow-sm">
              <i className="fa-solid fa-calendar text-slate-400 text-sm"></i>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full border-none outline-none text-xs font-bold text-slate-700 font-mono bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 mb-6 gap-3">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-indigo-600 text-indigo-650'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            Pending Tasks
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                pendingList.length > 0
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {pendingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'border-indigo-600 text-indigo-650'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <i className="fa-solid fa-circle-check"></i>
            Finalized Registry
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                completedList.length > 0
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {completedList.length}
            </span>
          </button>
        </div>

        {/* Active Registry Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-indigo-600"></i>
            <span className="text-xs font-bold uppercase tracking-widest italic animate-pulse">
              Retrieving patient documents...
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[700px] text-left border-collapse bg-white">
              <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                <tr>
                  <th className="p-4 pl-6">Patient Details</th>
                  <th className="p-4">Receipt Identifier</th>
                  <th className="p-4">Physician Referred</th>
                  <th className="p-4">Tests Ordered</th>
                  <th className="p-4 text-right pr-6 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {activeList.map((rcpt) => (
                  <tr
                    key={rcpt.id}
                    onClick={() => setSelectedReceipt(rcpt)}
                    className="hover:bg-indigo-50/20 cursor-pointer transition-colors group"
                  >
                    <td className="p-4 pl-6">
                      <span className="font-bold text-slate-800 group-hover:text-indigo-650 transition-colors text-sm">
                        {rcpt.prefix ? `${rcpt.prefix} ` : ''}
                        {rcpt.customer_name}
                      </span>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {rcpt.gender} • {rcpt.age_years || 0}Y {rcpt.age_months || 0}M{' '}
                        {rcpt.age_days || 0}D
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-650">{rcpt.display_doc_id}</td>
                    <td className="p-4 font-medium">{rcpt.referred_by || 'Self Referral'}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                        {rcpt.items?.length || rcpt.num_tests} Tests
                      </span>
                    </td>
                    <td className="p-4 text-right pr-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedReceipt(rcpt)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-650 border border-slate-200 hover:border-indigo-200 font-bold rounded-lg transition-all text-[11px]"
                        >
                          Inspect details
                        </button>
                        {activeTab === 'completed' && user?.role === 'ADMIN' && (
                          <button
                            onClick={() => handleMarkIncomplete(rcpt.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 border border-red-100 hover:border-red-200 font-bold rounded-lg transition-all text-[11px]"
                            title="Revert receipt back to incomplete status"
                          >
                            Revert
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {activeList.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-12 text-center text-slate-400 italic font-bold uppercase tracking-wider text-xs"
                    >
                      No receipts found for this selected date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>

      {/* Detail Modal Component */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-indigo-900 text-white flex justify-between items-center">
              <div>
                <div className="text-[10px] font-black bg-indigo-850 px-2 py-0.5 rounded uppercase tracking-widest inline-block mb-1">
                  Copy workspace
                </div>
                <h3 className="m-0 text-lg font-black leading-none">
                  {selectedReceipt.customer_name} • {selectedReceipt.display_doc_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="w-8 h-8 rounded-full bg-indigo-850 hover:bg-red-650 text-white flex items-center justify-center transition-all shrink-0 active:scale-90"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 tracking-wider pl-1">
                  Patient Credentials (Click fields to Copy)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CopyableField
                    label="Patient Name"
                    value={`${selectedReceipt.prefix ? selectedReceipt.prefix + ' ' : ''}${
                      selectedReceipt.customer_name
                    }`}
                  />
                  <CopyableField label="Mobile Number" value={selectedReceipt.mobile || ''} />
                  <CopyableField label="Email Address" value={selectedReceipt.email || ''} />
                  <CopyableField label="Gender" value={selectedReceipt.gender || ''} />
                  <CopyableField
                    label="Patient Age"
                    value={`${selectedReceipt.age_years || 0} Y / ${
                      selectedReceipt.age_months || 0
                    } M / ${selectedReceipt.age_days || 0} D`}
                  />
                  <CopyableField label="Date of Birth" value={selectedReceipt.dob || ''} />
                  <CopyableField label="Referred By" value={selectedReceipt.referred_by || 'Self Referral'} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 tracking-wider pl-1">
                  Ordered Packages & Tests (Click names to Copy)
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                    selectedReceipt.items.map((item, idx) => (
                      <CopyableBadge key={idx} text={item.package_name} />
                    ))
                  ) : (
                    <span className="text-slate-400 italic text-xs pl-1">No tests ordered</span>
                  )}
                </div>
              </div>

              {selectedReceipt.notes && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1 tracking-wider pl-1">
                    Special Instructions / Notes
                  </label>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 font-medium font-sans">
                    {selectedReceipt.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between gap-3">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 font-bold rounded-xl text-xs uppercase tracking-wider transition-all text-slate-650"
              >
                Close workspace
              </button>

              {selectedReceipt.data_entry_done === 0 ? (
                <button
                  onClick={() => handleMarkDone(selectedReceipt.id)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-100 shrink-0 flex items-center gap-2"
                >
                  <i className="fa-solid fa-check"></i> Mark Complete & Finalize
                </button>
              ) : (
                user?.role === 'ADMIN' && (
                  <button
                    onClick={() => handleMarkIncomplete(selectedReceipt.id)}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-red-100 shrink-0 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-triangle-exclamation"></i> Revert back to Incomplete
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataEntryPortal;
