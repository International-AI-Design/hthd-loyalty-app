const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1_000, 3_000]; // exponential backoff: 1s, 3s

interface ApiError {
  error: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: unknown;
  /** True when the error was a cold-start / network issue (enables retry UI) */
  isRetryable?: boolean;
}

/**
 * Subscribers receive progressive status messages during retries.
 * Components can use this to show "Connecting to server..." / "Server is waking up..." UI.
 */
export type RetryStatusListener = (status: RetryStatus) => void;

export interface RetryStatus {
  /** Which attempt we are on (1 = first retry, 2 = second retry) */
  attempt: number;
  /** Max retries configured */
  maxRetries: number;
  /** User-friendly message for this retry stage */
  message: string;
}

const retryStatusListeners = new Set<RetryStatusListener>();

/**
 * Global 401 handler — AuthContext subscribes to auto-logout on expired tokens.
 */
type UnauthorizedListener = () => void;
let onUnauthorizedCallback: UnauthorizedListener | null = null;

/** Called by AuthContext to register the auto-logout handler */
export function setOnUnauthorized(callback: UnauthorizedListener | null): void {
  onUnauthorizedCallback = callback;
}

/** Subscribe to retry status updates. Returns an unsubscribe function. */
export function onRetryStatus(listener: RetryStatusListener): () => void {
  retryStatusListeners.add(listener);
  return () => { retryStatusListeners.delete(listener); };
}

function notifyRetryListeners(attempt: number): void {
  const status: RetryStatus = {
    attempt,
    maxRetries: MAX_RETRIES,
    message: attempt === 1
      ? 'Connecting to server...'
      : 'Server is waking up, please wait...',
  };
  retryStatusListeners.forEach((fn) => fn(status));
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof TypeError) return true; // network failure
  return false;
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

  let lastError: unknown;
  let lastWas503 = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        notifyRetryListeners(attempt);
      }

      const response = await fetchWithTimeout(
        `${API_BASE}${endpoint}`,
        { ...options, headers },
        REQUEST_TIMEOUT_MS,
      );

      // Retry on 503 Service Unavailable (Railway cold-start)
      if (response.status === 503 && attempt < MAX_RETRIES) {
        lastWas503 = true;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 3_000));
        continue;
      }

      lastWas503 = false;

      // Auto-logout on 401 (expired/revoked token)
      if (response.status === 401) {
        onUnauthorizedCallback?.();
        return { error: 'Session expired. Please log in again.' };
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        // Non-JSON response (e.g. HTML error page from Railway)
        if (!response.ok) {
          return {
            error: `Server error (${response.status}). Please try again.`,
            isRetryable: true,
          };
        }
        return { error: 'Unexpected server response. Please try again.' };
      }

      if (!response.ok) {
        const apiError = json as ApiError;
        return { error: apiError.error || 'An error occurred', details: apiError.details };
      }

      return { data: json as T };
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 3_000));
    }
  }

  if (lastWas503) {
    return {
      error: 'The server is still starting up. Please wait a moment and try again.',
      isRetryable: true,
    };
  }
  if (lastError instanceof DOMException && lastError.name === 'AbortError') {
    return {
      error: 'Request timed out. The server may be starting up — please try again.',
      isRetryable: true,
    };
  }
  return {
    error: 'Unable to reach the server. Please check your connection and try again.',
    isRetryable: true,
  };
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
  points_cap?: number;
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
  size_category: string | null;
  photoUrl?: string | null;
}

// V2 Dog Profile types (expanded)
export interface DogProfile {
  id: string;
  name: string;
  breed: string | null;
  birthDate: string | null;
  weight: number | null;
  temperament: string | null;
  careInstructions: string | null;
  isNeutered: boolean;
  photoUrl: string | null;
  socialNotes: string | null;
  sizeCategory: string | null;
  allergies: string | null;
  specialNeeds: string | null;
  emergencyVetName: string | null;
  emergencyVetPhone: string | null;
  lastGroomDate: string | null;
  notes: string | null;
  vaccinations: VaccinationRecord[];
  medications: MedicationRecord[];
  behaviorNotes?: BehaviorNote[];
}

