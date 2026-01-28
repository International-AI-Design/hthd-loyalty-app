const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  const token = localStorage.getItem('token');

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
  } catch (err) {
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

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  referral_code?: string;
}

export interface AuthResponse {
  token: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    points_balance: number;
    referral_code: string;
  };
}

export interface CustomerProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  points_balance: number;
  referral_code: string;
}

export interface PointsTransaction {
  id: string;
  type: string;
  points_amount: number;
  description: string;
  date: string;
}

export interface TransactionsResponse {
  transactions: PointsTransaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface RedemptionResponse {
  success: boolean;
  message: string;
  redemption: {
    id: string;
    redemption_code: string;
    reward_tier: number;
    discount_value: number;
    status: string;
    created_at: string;
  };
  instructions: string;
}

export interface Redemption {
  id: string;
  redemption_code: string;
  reward_tier: number;
  discount_value: number;
  status: string;
  created_at: string;
  approved_at?: string | null;
}

export interface RedemptionsListResponse {
  pending: Redemption[];
  completed: Redemption[];
}

export interface ReferredCustomer {
  id: string;
  first_name: string;
  joined_at: string;
}

export interface ReferralStatsResponse {
  referral_count: number;
  total_bonus_points: number;
  referred_customers: ReferredCustomer[];
}

export interface Dog {
  id: string;
  name: string;
  breed: string | null;
  birth_date: string | null;
  notes: string | null;
}

export interface DogsResponse {
  dogs: Dog[];
}

export interface Visit {
  id: string;
  visit_date: string;
  service_type: string;
  description: string | null;
  amount: number;
  points_earned: number;
}

export interface VisitsResponse {
  visits: Visit[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export const authApi = {
  register: (data: RegisterData) => api.post<AuthResponse>('/auth/register', data),
  login: (data: { email?: string; phone?: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
  getProfile: () => api.get<CustomerProfile>('/customers/me'),
};

export const customerApi = {
  getTransactions: (limit = 10, offset = 0) =>
    api.get<TransactionsResponse>(`/customers/me/transactions?limit=${limit}&offset=${offset}`),
  requestRedemption: (rewardTier: number) =>
    api.post<RedemptionResponse>('/redemptions/request', { reward_tier: String(rewardTier) }),
  getRedemptions: () => api.get<RedemptionsListResponse>('/redemptions'),
  getReferralStats: () => api.get<ReferralStatsResponse>('/customers/me/referrals'),
  getDogs: () => api.get<DogsResponse>('/customers/me/dogs'),
  getVisits: (limit = 10, offset = 0) =>
    api.get<VisitsResponse>(`/customers/me/visits?limit=${limit}&offset=${offset}`),
};

// Claim API for pre-imported customers
export interface ClaimDog {
  id: string;
  name: string;
  breed: string | null;
}

export interface ClaimVisit {
  id: string;
  visit_date: string;
  service_type: string;
  description: string | null;
  amount: number;
}

export interface ClaimLookupResponse {
  found: boolean;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email_masked: string;
    points_balance: number;
    dogs: ClaimDog[];
    recent_visits: ClaimVisit[];
  };
}

export interface ClaimSendCodeResponse {
  success: boolean;
  message: string;
}

export interface ClaimVerifyResponse {
  success: boolean;
  message: string;
  token: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    points_balance: number;
    referral_code: string;
  };
}

export const claimApi = {
  lookup: (identifier: string) =>
    api.post<ClaimLookupResponse>('/claim/lookup', { identifier }),
  sendCode: (customerId: string) =>
    api.post<ClaimSendCodeResponse>('/claim/send-code', { customer_id: customerId }),
  verify: (customerId: string, code: string, password: string) =>
    api.post<ClaimVerifyResponse>('/claim/verify', { customer_id: customerId, code, password }),
};
