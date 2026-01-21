const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ApiError {
  error: string;
  details?: unknown;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: unknown;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('admin_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      const apiError = json as ApiError;
      return { error: apiError.error || 'An error occurred', details: apiError.details };
    }

    return { data: json as T };
  } catch {
    return { error: 'Network error. Please check your connection.' };
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export interface StaffUser {
  id: string;
  username: string;
  role: 'admin' | 'staff' | 'groomer';
  first_name: string;
  last_name: string;
}

export interface StaffAuthResponse {
  token: string;
  staff: StaffUser;
}

export const adminAuthApi = {
  login: (data: { username: string; password: string }) =>
    api.post<StaffAuthResponse>('/admin/auth/login', data),
};

// Customer types
export interface CustomerSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  phone: string;
  email: string;
  points_balance: number;
}

export interface CustomerSearchResponse {
  customers: CustomerSearchResult[];
  count: number;
}

// Points types
export interface AddPointsRequest {
  customer_id: string;
  dollar_amount: number;
  service_type: 'daycare' | 'boarding' | 'grooming';
}

export interface AddPointsResponse {
  success: boolean;
  transaction: {
    id: string;
    type: string;
    points_earned: number;
    dollar_amount: number;
    service_type: string;
    description: string;
    created_at: string;
  };
  customer: {
    id: string;
    name: string;
    previous_balance: number;
    new_balance: number;
  };
}

export const adminCustomersApi = {
  search: (query: string) =>
    api.get<CustomerSearchResponse>(`/admin/customers/search?q=${encodeURIComponent(query)}`),
};

export const adminPointsApi = {
  add: (data: AddPointsRequest) =>
    api.post<AddPointsResponse>('/admin/points/add', data),
};

// Redemption types
export interface RedemptionLookupResponse {
  id: string;
  redemption_code: string;
  reward_tier: number;
  discount_value: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  approved_at: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string;
    points_balance: number;
  };
}

export interface CompleteRedemptionResponse {
  success: boolean;
  message: string;
  redemption: {
    id: string;
    redemption_code: string;
    reward_tier: number;
    discount_value: number;
    status: string;
    approved_at: string;
  };
  customer: {
    id: string;
    name: string;
    previous_balance: number;
    new_balance: number;
  };
  discount_to_apply: number;
}

// Staff-initiated direct redemption types
export interface CreateRedemptionRequest {
  customer_id: string;
  reward_tier: '100' | '250' | '500';
}

export interface CreateRedemptionResponse {
  success: boolean;
  message: string;
  redemption: {
    id: string;
    redemption_code: string;
    reward_tier: number;
    discount_value: number;
    status: string;
    approved_at: string;
  };
  customer: {
    id: string;
    name: string;
    previous_balance: number;
    new_balance: number;
  };
  discount_to_apply: number;
}

export const adminRedemptionsApi = {
  lookup: (code: string) =>
    api.get<RedemptionLookupResponse>(`/admin/redemptions/lookup?code=${encodeURIComponent(code)}`),
  complete: (redemption_code: string) =>
    api.post<CompleteRedemptionResponse>('/admin/redemptions/complete', { redemption_code }),
  create: (data: CreateRedemptionRequest) =>
    api.post<CreateRedemptionResponse>('/admin/redemptions/create', data),
};

// Customer list types
export interface CustomerListItem {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  phone: string;
  email: string;
  points_balance: number;
  join_date: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_more: boolean;
}

export interface CustomerListResponse {
  customers: CustomerListItem[];
  pagination: PaginationInfo;
}

export interface CustomerListParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
}

// Customer detail types
export interface CustomerReferralInfo {
  id: string;
  name: string;
}

export interface CustomerReferral {
  id: string;
  name: string;
  join_date: string;
}

export interface CustomerDetail {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  phone: string;
  email: string;
  points_balance: number;
  referral_code: string;
  join_date: string;
  referred_by: CustomerReferralInfo | null;
  referrals: CustomerReferral[];
}

// Customer transaction types for admin
export interface CustomerTransaction {
  id: string;
  type: string;
  points_amount: number;
  description: string;
  dollar_amount: number | null;
  service_type: string | null;
  date: string;
}

export interface CustomerTransactionsResponse {
  transactions: CustomerTransaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// Customer redemption types for admin
export interface CustomerRedemption {
  id: string;
  redemption_code: string;
  reward_tier: number;
  discount_value: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  approved_at: string | null;
}

export interface CustomerRedemptionsResponse {
  pending: CustomerRedemption[];
  completed: CustomerRedemption[];
}

export const adminCustomersListApi = {
  list: (params: CustomerListParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params.search) searchParams.set('search', params.search);
    const queryString = searchParams.toString();
    return api.get<CustomerListResponse>(`/admin/customers${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => api.get<CustomerDetail>(`/admin/customers/${id}`),
  getTransactions: (id: string, params: { limit?: number; offset?: number } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    const queryString = searchParams.toString();
    return api.get<CustomerTransactionsResponse>(
      `/admin/customers/${id}/transactions${queryString ? `?${queryString}` : ''}`
    );
  },
  getRedemptions: (id: string) =>
    api.get<CustomerRedemptionsResponse>(`/admin/customers/${id}/redemptions`),
};

// Gingr sync types
export interface GingrStatusResponse {
  connected: boolean;
  auth_format?: string;
  error?: string;
  subdomain: string;
}

export interface GingrUnmatchedCustomer {
  owner_name: string;
  invoice_id: string;
  total: number;
}

export interface GingrSyncResponse {
  success: boolean;
  import_id?: string;
  invoices_processed: number;
  customers_matched: number;
  customers_not_found: number;
  total_points_applied: number;
  unmatched_customers: GingrUnmatchedCustomer[];
  error?: string;
}

export interface GingrHistoryItem {
  id: string;
  synced_at: string;
  invoices_processed: number;
  customers_matched: number;
  customers_not_found: number;
  total_points_applied: number;
  synced_by: string;
}

export interface GingrHistoryResponse {
  history: GingrHistoryItem[];
}

export const adminGingrApi = {
  status: () => api.get<GingrStatusResponse>('/admin/gingr/status'),
  sync: () => api.post<GingrSyncResponse>('/admin/gingr/sync', {}),
  history: () => api.get<GingrHistoryResponse>('/admin/gingr/history'),
};
