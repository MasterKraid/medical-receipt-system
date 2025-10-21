// This file is used to declare global variables from CDN scripts to TypeScript.

declare var html2canvas: any;
declare var jspdf: {
    jsPDF: new (options?: any) => any;
};
declare var ExcelJS: any;

// Fix: Added module declaration to work around missing type definitions for react-router-dom
declare module 'react-router-dom';