
import React from 'react';

export const ReceiptIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-receipt ${className}`}></i>
);

export const EstimateIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-file-invoice ${className}`}></i>
);

export const ViewIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-eye ${className}`}></i>
);

export const CustomersIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-users ${className}`}></i>
);

export const LabsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-flask ${className}`}></i>
);

export const PackageListIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-list-check ${className}`}></i>
);

export const BranchesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-store ${className}`}></i>
);

export const UsersIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-user-cog ${className}`}></i>
);

export const WalletIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-wallet ${className}`}></i>
);

export const LogoutIcon: React.FC<{ className?: string }> = ({ className }) => (
    <i className={`fa-solid fa-sign-out-alt ${className}`}></i>
);
