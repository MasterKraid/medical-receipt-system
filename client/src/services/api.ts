import { User, Branch, PackageList, Package, Lab, Customer, Receipt, Estimate, Document, FormattedCustomer, Transaction } from '../types';

// Helper for all API calls to the backend
async function apiFetch(url: string, options: RequestInit = {}) {
  // Default headers, can be overridden
  options.headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`/api${url}`, options); // Prepends /api to use the Vite proxy

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      // Try to parse a JSON error message from the backend
      const errorBody = await response.json();
      errorMessage = errorBody.message || errorMessage;
    } catch (e) {
      // Response was not JSON or failed to parse
    }
    throw new Error(errorMessage);
  }

  // Handle responses that have no body (e.g., 204 No Content for DELETE/PUT)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const apiService = {
  // --- Auth ---
  login: (username: string, password: string): Promise<{ user: User; branch: Branch }> => {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  getCurrentUser: (): Promise<{ user: User; branch: Branch }> => {
    return apiFetch('/auth/me');
  },

  // --- Document Creation ---
  createReceipt: (payload: any, user: User, branch: Branch): Promise<{ newReceipt: Receipt; updatedUser: User | null }> => {
    return apiFetch('/receipts', {
      method: 'POST',
      body: JSON.stringify({ payload, context: { user, branch } }),
    });
  },

  createEstimate: (payload: any, user: User, branch: Branch): Promise<Estimate> => {
    return apiFetch('/estimates', {
      method: 'POST',
      body: JSON.stringify({ payload, context: { user, branch } }),
    });
  },

  // --- Data Viewing ---
  getReceiptById: (id: number): Promise<{ receipt: Receipt; customer: Customer; items: any[]; branch: Branch }> => apiFetch(`/receipts/${id}`),
  getEstimateById: (id: number): Promise<{ estimate: Estimate; customer: Customer; items: any[]; branch: Branch }> => apiFetch(`/estimates/${id}`),
  searchCustomers: (query: string): Promise<Customer[]> => apiFetch(`/customers/search?q=${encodeURIComponent(query)}`),
  getPackageListsForLab: (labId: number): Promise<PackageList[]> => apiFetch(`/package-lists/for-lab/${labId}`),
  getPackagesForList: (listId: number): Promise<Package[]> => apiFetch(`/packages/for-list/${listId}`),
  getTransactionsForUser: (): Promise<Transaction[]> => apiFetch('/transactions'),


  // --- Admin: Data Fetching ---
  getUsers: (): Promise<User[]> => apiFetch('/users'),
  getUserById: (id: number): Promise<User> => apiFetch(`/users/${id}`),
  getBranches: (): Promise<Branch[]> => apiFetch('/branches'),
  getLabs: (): Promise<Lab[]> => apiFetch('/labs'),
  getPackageLists: (): Promise<PackageList[]> => apiFetch('/package-lists'),
  getClientWallets: (query?: string): Promise<User[]> => apiFetch(`/client-wallets?q=${encodeURIComponent(query || '')}`),
  getAllCustomers: (): Promise<FormattedCustomer[]> => apiFetch('/customers'),
  getCustomerById: (id: number): Promise<Customer> => apiFetch(`/customers/${id}`),
  getReceipts: (): Promise<Document[]> => apiFetch('/admin/receipts'),
  getEstimates: (): Promise<Document[]> => apiFetch('/admin/estimates'),

  // --- Admin: User Management ---
  createUser: (userData: any): Promise<User> => apiFetch('/users', { method: 'POST', body: JSON.stringify(userData) }),
  updateUser: (userData: any): Promise<void> => apiFetch(`/users/${userData.id}`, { method: 'PUT', body: JSON.stringify(userData) }),
  deleteUser: (userId: number): Promise<void> => apiFetch(`/users/${userId}`, { method: 'DELETE' }),

  // --- Admin: Branch Management ---
  createBranch: (branchData: Omit<Branch, 'id'>): Promise<Branch> => apiFetch('/branches', { method: 'POST', body: JSON.stringify(branchData) }),
  updateBranch: (branchData: Branch): Promise<void> => apiFetch(`/branches/${branchData.id}`, { method: 'PUT', body: JSON.stringify(branchData) }),
  deleteBranch: (branchId: number): Promise<void> => apiFetch(`/branches/${branchId}`, { method: 'DELETE' }),

  // --- Admin: Lab Management ---
  createLab: (name: string): Promise<Lab> => apiFetch('/labs', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteLab: (labId: number): Promise<void> => apiFetch(`/labs/${labId}`, { method: 'DELETE' }),
  updateLabLists: (labId: number, listIds: number[]): Promise<void> => apiFetch(`/labs/${labId}/lists`, { method: 'PUT', body: JSON.stringify({ listIds }) }),
  updateLabLogo: (labId: number, logoBase64: string): Promise<{ logoPath: string }> => apiFetch(`/labs/${labId}/logo`, { method: 'PUT', body: JSON.stringify({ logoBase64 }) }),

  // --- Admin: Package & List Management ---
  createPackageList: (name: string): Promise<PackageList> => apiFetch('/package-lists', { method: 'POST', body: JSON.stringify({ name }) }),
  deletePackageList: (listId: number): Promise<void> => apiFetch(`/package-lists/${listId}`, { method: 'DELETE' }),
  uploadPackages: (listId: number, packages: any[]): Promise<{ inserted: number; updated: number }> => apiFetch(`/package-lists/${listId}/upload`, { method: 'POST', body: JSON.stringify({ packages }) }),
  addPackageToList: (pkgData: Omit<Package, 'id'>): Promise<Package> => apiFetch('/packages', { method: 'POST', body: JSON.stringify(pkgData) }),
  updatePackageInList: (pkgData: Package): Promise<void> => apiFetch(`/packages/${pkgData.id}`, { method: 'PUT', body: JSON.stringify(pkgData) }),

  // --- Admin: Wallet Management ---
  updateWallet: (clientId: number, action: 'add' | 'deduct' | 'settle', amount?: number, notes?: string): Promise<void> => apiFetch('/wallets/update', { method: 'PUT', body: JSON.stringify({ clientId, action, amount, notes }) }),
  updateWalletPermissions: (clientId: number, allow: boolean, until?: string): Promise<void> => apiFetch('/wallets/permissions', { method: 'PUT', body: JSON.stringify({ clientId, allow, until }) }),

  // --- Admin: Customer Management ---
  updateCustomer: (customerData: Customer): Promise<void> => apiFetch(`/customers/${customerData.id}`, { method: 'PUT', body: JSON.stringify(customerData) }),
};