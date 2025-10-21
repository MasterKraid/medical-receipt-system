
// This file can be a copy of the frontend's types.ts to ensure consistency.
// In a larger project, this could be a shared package.
export interface User {
    id: number;
    username: string;
    alias?: string;
    branchId: number;
    role: 'ADMIN' | 'GENERAL_EMPLOYEE' | 'CLIENT';
    wallet_balance: number;
    allow_negative_balance: boolean;
    negative_balance_allowed_until?: string;
    assigned_list_ids?: number[];
}

export interface Branch {
    id: number;
    name: string;
    address: string;
    phone: string;
}

export interface PackageList {
    id: number;
    name: string;
    package_count?: number;
}

export interface Package {
    id: number;
    name: string;
    mrp: number;
    b2b_price: number;
    package_list_id: number;
}

export interface Lab {
    id: number;
    name: string;
    logo_path?: string;
    assigned_list_ids?: number[];
}

export interface Customer {
    id: number;
    prefix?: string;
    name: string;
    mobile?: string;
    dob?: string;
    age?: number;
    gender?: 'Male' | 'Female';
    created_at: string;
    updated_at: string;
    created_by_user_id: number;
}

export interface TransactionItem {
    name: string;
    mrp: number;
    b2b_price: number;
}

export interface Transaction {
    id: number;
    user_id: number;
    date: string;
    type: 'RECEIPT_DEDUCTION' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT' | 'SETTLEMENT';
    amount_deducted: number;
    notes?: string;
    receipt_id?: number;
    items?: TransactionItem[];
    customer_name?: string;
    total_profit?: number;
}

export interface Receipt {
    id: number;
    customer_id: number;
    branch_id: number;
    created_at: string;
    total_mrp: number;
    amount_final: number;
    amount_received: number;
    amount_due: number;
    payment_method: string;
    referred_by?: string;
    notes?: string;
    num_tests: number;
    logo_path?: string;
    created_by_user_id: number;
}

export interface Estimate {
    id: number;
    customer_id: number;
    branch_id: number;
    created_at: string;
    amount_after_discount: number;
    referred_by?: string;
    notes?: string;
    created_by_user_id: number;
}

export interface DocumentItem {
    id: number;
    package_name: string;
    mrp: number;
    discount_percentage: number;
}

export interface FormattedCustomer extends Customer {
    display_id: string;
    dob_formatted: string;
    display_age: string;
    display_created_at: string;
}

export interface Document {
    id: number;
    display_doc_id: string;
    display_date: string;
    customer_name: string;
    display_customer_id: string;
    display_amount: string;
    created_by_user: string;
}
