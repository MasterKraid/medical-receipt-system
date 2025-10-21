import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiService } from '../../services/api';
import { Document } from '../../types';

interface ViewDocumentsProps {
  docType: 'receipt' | 'estimate';
}

const ViewDocuments: React.FC<ViewDocumentsProps> = ({ docType }) => {
  const title = docType === 'receipt' ? 'All Receipts' : 'All Estimates';
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

  const filteredDocuments = documents.filter(doc => 
    doc.display_doc_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.display_customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.created_by_user.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <PageHeader title={title} />
            
            <div className="mb-4">
                <input 
                    type="search"
                    placeholder="Search by Doc ID, Customer Name/ID, User..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 border rounded"
                />
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-2 px-4 border-b text-left">ID</th>
                            <th className="py-2 px-4 border-b text-left">Date & Time</th>
                            <th className="py-2 px-4 border-b text-left">Customer Name</th>
                            <th className="py-2 px-4 border-b text-left">Amount</th>
                            <th className="py-2 px-4 border-b text-left">Created By</th>
                            <th className="py-2 px-4 border-b text-left">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={6} className="text-center py-4">Loading documents...</td></tr>
                        ) : filteredDocuments.length > 0 ? (
                            filteredDocuments.map(doc => (
                                <tr key={doc.id}>
                                    <td className="py-2 px-4 border-b">{doc.display_doc_id}</td>
                                    <td className="py-2 px-4 border-b">{doc.display_date}</td>
                                    <td className="py-2 px-4 border-b">{doc.customer_name} ({doc.display_customer_id})</td>
                                    <td className="py-2 px-4 border-b">{doc.display_amount}</td>
                                    <td className="py-2 px-4 border-b">{doc.created_by_user}</td>
                                    <td className="py-2 px-4 border-b">
                                        <Link to={`/${docType}/${doc.id}`} className="text-blue-600 hover:underline">View</Link>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={6} className="text-center py-4">No {docType}s found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default ViewDocuments;
