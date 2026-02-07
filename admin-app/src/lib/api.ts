const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

interface ApiError {
  error: string;
  details?: unknown;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: unknown;
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isRetryable(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof TypeError) return true; // network failure
  return false;
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

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}${endpoint}`,
        { ...options, headers },
        REQUEST_TIMEOUT_MS,
      );

      const json = await response.json();

      if (!response.ok) {
        const apiError = json as ApiError;
        return { error: apiError.error || 'An error occurred', details: apiError.details };
      }

      return { data: json as T };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError') {
    return { error: 'Request timed out. The server may be starting up — please try again.' };
  }
  return { error: 'Network error. Please check your connection and try again.' };
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
  role: 'owner' | 'admin' | 'manager' | 'staff' | 'groomer';
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

// Gingr import customers types
export interface GingrImportedCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  points_balance: number;
  invoice_count: number;
}

export interface GingrSkippedCustomer {
  email: string | null;
  phone: string | null;
  reason: string;
}

export interface GingrImportResponse {
  success: boolean;
  customers_imported: number;
  customers_skipped: number;
  total_points_applied: number;
  imported_customers: GingrImportedCustomer[];
  skipped_customers: GingrSkippedCustomer[];
  error?: string;
}

// Unclaimed customers types
export interface GingrUnclaimedCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  points_balance: number;
  source: string;
  created_at: string;
}

export interface GingrUnclaimedCustomersResponse {
  customers: GingrUnclaimedCustomer[];
}

export const adminGingrApi = {
  status: () => api.get<GingrStatusResponse>('/admin/gingr/status'),
  sync: () => api.post<GingrSyncResponse>('/admin/gingr/sync', {}),
  history: () => api.get<GingrHistoryResponse>('/admin/gingr/history'),
  importCustomers: (daysBack?: number) =>
    api.post<GingrImportResponse>('/admin/gingr/import-customers', { days_back: daysBack }),
  unclaimedCustomers: () =>
    api.get<GingrUnclaimedCustomersResponse>('/admin/gingr/unclaimed-customers'),
};

// Demo reset types
export interface DemoStatusResponse {
  gingr_imported: {
    total: number;
    claimed: number;
    unclaimed: number;
  };
}

export interface DemoResetResponse {
  success: boolean;
  message: string;
  accounts_reset: number;
  verification_codes_cleared: number;
}

export const adminDemoApi = {
  status: () => api.get<DemoStatusResponse>('/admin/demo/status'),
  reset: () => api.post<DemoResetResponse>('/admin/demo/reset', {}),
};

// === V2 Admin Booking Types ===
export interface ServiceType {
  id: string;
  name: string;
  displayName: string;
  basePriceCents: number;
  durationMinutes: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface BookingDog {
  id: string;
  bookingId: string;
  dogId: string;
  conditionRating: number | null;
  conditionPhoto: string | null;
  quotedPriceCents: number | null;
  notes: string | null;
  dog: {
    id: string;
    name: string;
    breed: string | null;
    sizeCategory: string | null;
  };
}

export interface AdminBooking {
  id: string;
  customerId: string;
  serviceTypeId: string;
  date: string;
  endDate?: string;
  startTime: string | null;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  totalCents: number;
  notes: string | null;
  createdAt: string;
  serviceType: ServiceType;
  dogs: BookingDog[];
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface ScheduleResponse {
  bookings: AdminBooking[];
  total: number;
}

export interface GroomingPriceTier {
  id: string;
  sizeCategory: 'small' | 'medium' | 'large' | 'xl';
  conditionRating: number;
  label: string;
  estimatedMinutes: number;
  priceCents: number;
  isActive: boolean;
}

export interface GroomingMatrixResponse {
  matrix: GroomingPriceTier[];
}

export interface RateConditionResponse {
  bookingDog: BookingDog;
  priceTier: GroomingPriceTier;
}

export interface ServiceBundleItem {
  id: string;
  serviceType: {
    id: string;
    name: string;
    displayName: string;
    basePriceCents: number;
  };
}

export interface ServiceBundle {
  id: string;
  name: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isActive: boolean;
  sortOrder: number;
  items: ServiceBundleItem[];
  createdAt: string;
}

export interface BundlesResponse {
  bundles: ServiceBundle[];
}

export interface AdminStaffUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  is_active: boolean;
  created_at: string;
}

export interface AdminStaffListResponse {
  staff: AdminStaffUser[];
}

export interface ServiceTypesResponse {
  serviceTypes: ServiceType[];
}

export const adminBookingApi = {
  getServiceTypes: () =>
    api.get<ServiceTypesResponse>('/v2/admin/bookings/service-types'),
  getSchedule: (date: string, serviceType?: string) => {
    const params = new URLSearchParams({ date });
    if (serviceType) params.set('serviceType', serviceType);
    return api.get<ScheduleResponse>(`/v2/admin/bookings/schedule?${params}`);
  },
  confirmBooking: (bookingId: string) =>
    api.post<{ booking: AdminBooking }>(`/v2/admin/bookings/${bookingId}/confirm`, {}),
  checkIn: (bookingId: string) =>
    api.post<{ booking: AdminBooking }>(`/v2/admin/bookings/${bookingId}/check-in`, {}),
  checkOut: (bookingId: string) =>
    api.post<{ booking: AdminBooking }>(`/v2/admin/bookings/${bookingId}/check-out`, {}),
  markNoShow: (bookingId: string) =>
    api.post<{ booking: AdminBooking }>(`/v2/admin/bookings/${bookingId}/no-show`, {}),
};

export const adminGroomingApi = {
  rateCondition: (bookingDogId: string, conditionRating: number) =>
    api.post<RateConditionResponse>(`/v2/grooming/rate/${bookingDogId}`, { conditionRating }),
  getMatrix: () =>
    api.get<GroomingMatrixResponse>('/v2/grooming/matrix'),
  updatePrice: (tierId: string, data: { priceCents?: number; estimatedMinutes?: number }) =>
    api.put<GroomingPriceTier>(`/v2/grooming/matrix/${tierId}`, data),
};

export const adminStaffApi = {
  getStaff: () =>
    api.get<AdminStaffListResponse>('/v2/admin/staff'),
  createStaff: (data: { username: string; password: string; firstName: string; lastName: string; role?: string }) =>
    api.post<AdminStaffUser>('/v2/admin/staff', data),
  updateRole: (staffId: string, role: string) =>
    api.put<AdminStaffUser>(`/v2/admin/staff/${staffId}/role`, { role }),
};

export const adminBundleApi = {
  list: () =>
    api.get<BundlesResponse>('/v2/bundles'),
  create: (data: { name: string; description?: string; discountType: string; discountValue: number; serviceTypeIds: string[]; sortOrder?: number }) =>
    api.post<ServiceBundle>('/v2/bundles', data),
  update: (bundleId: string, data: Partial<{ name: string; description: string; discountType: string; discountValue: number; serviceTypeIds: string[]; sortOrder: number }>) =>
    api.put<ServiceBundle>(`/v2/bundles/${bundleId}`, data),
  toggle: (bundleId: string) =>
    api.delete<ServiceBundle>(`/v2/bundles/${bundleId}`),
};

// === Checkout / Payment Types ===

export interface CheckoutResponse {
  transactionId: string;
  paymentMethod: string;
  totalCharged: number;
  changeDue?: number;
  walletAmountCents?: number;
  cardAmountCents?: number;
  status: string;
}

export interface WalletBalanceResponse {
  balanceCents: number;
}

export const adminCheckoutApi = {
  getWalletBalance: (customerId: string) =>
    api.get<WalletBalanceResponse>(`/v2/admin/checkout/wallet-balance/${customerId}`),

  processPayment: (data: {
    bookingIds: string[];
    paymentMethod: string;
    walletAmount?: number;
    cashReceived?: number;
  }) =>
    api.post<CheckoutResponse>('/v2/admin/checkout/process', data),
};
