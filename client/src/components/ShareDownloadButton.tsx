import React from 'react';

interface ShareDownloadButtonProps {
    elementIdToCapture: string;
    fileName: string;
}

const ShareDownloadButton: React.FC<ShareDownloadButtonProps> = ({ elementIdToCapture, fileName }) => {
    
    const handleShareOrDownload = async () => {
        if (typeof html2canvas === 'undefined') {
            alert('The document generator is still loading. Please wait a moment and try again.');
            return;
        }

        const element = document.getElementById(elementIdToCapture);
        if (!element) {
            console.error("Element to capture not found!");
            return;
        }

        const canvas = await html2canvas(element, { scale: 2 });

        // --- Mobile Share Logic ---
        // Fixed: navigator.canShare is a function that needs to be called
        if (navigator.share && navigator.canShare()) {
            // Fixed: Added type 'Blob | null' to the blob parameter
            canvas.toBlob(async (blob: Blob | null) => {
                if (blob) {
                    const file = new File([blob], fileName.replace('.pdf', '.png'), { type: 'image/png' });
                    try {
                        await navigator.share({
                            files: [file],
                            title: fileName,
                        });
                    } catch (error) {
                        console.error('Error sharing:', error);
                        downloadPdf(canvas);
                    }
                }
            }, 'image/png');
        } else {
            // --- Desktop Download Logic ---
            downloadPdf(canvas);
        }
    };

    const downloadPdf = (canvas: HTMLCanvasElement) => {
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            alert('The PDF generator is still loading. Please wait a moment and try again.');
            return;
        }

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const imgProps= pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const margin = 10;
        const usableWidth = pdfWidth - margin * 2;
        
        const imgWidth = imgProps.width;
        const imgHeight = imgProps.height;
        
        const ratio = imgWidth / imgHeight;
        
        const scaledWidth = usableWidth;
        const scaledHeight = scaledWidth / ratio;
        
        const usablePageHeight = pdfHeight - margin * 2;
        
        let heightLeft = scaledHeight;
        let position = -margin; // Start position for image slices

        pdf.addImage(imgData, 'PNG', margin, margin, scaledWidth, scaledHeight);
        heightLeft -= usablePageHeight;
        
        while (heightLeft > 0) {
            position -= usablePageHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position, scaledWidth, scaledHeight);
            heightLeft -= usablePageHeight;
        }

        pdf.save(fileName);
    };

    return (
        <button 
            onClick={handleShareOrDownload}
            className="px-5 py-2 cursor-pointer text-white bg-green-600 rounded-md mx-2 hover:bg-green-700"
        >
            Share / Download
        </button>
    );
};

export default ShareDownloadButton;