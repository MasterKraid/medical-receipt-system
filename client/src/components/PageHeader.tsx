
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PageHeader: React.FC<{ title: string, showBackLink?: boolean, backLink?: string, backText?: string }> = ({ title, showBackLink = true, backLink, backText }) => {
    const { user, branch } = useAuth();

    const getDashboardLink = () => {
        if (!user) return "/";
        return user.role === 'ADMIN' ? '/admin-dashboard' : '/dashboard';
    };

    return (
        <header className="border-b border-gray-200 pb-5 mb-6 flex justify-between items-center">
            <h1 className="m-0 text-left text-2xl font-bold text-gray-800">{title}</h1>
            {showBackLink && (
                <Link to={backLink || getDashboardLink()} className="inline-block px-4 py-2 bg-gray-500 text-white no-underline rounded-md text-sm font-medium transition-colors hover:bg-gray-600">
                    <i className="fa-solid fa-arrow-left mr-2"></i>
                    {backText || "Back to Dashboard"}
                </Link>
            )}
        </header>
    );
};

export default PageHeader;
