import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { Document } from '../../types';

interface ViewDocumentsProps {
    docType: 'receipt' | 'estimate';
}

const ViewDocuments: React.FC<ViewDocumentsProps> = ({ docType }) => {
    const title = docType === 'receipt' ? 'Receipt Ledger' : 'Estimate Ledger';
    const legendText = docType === 'receipt' ? 'All Generated Receipts' : 'All Generated Estimates';
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setIsLoading(true);
        const fetcher = docType === 'receipt' ? apiService.getReceipts : apiService.getEstimates;
        fetcher()
            .then(data => {
                setDocuments(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(`Failed to fetch ${docType}s`, err);
                setIsLoading(false);
            });
    }, [docType]);

    const filteredDocuments = React.useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return documents;
        return documents.filter(doc =>
            doc.display_doc_id.toLowerCase().includes(query) ||
            doc.customer_name.toLowerCase().includes(query) ||
            doc.display_customer_id.toLowerCase().includes(query) ||
            doc.created_by_user.toLowerCase().includes(query)
        );
    }, [documents, searchTerm]);

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                <PageHeader title={title} />

                <div className="relative flex flex-col">
                    <div className="md:absolute static top-0 right-6 md:-translate-y-[5px] mb-4 md:mb-0 flex justify-end order-1 md:order-none">
                        <div className="search-container w-full md:w-80 bg-white shadow-sm md:shadow-none">
                            <i className="fa-solid fa-magnifying-glass text-gray-700 text-xs mr-2"></i>
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder={`Search ${docType}s...`}
                                className="search-input"
                            />
                        </div>
                    </div>

                    <fieldset className="border-2 border-gray-300 p-4 md:p-6 rounded-xl order-2 min-w-0">
                        <legend className="px-3 flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-white shadow-sm">
                                <i className={`fa-solid ${docType === 'receipt' ? 'fa-file-invoice-dollar' : 'fa-file-invoice'} text-xs`} ></i>
                            </div>
                            <span className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight md:tracking-normal">{legendText}</span>
                        </legend>

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full min-w-[800px] bg-white divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Document Details</th>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Customer Info</th>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Financials</th>
                                        <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Origin</th>
                                        <th className="py-3 px-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="text-center py-12 text-gray-400 italic text-sm">Synchronizing ledger records...</td></tr>
                                    ) : filteredDocuments.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-12 text-gray-400 italic text-sm">No {docType}s matching your search found.</td></tr>
                                    ) : (
                                        filteredDocuments.map(doc => (
                                            <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="py-3 px-4">
                                                    <div className="text-sm font-bold text-gray-800">{doc.display_doc_id}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono italic">{doc.display_date}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-sm font-semibold text-gray-700">{doc.customer_name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono italic">{doc.display_customer_id}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-50 text-green-700 border border-green-100">
                                                        {doc.display_amount}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                        <i className="fa-solid fa-user-pen text-[10px] text-gray-300"></i>
                                                        {doc.created_by_user}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <Link to={`/${docType}/${doc.id}`} className="w-8 h-8 inline-flex items-center justify-center bg-gray-50 text-gray-500 hover:bg-blue-600 hover:text-white rounded border border-gray-100 transition-all shadow-sm" title="View Document">
                                                        <i className="fa-solid fa-eye text-xs"></i>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </fieldset>
                </div>
            </div>
        </div>
    );
};

export default ViewDocuments;
