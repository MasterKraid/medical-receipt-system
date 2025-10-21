import React from 'react';
import { Link } from 'react-router-dom';

interface DashboardLinkProps {
    to: string;
    // Fix: The 'icon' prop's type was too generic, causing a TypeScript error on line 17.
    // Specifying that the element accepts a 'className' prop provides the correct type information for React.cloneElement.
    icon: React.ReactElement<{ className?: string }>;
    text: string;
}

const DashboardLink: React.FC<DashboardLinkProps> = ({ to, icon, text }) => {
    return (
        <Link 
            to={to} 
            className="flex items-center gap-3 p-4 bg-gray-50 text-gray-700 no-underline rounded-lg transition-all duration-200 ease-in-out border border-gray-200 font-medium text-sm hover:translate-y-[-2px] hover:shadow-lg hover:border-blue-500 hover:bg-white hover:text-blue-600"
        >
            {React.cloneElement(icon, { className: 'text-lg w-6 text-center text-blue-500' })}
            {text}
        </Link>
    );
};

export default DashboardLink;