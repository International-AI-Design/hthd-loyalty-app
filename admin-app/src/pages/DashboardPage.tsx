import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminDashboardApi } from '../lib/api';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '--:--';
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return timeStr;
  }
}

function capacityColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function capacityTextColor(pct: number): string {
  if (pct >= 90) return 'text-red-600';
  if (pct >= 70) return 'text-amber-600';
  return 'text-emerald-600';
}

function capacityBgColor(pct: number): string {
  if (pct >= 90) return 'bg-red-50';
  if (pct >= 70) return 'bg-amber-50';
  return 'bg-emerald-50';
}

interface FacilityData {
  totalDogs: number;
  capacity: number;
  daycare: number;
  boarding: number;
  grooming: number;
}

interface ArrivalItem {
  id: string;
  customerName: string;
  dogs: string[];
  service: string;
  expectedTime: string | null;
  status: string;
}

interface DepartureItem {
  id: string;
  customerName: string;
  dogs: string[];
  service: string;
  expectedTime: string | null;
  status: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  shiftStart: string;
  shiftEnd: string;
}

interface ComplianceAlert {
  dogId: string;
  dogName: string;
  ownerName: string;
  issue: string;
  bookingDate: string | null;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));

  // Data states
  const [facility, setFacility] = useState<FacilityData | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [departures, setDepartures] = useState<DepartureItem[]>([]);
  const [staffOnDuty, setStaffOnDuty] = useState<StaffMember[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);

  // Loading states
  const [isLoadingFacility, setIsLoadingFacility] = useState(true);
  const [isLoadingArrivals, setIsLoadingArrivals] = useState(true);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [_isLoadingCompliance, setIsLoadingCompliance] = useState(true);

  // Error states
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [arrivalsError, setArrivalsError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Mobile tab for arrivals/departures
  const [activeTab, setActiveTab] = useState<'arrivals' | 'departures'>('arrivals');

  const isToday = selectedDate === formatDate(new Date());

  const fetchFacility = useCallback(async () => {
    setIsLoadingFacility(true);
    setFacilityError(null);
    const result = await adminDashboardApi.getFacility(selectedDate);
    setIsLoadingFacility(false);
    if (result.error) {
      setFacilityError(result.error);
      // Provide fallback data so UI still renders
      setFacility({ totalDogs: 0, capacity: 40, daycare: 0, boarding: 0, grooming: 0 });
    } else if (result.data) {
      setFacility(result.data);
    }
  }, [selectedDate]);

  const fetchArrivals = useCallback(async () => {
    setIsLoadingArrivals(true);
    setArrivalsError(null);
    const result = await adminDashboardApi.getArrivals(selectedDate);
    setIsLoadingArrivals(false);
    if (result.error) {
      setArrivalsError(result.error);
      setArrivals([]);
      setDepartures([]);
    } else if (result.data) {
      setArrivals(result.data.arrivals || []);
      setDepartures(result.data.departures || []);
    }
  }, [selectedDate]);

  const fetchStaff = useCallback(async () => {
    setIsLoadingStaff(true);
    setStaffError(null);
    const result = await adminDashboardApi.getStaff(selectedDate);
    setIsLoadingStaff(false);
    if (result.error) {
      setStaffError(result.error);
      setStaffOnDuty([]);
    } else if (result.data) {
      setStaffOnDuty(result.data.staff || []);
    }
  }, [selectedDate]);

  const fetchCompliance = useCallback(async () => {
    setIsLoadingCompliance(true);
    const result = await adminDashboardApi.getCompliance();
    setIsLoadingCompliance(false);
    if (result.data) {
      setComplianceAlerts(result.data.alerts || []);
    } else {
      setComplianceAlerts([]);
    }
  }, []);

  useEffect(() => {
    fetchFacility();
    fetchArrivals();
    fetchStaff();
  }, [fetchFacility, fetchArrivals, fetchStaff]);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const goToToday = () => {
    setSelectedDate(formatDate(new Date()));
  };

  const capacityPct = facility ? Math.round((facility.totalDogs / facility.capacity) * 100) : 0;

  const staffDogRatio = facility && staffOnDuty.length > 0
    ? `1:${Math.round(facility.totalDogs / staffOnDuty.length)}`
    : '--';

  // Role breakdown
  const roleBreakdown = staffOnDuty.reduce<Record<string, number>>((acc, s) => {
    const role = s.role || 'Staff';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1B365D]">
            {isToday ? 'Today at Happy Tail' : 'Happy Tail Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] min-h-[44px]"
          />
          {!isToday && (
            <button
              onClick={goToToday}
              className="px-4 py-2.5 bg-[#1B365D] text-white text-sm font-medium rounded-lg hover:bg-[#152a4a] transition-colors min-h-[44px]"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Top Row: Facility Status + Staff On Duty */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Facility Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-[#1B365D]">Facility Status</h2>
            {isLoadingFacility && (
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
            )}
          </div>

          {facilityError && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              {facilityError}
            </div>
          )}

          {facility && (
            <>
              {/* Dog count gauge */}
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-[#1B365D]">
                  {facility.totalDogs}
                  <span className="text-lg text-gray-400 font-normal">/{facility.capacity}</span>
                </div>
                <p className="text-sm text-gray-500">dogs on site</p>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Capacity</span>
                  <span className={`text-sm font-semibold ${capacityTextColor(capacityPct)}`}>
                    {capacityPct}%
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${capacityColor(capacityPct)}`}
                    style={{ width: `${Math.min(capacityPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Service breakdown */}
              <div className={`grid grid-cols-3 gap-3 p-3 rounded-lg ${capacityBgColor(capacityPct)}`}>
                <div className="text-center">
                  <div className="text-lg font-bold text-[#1B365D]">{facility.daycare}</div>
                  <div className="text-xs text-gray-500">Daycare</div>
                </div>
                <div className="text-center border-x border-gray-200">
                  <div className="text-lg font-bold text-[#1B365D]">{facility.boarding}</div>
                  <div className="text-xs text-gray-500">Boarding</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-[#1B365D]">{facility.grooming}</div>
                  <div className="text-xs text-gray-500">Grooming</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Staff On Duty Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-[#1B365D]">Staff On Duty</h2>
            {isLoadingStaff && (
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
            )}
          </div>

          {staffError && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              {staffError}
            </div>
          )}

          {/* Ratio indicator */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-[#F8F6F3] rounded-lg">
            <div className="flex-1">
              <div className="text-sm text-gray-500">Staff : Dogs</div>
              <div className="text-xl font-bold text-[#1B365D]">{staffDogRatio}</div>
            </div>
            <div className="flex-1 border-l border-gray-200 pl-4">
              <div className="text-sm text-gray-500">On Duty</div>
              <div className="text-xl font-bold text-[#1B365D]">{staffOnDuty.length}</div>
            </div>
            <div className="flex-1 border-l border-gray-200 pl-4">
              <div className="text-sm text-gray-500">Roles</div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {Object.entries(roleBreakdown).map(([role, count]) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#62A2C3]/15 text-[#1B365D]"
                  >
                    {count} {role}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Staff list */}
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {staffOnDuty.length === 0 && !isLoadingStaff && (
              <div className="text-center py-6 text-gray-400 text-sm">
                No staff scheduled for this day
              </div>
            )}
            {staffOnDuty.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#62A2C3]/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-[#1B365D]">
                      {member.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {formatTime(member.shiftStart)} - {formatTime(member.shiftEnd)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Arrivals & Departures */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold text-[#1B365D]">
            Arrivals & Departures
          </h2>
          {isLoadingArrivals && (
            <div className="w-5 h-5 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
          )}
        </div>

        {arrivalsError && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            {arrivalsError}
          </div>
        )}

        {/* Mobile tabs */}
        <div className="flex sm:hidden gap-2 mb-4">
          <button
            onClick={() => setActiveTab('arrivals')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              activeTab === 'arrivals'
                ? 'bg-[#1B365D] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Arrivals
            {arrivals.length > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'arrivals' ? 'bg-white/20' : 'bg-[#1B365D] text-white'
              }`}>
                {arrivals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('departures')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              activeTab === 'departures'
                ? 'bg-[#1B365D] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Departures
            {departures.length > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'departures' ? 'bg-white/20' : 'bg-[#1B365D] text-white'
              }`}>
                {departures.length}
              </span>
            )}
          </button>
        </div>

        {/* Desktop: Two columns */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-6">
          {/* Arrivals column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Arrivals
                <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium normal-case">
                  {arrivals.length}
                </span>
              </h3>
            </div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {arrivals.length === 0 && !isLoadingArrivals && (
                <div className="text-center py-8 text-gray-400 text-sm">No arrivals scheduled</div>
              )}
              {arrivals.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.customerName}</p>
                    <p className="text-xs text-gray-500">
                      {item.dogs.join(', ')} &middot; {item.service}
                    </p>
                    {item.expectedTime && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(item.expectedTime)}</p>
                    )}
                  </div>
                  <button
                    className="ml-3 px-3 py-2 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors min-h-[36px] whitespace-nowrap"
                  >
                    Check In
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Departures column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-[#62A2C3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Departures
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#62A2C3]/15 text-[#1B365D] text-xs font-medium normal-case">
                  {departures.length}
                </span>
              </h3>
            </div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {departures.length === 0 && !isLoadingArrivals && (
                <div className="text-center py-8 text-gray-400 text-sm">No departures scheduled</div>
              )}
              {departures.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-[#62A2C3]/30 hover:bg-[#62A2C3]/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.customerName}</p>
                    <p className="text-xs text-gray-500">
                      {item.dogs.join(', ')} &middot; {item.service}
                    </p>
                    {item.expectedTime && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(item.expectedTime)}</p>
                    )}
                  </div>
                  <button
                    className="ml-3 px-3 py-2 bg-[#62A2C3] text-white text-xs font-medium rounded-lg hover:bg-[#5191b0] transition-colors min-h-[36px] whitespace-nowrap"
                  >
                    Check Out
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: Single column with tab switching */}
        <div className="sm:hidden">
          {activeTab === 'arrivals' && (
            <div className="space-y-2">
              {arrivals.length === 0 && !isLoadingArrivals && (
                <div className="text-center py-8 text-gray-400 text-sm">No arrivals scheduled</div>
              )}
              {arrivals.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.customerName}</p>
                    <p className="text-xs text-gray-500">
                      {item.dogs.join(', ')} &middot; {item.service}
                    </p>
                    {item.expectedTime && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(item.expectedTime)}</p>
                    )}
                  </div>
                  <button
                    className="ml-3 px-3 py-2 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors min-h-[44px] whitespace-nowrap"
                  >
                    Check In
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'departures' && (
            <div className="space-y-2">
              {departures.length === 0 && !isLoadingArrivals && (
                <div className="text-center py-8 text-gray-400 text-sm">No departures scheduled</div>
              )}
              {departures.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.customerName}</p>
                    <p className="text-xs text-gray-500">
                      {item.dogs.join(', ')} &middot; {item.service}
                    </p>
                    {item.expectedTime && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(item.expectedTime)}</p>
                    )}
                  </div>
                  <button
                    className="ml-3 px-3 py-2 bg-[#62A2C3] text-white text-xs font-medium rounded-lg hover:bg-[#5191b0] transition-colors min-h-[44px] whitespace-nowrap"
                  >
                    Check Out
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compliance Alerts */}
      {complianceAlerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E8837B]/30 p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#E8837B]/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#E8837B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-[#1B365D]">Compliance Alerts</h2>
              <p className="text-sm text-[#E8837B] font-medium">
                {complianceAlerts.length} issue{complianceAlerts.length !== 1 ? 's' : ''} need attention
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {complianceAlerts.map((alert, idx) => (
              <div
                key={`${alert.dogId}-${idx}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-[#E8837B]/5 border border-[#E8837B]/15 gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {alert.dogName}
                    <span className="text-gray-400 font-normal"> &mdash; {alert.ownerName}</span>
                  </p>
                  <p className="text-xs text-[#E8837B] font-medium">{alert.issue}</p>
                  {alert.bookingDate && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Next booking: {new Date(alert.bookingDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/customers`)}
                  className="px-3 py-2 text-[#1B365D] text-xs font-medium border border-[#1B365D]/20 rounded-lg hover:bg-[#1B365D]/5 transition-colors min-h-[36px] sm:min-h-[auto] whitespace-nowrap"
                >
                  View Profile
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => navigate('/staff-schedule')}
          className="flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#62A2C3]/30 hover:shadow-md transition-all min-h-[100px] group"
        >
          <div className="w-10 h-10 rounded-full bg-[#62A2C3]/15 flex items-center justify-center mb-2 group-hover:bg-[#62A2C3]/25 transition-colors">
            <svg className="w-5 h-5 text-[#62A2C3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[#1B365D]">Manage Schedule</span>
        </button>

        <button
          onClick={() => navigate('/customers')}
          className="flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#62A2C3]/30 hover:shadow-md transition-all min-h-[100px] group"
        >
          <div className="w-10 h-10 rounded-full bg-[#62A2C3]/15 flex items-center justify-center mb-2 group-hover:bg-[#62A2C3]/25 transition-colors">
            <svg className="w-5 h-5 text-[#62A2C3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[#1B365D]">Customer Lookup</span>
        </button>

        <button
          onClick={() => navigate('/loyalty')}
          className="flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#F5C65D]/40 hover:shadow-md transition-all min-h-[100px] group"
        >
          <div className="w-10 h-10 rounded-full bg-[#F5C65D]/20 flex items-center justify-center mb-2 group-hover:bg-[#F5C65D]/30 transition-colors">
            <svg className="w-5 h-5 text-[#D4A843]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[#1B365D]">Loyalty Points</span>
        </button>

        <button
          onClick={() => navigate('/report-cards-admin')}
          className="flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#7FB685]/30 hover:shadow-md transition-all min-h-[100px] group"
        >
          <div className="w-10 h-10 rounded-full bg-[#7FB685]/15 flex items-center justify-center mb-2 group-hover:bg-[#7FB685]/25 transition-colors">
            <svg className="w-5 h-5 text-[#7FB685]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[#1B365D]">Report Cards</span>
        </button>
      </div>
    </div>
  );
}