export interface VaccinationRecord {
  id: string;
  name: string;
  dateGiven: string;
  expiresAt: string | null;
  vetName: string | null;
  documentUrl: string | null;
  cloudinaryPublicId: string | null;
  verified: boolean;
  notes: string | null;
}

export interface MedicationRecord {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export interface BehaviorNote {
  id: string;
  category: string;
  note: string;
  severity: number;
  reportedBy: string | null;
  createdAt: string;
  reporter?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
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
  addDog: (data: { name: string; breed?: string; birthDate?: string; sizeCategory?: string }) =>
    api.post<Dog>('/customers/me/dogs', data),
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

// Password Reset API
export interface ForgotPasswordResponse {
  message: string;
}

export interface VerifyResetCodeResponse {
  valid: boolean;
  resetToken: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export const passwordResetApi = {
  forgotPassword: (identifier: string) =>
    api.post<ForgotPasswordResponse>('/auth/forgot-password', { identifier }),
  verifyResetCode: (identifier: string, code: string) =>
    api.post<VerifyResetCodeResponse>('/auth/verify-reset-code', { identifier, code }),
  resetPassword: (resetToken: string, password: string) =>
    api.post<ResetPasswordResponse>('/auth/reset-password', { resetToken, password }),
};

// Dog Profile APIs (V2 - expanded)
export interface UploadResponse {
  url: string;
  publicId: string;
}

export const dogProfileApi = {
  getDogs: () => api.get<{ dogs: Array<DogProfile & { vaccinationCount: number; activeMedicationCount: number }> }>('/v2/dogs'),
  getDog: (dogId: string) => api.get<{ dog: DogProfile }>(`/v2/dogs/${dogId}`),
  updateDog: (dogId: string, data: Partial<Omit<DogProfile, 'id' | 'vaccinations' | 'medications' | 'behaviorNotes'>>) =>
    api.put<{ dog: DogProfile }>(`/v2/dogs/${dogId}`, data),
  addVaccination: (dogId: string, data: { name: string; dateGiven: string; expiresAt?: string | null; vetName?: string; documentUrl?: string; cloudinaryPublicId?: string }) =>
    api.post<VaccinationRecord>(`/v2/dogs/${dogId}/vaccinations`, data),
  updateVaccination: (dogId: string, vaccinationId: string, data: Partial<{ name: string; dateGiven: string; expiresAt: string | null; vetName: string; documentUrl: string | null; cloudinaryPublicId: string | null }>) =>
    api.put<VaccinationRecord>(`/v2/dogs/${dogId}/vaccinations/${vaccinationId}`, data),
  deleteVaccination: (dogId: string, vaccinationId: string) =>
    api.delete<{ success: boolean }>(`/v2/dogs/${dogId}/vaccinations/${vaccinationId}`),
  addMedication: (dogId: string, data: { name: string; dosage?: string; frequency?: string; instructions?: string; startDate?: string; endDate?: string }) =>
    api.post<MedicationRecord>(`/v2/dogs/${dogId}/medications`, data),
  updateMedication: (dogId: string, medicationId: string, data: Partial<{ name: string; dosage: string; frequency: string; instructions: string; startDate: string; endDate: string; isActive: boolean }>) =>
    api.put<MedicationRecord>(`/v2/dogs/${dogId}/medications/${medicationId}`, data),
  deleteMedication: (dogId: string, medicationId: string) =>
    api.delete<{ success: boolean }>(`/v2/dogs/${dogId}/medications/${medicationId}`),
  getCompliance: (dogId: string) => api.get<{ dogId: string; isFullyCompliant: boolean; compliance: Array<{ requirement: string; description: string; status: string; lastGiven: string | null; expiresAt: string | null }> }>(`/v2/dogs/${dogId}/compliance`),
  uploadPhoto: async (file: File): Promise<ApiResponse<UploadResponse>> => {
    const formData = new FormData();
    formData.append('photo', file);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/v2/uploads`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error || 'Upload failed' };
      return { data: json as UploadResponse };
    } catch {
      return { error: 'Upload failed. Please check your connection and try again.' };
    }
  },
};

// Messaging APIs
export const messagingApi = {
  getConversations: () => api.get<any[]>('/v2/messaging/conversations'),
  startConversation: (dogId?: string) => api.post<any>('/v2/messaging/conversations', { dogId }),
  getMessages: (conversationId: string, limit?: number, offset?: number) =>
    api.get<any>(`/v2/messaging/conversations/${conversationId}/messages?limit=${limit || 50}&offset=${offset || 0}`),
  sendMessage: (conversationId: string, content: string, photoUrl?: string) =>
    api.post<any>(`/v2/messaging/conversations/${conversationId}/messages`, { content, photoUrl }),
  sendQuickReply: (conversationId: string, quickReplyId: string) =>
    api.post<any>(`/v2/messaging/conversations/${conversationId}/quick-reply`, { quickReplyId }),
  closeConversation: (conversationId: string) =>
    api.post<any>(`/v2/messaging/conversations/${conversationId}/close`, {}),
  markRead: (conversationId: string) =>
    api.put<any>(`/v2/messaging/conversations/${conversationId}/read`, {}),
  getQuickReplies: () => api.get<any>('/v2/messaging/quick-replies'),
};

// Notification APIs
export const notificationApi = {
  getNotifications: () => api.get<any>('/v2/notifications'),
  markRead: (id: string) => api.put<any>(`/v2/notifications/${id}/read`, {}),
  markAllRead: () => api.put<any>('/v2/notifications/read-all', {}),
};

// Activity Feed APIs
export const activityApi = {
  getActivities: (bookingId: string) => api.get<any>(`/v2/bookings/${bookingId}/activities`),
  getActivitiesByDog: (dogId: string) => api.get<any>(`/v2/dogs/${dogId}/activities`),
  getTodayActivities: () => api.get<any>('/v2/activities/today'),
};

// Report Card APIs
export const reportCardApi = {
  getReportCards: (limit?: number, offset?: number) =>
    api.get<any>(`/v2/report-cards?limit=${limit || 20}&offset=${offset || 0}`),
  getReportCard: (id: string) => api.get<any>(`/v2/report-cards/${id}`),
  getReportCardsByDog: (dogId: string) => api.get<any>(`/v2/report-cards/dog/${dogId}`),
};

// Referral Validation API
export interface ReferralValidation {
  valid: boolean;
  referrer_first_name?: string;
  error?: string;
}

export const referralApi = {
  validate: (code: string) =>
    api.get<ReferralValidation>(`/referrals/validate/${code}`),
};

// === V2 Agreements Types ===

export interface ServiceAgreement {
  id: string;
  name: string;
  displayName: string;
  content: string;
  version: number;
}

export interface AgreementCompliance {
  compliant: boolean;
  missing: ServiceAgreement[];
  signed: ServiceAgreement[];
}

export interface AgreementSignature {
  id: string;
  agreementId: string;
  typedName: string;
  signedAt: string;
  agreement: { displayName: string; version: number };
}

export interface BoardingDetail {
  id: string;
  bookingId: string;
  feedingSchedule: string | null;
  foodType: string | null;
  foodBrand: string | null;
  feedingNotes: string | null;
  dropOffTime: string | null;
  pickUpTime: string | null;
  specialItems: string | null;
  emergencyContact: string | null;
}

export const agreementApi = {
  getRequired: (serviceType: string) =>
    api.get<{ agreements: ServiceAgreement[] }>(`/v2/agreements?serviceType=${serviceType}`),
  getAll: () =>
    api.get<{ agreements: ServiceAgreement[] }>('/v2/agreements'),
  getMySignatures: () =>
    api.get<{ signatures: AgreementSignature[] }>('/v2/agreements/my-signatures'),
  checkCompliance: (serviceType: string) =>
    api.get<AgreementCompliance>(`/v2/agreements/compliance?serviceType=${serviceType}`),
  sign: (agreementId: string, typedName: string) =>
    api.post<{ signature: AgreementSignature }>('/v2/agreements/sign', { agreementId, typedName, agreedToTerms: true }),
  getBoardingDetail: (bookingId: string) =>
    api.get<{ boardingDetail: BoardingDetail }>(`/v2/agreements/boarding-detail/${bookingId}`),
  saveBoardingDetail: (bookingId: string, data: Partial<Omit<BoardingDetail, 'id' | 'bookingId'>>) =>
    api.put<{ boardingDetail: BoardingDetail }>(`/v2/agreements/boarding-detail/${bookingId}`, data),
};

// === V2 Grooming Pricing Types ===

export interface GroomingServicePriceItem {
  id: string;
  subServiceId: string;
  sizeCategory: string | null;
  priceCents: number;
  isActive: boolean;
  subService: { name: string; displayName: string; isCoatRelated: boolean };
}

export interface GroomingAddOn {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceCents: number;
  sortOrder: number;
  isActive: boolean;
}

export interface PricingSheet {
  subServices: Array<{
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    isCoatRelated: boolean;
    prices: Array<{ sizeCategory: string | null; priceCents: number }>;
  }>;
  addOns: GroomingAddOn[];
}

export const groomingApi = {
  getPricingSheet: () => api.get<PricingSheet>('/v2/grooming/pricing-sheet'),
  getAddOns: () => api.get<{ addOns: GroomingAddOn[] }>('/v2/grooming/add-ons'),
};

// === V2 Badges Types ===

export interface CustomerBadge {
  id: string;
  badge: string;
  displayName: string;
  description: string;
  icon: string;
  earnedAt: string;
  notified: boolean;
}

export interface NextBadgeProgress {
  badge: string | null;
  displayName: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  progressPct: number;
  message?: string;
}

export interface EvaluationResult {
  newBadges: string[];
  allBadges: CustomerBadge[];
}

export const badgeApi = {
  getBadges: () => api.get<{ badges: CustomerBadge[] }>('/v2/badges'),
  getNextBadge: () => api.get<NextBadgeProgress>('/v2/badges/next'),
  evaluate: () => api.post<EvaluationResult>('/v2/badges/evaluate', {}),
  markNotified: (id: string) => api.put<{ success: boolean }>(`/v2/badges/${id}/notified`, {}),
};

// === V2 Booking Types ===

export interface GroomingSubService {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  basePriceCents: number;
  isCoatRelated: boolean;
  sortOrder: number;
}

export interface GroomingSubServicesResponse {
  subServices: GroomingSubService[];
}

export interface ServiceType {
  id: string;
  name: string;
  displayName: string;
  description: string;
  basePriceCents: number;
  durationMinutes: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ServiceTypesResponse {
  serviceTypes: ServiceType[];
}

export interface AvailabilityDay {
  date: string;
  available: boolean;
  spotsRemaining: number;
  totalCapacity: number;
}

export interface AvailabilityResponse {
  availability: AvailabilityDay[];
}

export interface GroomingSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  spotsRemaining: number;
}

export interface GroomingSlotsResponse {
  slots: GroomingSlot[];
}

export interface GroomingPriceRange {
  sizeCategory: string;
  minPriceCents: number;
  maxPriceCents: number;
}

export interface BookingDog {
  id: string;
  bookingId: string;
  dogId: string;
  conditionRating: number | null;
  conditionPhoto: string | null;
  quotedPriceCents: number | null;
  notes: string | null;
  dog: Dog;
}

export interface Booking {
  id: string;
  customerId: string;
  serviceTypeId: string;
  date: string;
  startTime: string | null;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  totalCents: number;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  serviceType: ServiceType;
  dogs: BookingDog[];
}

export interface BookingResponse {
  booking: Booking;
}

export interface BookingsResponse {
  bookings: Booking[];
  total: number;
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
}

export interface BundlesResponse {
  bundles: ServiceBundle[];
}

export interface BundleCalculation {
  bundle: { id: string; name: string; discountType: string; discountValue: number };
  services: { serviceType: string; basePriceCents: number }[];
  dogCount: number;
  baseTotalCents: number;
  discountCents: number;
  finalTotalCents: number;
}

export const bookingApi = {
  getServiceTypes: () =>
    api.get<ServiceTypesResponse>('/v2/bookings/service-types'),
  checkAvailability: (serviceTypeId: string, startDate: string, endDate: string) =>
    api.get<AvailabilityResponse>(
      `/v2/bookings/availability?serviceTypeId=${serviceTypeId}&startDate=${startDate}&endDate=${endDate}`
    ),
  getGroomingSlots: (date: string) =>
    api.get<GroomingSlotsResponse>(`/v2/bookings/grooming-slots?date=${date}`),
  getGroomingPriceRange: (sizeCategory: string) =>
    api.get<GroomingPriceRange>(`/v2/grooming/pricing/${sizeCategory}`),
  getGroomingSubServices: () =>
    api.get<GroomingSubServicesResponse>('/v2/grooming/sub-services'),
  createBooking: (data: { serviceTypeId: string; dogIds: string[]; date: string; startTime?: string; notes?: string; groomingSubServiceId?: string }) =>
    api.post<BookingResponse>('/v2/bookings', data),
  getBookings: (params?: { status?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return api.get<BookingsResponse>(`/v2/bookings${qs ? `?${qs}` : ''}`);
  },
  cancelBooking: (bookingId: string, reason?: string) =>
    api.post<BookingResponse>(`/v2/bookings/${bookingId}/cancel`, { reason }),
  uploadDogPhoto: (bookingId: string, dogId: string, photo: string) =>
    api.post<{ success: boolean; message: string }>(`/v2/bookings/${bookingId}/dogs/${dogId}/photo`, { photo }),
  updateDogSize: (dogId: string, sizeCategory: string) =>
    api.put<Dog>(`/v2/bookings/dogs/${dogId}/size`, { sizeCategory }),
  getBundleSuggestions: (serviceTypeId: string) =>
    api.get<BundlesResponse>(`/v2/bundles/suggestions?serviceTypeId=${serviceTypeId}`),
  calculateBundlePrice: (bundleId: string, dogIds: string[]) =>
    api.get<BundleCalculation>(`/v2/bundles/calculate?bundleId=${bundleId}&dogIds=${dogIds.join(',')}`),
  updateSmsPreference: (smsDealsOptedOut: boolean) =>
    api.put<{ success: boolean; smsDealsOptedOut: boolean }>('/customers/me/preferences', { smsDealsOptedOut }),
};


// === V2 Multi-Day Booking & Checkout Types ===

export interface DateAvailability {
  available: number;
  capacity: number;
}

export interface MultiDayAvailabilityResponse {
  dates: Record<string, DateAvailability>;
}

export interface MultiDayBookingResponse {
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    totalAmount: number;
    serviceType: string;
    dogIds: string[];
  };
}

export interface WalletResponse {
  id: string;
  balance_cents: number;
  tier: string;
  auto_reload: {
    enabled: boolean;
    threshold_cents: number;
    reload_amount_cents: number;
  };
}

export interface CheckoutResult {
  paymentId: string;
  transactionId: string;
  totalCents: number;
  walletAmountCents: number;
  cardAmountCents: number;
  pointsRedeemed: number;
  pointsAmountCents: number;
  tipCents: number;
  status: string;
  bookings: Array<{ id: string; status: string }>;
  createdAt: string;
}

export interface ReceiptData {
  paymentId: string;
  transactionId: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  bookings: Array<{
    id: string;
    serviceType: string;
    date: string;
    startDate: string | null;
    endDate: string | null;
    dogs: string[];
    totalCents: number;
  }>;
  totalCents: number;
  walletAmountCents: number;
  cardAmountCents: number;
  tipCents: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export const multiDayBookingApi = {
  getAvailability: (startDate: string, endDate: string, serviceType: string) =>
    api.get<MultiDayAvailabilityResponse>(
      `/v2/bookings/availability?startDate=${startDate}&endDate=${endDate}&serviceType=${serviceType}`
    ),
  createMultiDayBooking: (data: { startDate: string; endDate: string; serviceTypeId: string; dogIds: string[] }) =>
    api.post<MultiDayBookingResponse>('/v2/bookings/multi-day', data),
};

export const checkoutApi = {
  getWallet: () => api.get<WalletResponse>('/v2/wallet'),
  getPointsBalance: () => api.get<CustomerProfile>('/customers/me'),
  loadWalletFunds: (amountCents: number) =>
    api.post<WalletResponse>('/v2/wallet/load', { amount_cents: amountCents }),
  checkout: (data: {
    bookingIds: string[];
    paymentMethod: 'wallet' | 'card' | 'split' | 'points';
    walletAmountCents?: number;
    pointsToRedeem?: number;
    tipCents?: number;
  }) => api.post<CheckoutResult>('/v2/checkout', data),
  getReceipt: (paymentId: string) => api.get<ReceiptData>(`/v2/checkout/${paymentId}/receipt`),
};
