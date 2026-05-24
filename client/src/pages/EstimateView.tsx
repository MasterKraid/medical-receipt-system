import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { Estimate, Customer, DocumentItem, Branch as BranchType } from '../types';

declare const html2canvas: any;
declare const jspdf: any;

interface EstimatePageData {
    estimate: Estimate;
    customer: Customer;
    items: DocumentItem[];
    branch: BranchType;
}

const getCategoryForPackage = (packageName: string): 'Lab Tests' | 'Radiological Tests' | 'Others' => {
    const name = packageName.toLowerCase();
    if (name.includes('x-ray') || name.includes('usg') || name.includes('ultrasound') || name.includes('mri') || name.includes('ct scan') || name.includes('scan') || name.includes('radiology') || name.includes('xray') || name.includes('ecg') || name.includes('echo')) {
        return 'Radiological Tests';
    }
    if (name.includes('blood') || name.includes('urine') || name.includes('cbc') || name.includes('thyroid') || name.includes('lipid') || name.includes('sugar') || name.includes('profile') || name.includes('test') || name.includes('check') || name.includes('serum') || name.includes('glucose')) {
        return 'Lab Tests';
    }
    return 'Others';
};

const EstimateView: React.FC = () => {
    const { id } = useParams() as { id: string };
    const { user } = useAuth();
    const [data, setData] = useState<EstimatePageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const fetchEstimateData = async () => {
            try {
                const estimateId = parseInt(id, 10);
                if (isNaN(estimateId)) {
                    setError("Invalid Estimate ID.");
                    return;
                }
                const result = await apiService.getEstimateById(estimateId);
                if (!result) {
                    setError("Estimate not found.");
                } else {
                    setData(result);
                }
            } catch (err) {
                setError("Failed to fetch estimate data.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEstimateData();
    }, [id]);

    const formattedData = useMemo(() => {
        if (!data) return null;

        const { estimate, items } = data;

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
                priceAfterItemDiscountFormatted: priceAfterItemDiscount.toFixed(2),
            };
        });

        const dateParts = estimate.created_at.split(' | ');

        return {
            ...data,
            items: formattedItems,
            displayEstimateDate: dateParts[0],
            totalMrpFormatted: calculatedTotalMrp.toFixed(2),
            subtotalAfterItemDiscountsFormatted: calculatedSubtotalAfterItemDiscounts.toFixed(2),
            finalAmountFormatted: (Number(estimate.amount_after_discount) || 0).toFixed(2),
        };
    }, [data]);

    const getDashboardLink = () => user?.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard';

    const generatePdf = async (): Promise<any> => {
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            alert('The PDF generator is still loading. Please wait a moment and try again.');
            return null;
        }

        const element = document.getElementById('print-container');
        if (!element) {
            console.error("Element to capture not found!");
            return null;
        }

        const originalWidth = element.style.width;
        const originalMaxWidth = element.style.maxWidth;

        // Force desktop layout for high-quality standard sheets
        element.style.width = '800px';
        element.style.maxWidth = '800px';

        try {
            const canvas = await html2canvas(element, { 
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false
            });

            element.style.width = originalWidth;
            element.style.maxWidth = originalMaxWidth;

            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const usableWidth = pdfWidth - margin * 2;
            const usableHeight = pdfHeight - margin * 2;

            const scaledHeight = usableWidth * (canvas.height / canvas.width);

            // Squash down slightly if it bypasses A4 page limits by a tiny margin
            let finalScale = 1;
            if (scaledHeight > usableHeight && scaledHeight < usableHeight * 1.15) {
                finalScale = usableHeight / scaledHeight;
            }

            const finalWidth = usableWidth * finalScale;
            const finalHeight = scaledHeight * finalScale;

            if (finalHeight <= usableHeight) {
                pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
            } else {
                let heightLeft = finalHeight;
                let position = 0;
                let page = 1;
                
                while (heightLeft > 0) {
                    if (page > 1) pdf.addPage();
                    pdf.addImage(imgData, 'PNG', margin, margin - position, finalWidth, finalHeight);
                    heightLeft -= usableHeight;
                    position += usableHeight;
                    page++;
                }
            }

            return pdf;
        } catch (err) {
            console.error("PDF generation failed:", err);
            element.style.width = originalWidth;
            element.style.maxWidth = originalMaxWidth;
            return null;
        }
    };

    const handleSharePdf = async () => {
        if (!data || !formattedData) return;
        const pdf = await generatePdf();
        if (!pdf) return;

        const fileName = `Estimate-EST-${String(data.estimate.id).padStart(6, '0')}.pdf`;

        try {
            const pdfBlob = pdf.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Estimate EST-${String(data.estimate.id).padStart(6, '0')}`,
                    text: `Medical Estimate for ${data.customer.prefix || ''} ${data.customer.name} (Amount: ₹${formattedData.finalAmountFormatted})`,
                });
            } else {
                alert("PDF file sharing is not supported by your browser.");
            }
        } catch (err: any) {
            if (err && err.name === 'AbortError') {
                console.log("Sharing was dismissed by the user.");
            } else {
                console.warn("Share failed", err);
                alert("An error occurred while sharing the document.");
            }
        }
    };

    const handleDownloadPdf = async () => {
        if (!data) return;
        const pdf = await generatePdf();
        if (!pdf) return;
        const fileName = `Estimate-EST-${String(data.estimate.id).padStart(6, '0')}.pdf`;
        pdf.save(fileName);
    };

    if (isLoading) return <div className="text-center p-10 font-medium text-slate-600">Loading Estimate...</div>;
    if (error) return <div className="text-center p-10 text-rose-500 font-semibold">{error}</div>;
    if (!formattedData) return <div className="text-center p-10 text-slate-500">Estimate data could not be loaded.</div>;

    const { estimate, customer, items, branch } = formattedData;

    return (
        <>
            <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
            @media print {
                body { background: white !important; }
                .no-print { display: none !important; }
                .print-container { 
                    box-shadow: none !important; 
                    margin: 0 !important; 
                    padding: 10mm !important; 
                    width: 100% !important;
                    max-width: 100% !important;
                }
            }
            .print-container {
                width: 100%;
                max-width: 800px;
                margin: 30px auto;
                padding: 24px;
                background: white;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
                border-radius: 16px;
                border: 1px solid #e2e8f0;
                font-family: 'Outfit', sans-serif;
                font-size: 10pt;
            }
            @media (min-width: 768px) {
                .print-container {
                    padding: 15mm;
                }
            }
            .badge-lab {
                background-color: #ecfeff;
                color: #0891b2;
                border: 1px solid #cffafe;
                padding: 2px 8px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-radius: 9999px;
            }
            .badge-radio {
                background-color: #fffbeb;
                color: #d97706;
                border: 1px solid #fef3c7;
                padding: 2px 8px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-radius: 9999px;
            }
            .badge-others {
                background-color: #f8fafc;
                color: #475569;
                border: 1px solid #e2e8f0;
                padding: 2px 8px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-radius: 9999px;
            }
        `}</style>
            <div id="print-container" className="print-container">
                {/* Header */}
                <header className="text-center mb-6 pb-3 border-b border-slate-100">
                    <img src="/company-logo.png" alt="Company Logo" className="mx-auto h-16 mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Dedicated To Care, Committed To Service</p>
                    <div className="text-xl font-bold uppercase tracking-wider mt-3 text-slate-800">Medical Estimate</div>
                </header>

                {/* Meta Info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 pb-3 border-b border-slate-100 text-sm text-slate-600">
                    <div>
                        <h3 className="font-bold text-base text-slate-850">{branch.name}</h3>
                        <p className="text-xs text-slate-500">Ph: {branch.phone}</p>
                        <p className="text-xs text-slate-500 whitespace-pre-line">{branch.address}</p>
                    </div>
                    <div className="text-left sm:text-right text-xs text-slate-500">
                        <p><strong>ESTIMATE DATE:</strong> {formattedData.displayEstimateDate}</p>
                        <p className="mt-1"><strong>Estimate ID:</strong> EST-{String(estimate.id).padStart(6, '0')}</p>
                    </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-6 pb-4 border-b border-slate-100 text-sm text-slate-600">
                    <div><span className="font-bold text-slate-400 text-xs block uppercase">Customer ID</span> CUST-{String(customer.id).padStart(10, '0')}</div>
                    <div><span className="font-bold text-slate-400 text-xs block uppercase">Mobile No</span> {customer.mobile || 'N/A'}</div>
                    <div><span className="font-bold text-slate-400 text-xs block uppercase">Patient Name</span> <span className="font-bold text-slate-800">{customer.prefix || ''} {customer.name}</span></div>
                    <div><span className="font-bold text-slate-400 text-xs block uppercase">Age / DOB</span> {customer.dob ? new Date(customer.dob).toLocaleDateString('en-GB') : (customer.age ? `${customer.age} yrs` : 'N/A')}</div>
                    <div><span className="font-bold text-slate-400 text-xs block uppercase">Gender</span> {customer.gender || 'N/A'}</div>
                    <div><span className="font-bold text-slate-400 text-xs block uppercase">Referred By Dr.</span> {estimate.referred_by || 'N/A'}</div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-200 text-sm mb-6">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-3 text-left w-1/2 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Test / Package</th>
                                <th className="p-3 text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">MRP (₹)</th>
                                <th className="p-3 text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Item Disc %</th>
                                <th className="p-3 text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Price (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {['Lab Tests', 'Radiological Tests', 'Others'].map(category => {
                                const categoryItems = items.filter(item => getCategoryForPackage(item.package_name) === category);
                                if (categoryItems.length === 0) return null;
                                
                                const badgeClass = category === 'Lab Tests' ? 'badge-lab' : (category === 'Radiological Tests' ? 'badge-radio' : 'badge-others');
                                
                                return (
                                    <React.Fragment key={category}>
                                        <tr className="bg-slate-50/50">
                                            <td colSpan={4} className="p-2 border-y border-slate-100 pl-4">
                                                <span className={badgeClass}>{category}</span>
                                            </td>
                                        </tr>
                                        {categoryItems.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50/20 border-b border-slate-100 last:border-0">
                                                <td className="p-3 pl-6 font-medium text-slate-700">{item.package_name}</td>
                                                <td className="p-3 text-right text-slate-500 font-mono">{item.mrpFormatted}</td>
                                                <td className="p-3 text-right text-slate-500 font-mono">{item.discountPercentageFormatted}%</td>
                                                <td className="p-3 text-right text-slate-800 font-semibold font-mono">{item.priceAfterItemDiscountFormatted}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot className="font-bold border-t border-slate-200">
                            <tr className="bg-slate-50/30">
                                <td colSpan={3} className="p-3 text-right text-slate-500">TOTAL MRP</td>
                                <td className="p-3 text-right font-mono text-slate-700">₹{formattedData.totalMrpFormatted}</td>
                            </tr>
                            <tr className="bg-slate-50/30">
                                <td colSpan={3} className="p-3 text-right text-xs font-normal text-slate-400">SUBTOTAL (After Item Discounts)</td>
                                <td className="p-3 text-right text-xs font-normal font-mono text-slate-500">₹{formattedData.subtotalAfterItemDiscountsFormatted}</td>
                            </tr>
                            <tr className="bg-emerald-50/60 border-t border-emerald-100">
                                <td colSpan={3} className="p-4 text-right text-emerald-800 text-base font-bold">ESTIMATED PAYABLE</td>
                                <td className="p-4 text-right text-emerald-900 text-lg font-extrabold font-mono">₹{formattedData.finalAmountFormatted}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Footer */}
                <footer className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-6 pt-4 border-t border-slate-100 text-xs gap-4 text-slate-500">
                    <div className="w-full sm:w-3/5">
                        <strong>Notes:</strong> {estimate.notes || 'This is a medical services cost estimate only. Subject to change.'}
                    </div>
                    <div className="pt-4 border-t border-dotted border-slate-300 min-w-[150px] text-center uppercase tracking-wider font-bold text-slate-400">SIGNATURE / STAMP</div>
                </footer>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons text-center my-6 no-print flex flex-wrap justify-center gap-3 px-4">
                <button onClick={() => window.print()} className="px-5 py-3 cursor-pointer text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider">
                    <i className="fa-solid fa-print"></i> Print
                </button>
                
                <button 
                    onClick={handleSharePdf}
                    className="px-5 py-3 cursor-pointer text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider"
                >
                    <i className="fa-solid fa-share-nodes"></i> Share Estimate
                </button>

                <button 
                    onClick={handleDownloadPdf}
                    className="px-5 py-3 cursor-pointer text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider"
                >
                    <i className="fa-solid fa-download"></i> Download PDF
                </button>

                <Link to="/estimate-form" className="px-5 py-3 cursor-pointer text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-all flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider">
                    <i className="fa-solid fa-plus"></i> New Form
                </Link>
                <Link to={getDashboardLink()} className="px-5 py-3 cursor-pointer text-white bg-slate-900 rounded-xl hover:bg-black transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-wider shadow-md">
                    <i className="fa-solid fa-house"></i> Dashboard
                </Link>
            </div>
        </>
    );
};

export default EstimateView;