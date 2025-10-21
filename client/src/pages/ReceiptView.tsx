import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { Receipt, Customer, DocumentItem, Branch as BranchType } from '../types';
import ShareDownloadButton from '../components/ShareDownloadButton';

interface ReceiptPageData {
    receipt: Receipt;
    customer: Customer;
    items: DocumentItem[];
    branch: BranchType;
}

const ReceiptView: React.FC = () => {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const [data, setData] = useState<ReceiptPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!id) return;
    const fetchReceiptData = async () => {
        try {
            const receiptId = parseInt(id, 10);
            if (isNaN(receiptId)) {
                setError("Invalid Receipt ID.");
                return;
            }
            const result = await apiService.getReceiptById(receiptId);
            if (!result) {
                setError("Receipt not found.");
            } else {
                setData(result);
            }
        } catch (err) {
            setError("Failed to fetch receipt data.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    fetchReceiptData();
  }, [id]);

  const formattedData = useMemo(() => {
    if (!data) return null;

    const { receipt, items } = data;
    
    let calculatedTotalMrp = 0;
    let calculatedSubtotalAfterItemDiscounts = 0;

    const formattedItems = items.map(item => {
        const itemMrp = Number(item.mrp) || 0;
        const itemDiscPerc = Number(item.discount_percentage) || 0;
        const priceAfterItemDiscount = itemMrp * (1 - itemDiscPerc / 100);
        
        calculatedTotalMrp += itemMrp;
        calculatedSubtotalAfterItemDiscounts += priceAfterItemDiscount;

        return {
            ...item,
            mrpFormatted: itemMrp.toFixed(2),
            discountPercentageFormatted: itemDiscPerc.toFixed(1),
        };
    });
    
    const dateParts = receipt.created_at.split(' | ');

    return {
        ...data,
        items: formattedItems,
        displayReceiptDate: `${dateParts[0]} ${dateParts[1]}`,
        totalMrpFormatted: (receipt.total_mrp || calculatedTotalMrp).toFixed(2),
        subtotalAfterItemDiscountsFormatted: calculatedSubtotalAfterItemDiscounts.toFixed(2),
        finalAmountFormatted: (Number(receipt.amount_final) || 0).toFixed(2),
        amountReceivedFormatted: (Number(receipt.amount_received) || 0).toFixed(2),
        amountDueFormatted: (Number(receipt.amount_due) || 0).toFixed(2),
    };
  }, [data]);

  const getDashboardLink = () => user?.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard';

  if (isLoading) return <div className="text-center p-10">Loading Receipt...</div>;
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;
  if (!formattedData) return <div className="text-center p-10">Receipt data could not be loaded.</div>;
  
  const { receipt, customer, items, branch } = formattedData;

  return (
    <>
        <style>{`
            @media print {
                body { background: white !important; }
                .no-print { display: none !important; }
                .print-container { box-shadow: none !important; margin: 0 !important; padding: 10mm !important; }
            }
            .print-container {
                width: 210mm;
                margin: 20px auto;
                padding: 15mm;
                background: white;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 10pt;
            }
        `}</style>
        <div id="print-container" className="print-container">
            {/* Header */}
            <header className="text-center mb-4 pb-2 border-b">
                <img src="/company-logo.png" alt="Company Logo" className="mx-auto h-16 mb-2" />
                <p className="text-xs text-gray-600">Dedicated To Care, Committed To Service</p>
                <div className="text-2xl font-bold text-gray-800">TREAT & CURE</div>
                <div className="text-xl font-bold uppercase tracking-wider mt-2">Money Receipt</div>
            </header>
            
            {/* Meta Info */}
            <div className="flex justify-between items-start mb-4 pb-2 border-b text-sm">
                <div>
                    <h3 className="font-bold text-base">{branch.name}</h3>
                    <p>Ph: {branch.phone}</p>
                    <p className="whitespace-pre-line">{branch.address}</p>
                </div>
                <div className="text-right">
                    <p><strong>DATE & TIME:</strong> {formattedData.displayReceiptDate}</p>
                    <p><strong>Receipt ID:</strong> RCPT-{String(receipt.id).padStart(6, '0')}</p>
                </div>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 pb-2 border-b text-sm">
                <div><strong>CUSTOMER ID:</strong> CUST-{String(customer.id).padStart(10, '0')}</div>
                <div><strong>MOBILE NO:</strong> {customer.mobile || 'N/A'}</div>
                <div><strong>NAME:</strong> {customer.prefix || ''} {customer.name}</div>
                <div><strong>AGE/DOB:</strong> {customer.dob ? new Date(customer.dob).toLocaleDateString('en-GB') : (customer.age ? `${customer.age} yrs` : 'N/A')}</div>
                <div><strong>GENDER:</strong> {customer.gender || 'N/A'}</div>
                <div><strong>REFERRED BY DR.:</strong> {receipt.referred_by || 'N/A'}</div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border border-gray-300 mb-0 text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="border p-2 text-left w-3/5">TEST / PACKAGE NAME</th>
                        <th className="border p-2 text-right">ITEM DISC %</th>
                        <th className="border p-2 text-right">MRP (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={i}>
                            <td className="border p-2">{item.package_name}</td>
                            <td className="border p-2 text-right">{item.discountPercentageFormatted}%</td>
                            <td className="border p-2 text-right">{item.mrpFormatted}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals Table */}
            <table className="w-full border-collapse border border-gray-300 -mt-px text-sm">
                <tbody>
                    <tr>
                        <td className="border p-2 w-2/5 align-top">
                            NO OF TESTS: {receipt.num_tests || items.length}<br/>
                            Payment: {receipt.payment_method || 'N/A'}
                        </td>
                        <td className="border p-2 w-1/5 text-center align-middle">
                             {receipt.logo_path && <img src={receipt.logo_path} alt="Lab Logo" className="max-h-16 max-w-24 inline-block" />}
                        </td>
                        <td className="border p-2 bg-gray-50 align-top text-right">
                            TOTAL MRP<br/>
                            SUBTOTAL<br/>
                            <strong className="text-base">NET PAYABLE</strong><br/>
                            RECEIVED<br/>
                            <strong className="text-base">DUE</strong>
                        </td>
                        <td className="border p-2 bg-gray-50 align-top text-right font-mono">
                            ₹{formattedData.totalMrpFormatted}<br/>
                            ₹{formattedData.subtotalAfterItemDiscountsFormatted}<br/>
                            <strong className="text-base">₹{formattedData.finalAmountFormatted}</strong><br/>
                            ₹{formattedData.amountReceivedFormatted}<br/>
                            <strong className="text-base">₹{formattedData.amountDueFormatted}</strong>
                        </td>
                    </tr>
                </tbody>
            </table>
            
            {/* Footer */}
            <footer className="flex justify-between items-end mt-8 pt-2 border-t text-xs">
                 <div className="w-3/5">
                    <strong>Notes:</strong> {receipt.notes || 'This is the Finalized Receipt. Keep it for your records.'}
                </div>
                <div className="pt-6 border-t border-dotted border-gray-600 min-w-[150px] text-center">SIGNATURE / STAMP</div>
            </footer>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons text-center my-5 no-print">
            <button onClick={() => window.print()} className="px-5 py-2 cursor-pointer text-white bg-blue-600 rounded-md mx-2 hover:bg-blue-700">Print</button>
            <ShareDownloadButton elementIdToCapture="print-container" fileName={`Receipt-RCPT-${String(receipt.id).padStart(6, '0')}.pdf`} />
            <Link to="/receipt-form" className="px-5 py-2 cursor-pointer text-white bg-gray-600 rounded-md mx-2 hover:bg-gray-700">New Receipt Form</Link>
            <Link to={getDashboardLink()} className="px-5 py-2 cursor-pointer text-white bg-gray-600 rounded-md mx-2 hover:bg-gray-700">Dashboard</Link>
        </div>
    </>
  );
};

export default ReceiptView;