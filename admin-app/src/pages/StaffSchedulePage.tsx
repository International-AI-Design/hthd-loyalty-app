import { useState, useEffect, useCallback } from 'react';
import { adminScheduleApi, adminStaffApi } from '../lib/api';
import type { AdminStaffUser } from '../lib/api';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatTime(time: string): string {
  if (!time) return '';
  // Handle HH:MM format
  const parts = time.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
  return time;
}

interface StaffBreak {
  id: string;
  startTime: string;
  endTime: string;
  type: string;
}

interface ScheduleShift {
  id: string;
  staffUserId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  breaks: StaffBreak[];
}

interface CoverageData {
  date: string;
  staffCount: number;
  expectedDogs: number;
  ratio: string;
}

const ROLES = [
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'groomer', label: 'Groomer' },
  { value: 'admin', label: 'Admin' },
];

export function StaffSchedulePage() {
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [coverage, setCoverage] = useState<CoverageData[]>([]);
  const [staffList, setStaffList] = useState<AdminStaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);

  // Form state
  const [formStaffId, setFormStaffId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formRole, setFormRole] = useState('staff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Break form state
  const [showBreakForm, setShowBreakForm] = useState<string | null>(null); // scheduleId
  const [breakStartTime, setBreakStartTime] = useState('12:00');
  const [breakEndTime, setBreakEndTime] = useState('13:00');
  const [breakType, setBreakType] = useState('lunch');
  const [isBreakSubmitting, setIsBreakSubmitting] = useState(false);

  // Mobile day view
  const [mobileSelectedDay, setMobileSelectedDay] = useState(0); // 0-6 for Mon-Sun

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = formatDateISO(getMonday(new Date())) === formatDateISO(weekStart);

  const fetchWeekData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const startDate = formatDateISO(weekStart);
    const result = await adminScheduleApi.getWeekView(startDate);
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      setShifts([]);
    } else if (result.data) {
      setShifts(result.data.shifts || []);
      setCoverage(result.data.coverage || []);
    }
  }, [weekStart]);

  const fetchStaff = useCallback(async () => {
    const result = await adminStaffApi.getStaff();
    if (result.data) {
      setStaffList(result.data.staff || []);
    }
  }, []);

  useEffect(() => {
    fetchWeekData();
  }, [fetchWeekData]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handlePrevWeek = () => {
    setWeekStart(addDays(weekStart, -7));
  };

  const handleNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const handleThisWeek = () => {
    setWeekStart(getMonday(new Date()));
  };

  const openAddModal = (date?: string) => {
    setEditingShift(null);
    setFormStaffId(staffList[0]?.id || '');
    setFormDate(date || formatDateISO(weekDays[0]));
    setFormStartTime('08:00');
    setFormEndTime('17:00');
    setFormRole('staff');
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (shift: ScheduleShift) => {
    setEditingShift(shift);
    setFormStaffId(shift.staffUserId);
    setFormDate(shift.date);
    setFormStartTime(shift.startTime);
    setFormEndTime(shift.endTime);
    setFormRole(shift.role);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingShift(null);
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!formStaffId || !formDate || !formStartTime || !formEndTime) {
      setFormError('All fields are required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const data = {
      staffUserId: formStaffId,
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      role: formRole,
    };

    let result;
    if (editingShift) {
      result = await adminScheduleApi.update(editingShift.id, data);
    } else {
      result = await adminScheduleApi.create(data);
    }

    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
    } else {
      handleCloseModal();
      fetchWeekData();
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Delete this shift?')) return;
    const result = await adminScheduleApi.delete(shiftId);
    if (!result.error) {
      fetchWeekData();
    }
  };

  const handleAddBreak = async (scheduleId: string) => {
    if (!breakStartTime || !breakEndTime) return;
    setIsBreakSubmitting(true);
    const result = await adminScheduleApi.addBreak(scheduleId, {
      startTime: breakStartTime,
      endTime: breakEndTime,
      type: breakType,
    });
    setIsBreakSubmitting(false);
    if (!result.error) {
      setShowBreakForm(null);
      setBreakStartTime('12:00');
      setBreakEndTime('13:00');
      setBreakType('lunch');
      fetchWeekData();
    }
  };

  const handleRemoveBreak = async (breakId: string) => {
    if (!confirm('Remove this break?')) return;
    const result = await adminScheduleApi.removeBreak(breakId);
    if (!result.error) {
      fetchWeekData();
    }
  };

  // Group shifts by staff member for grid
  const staffIds = [...new Set(shifts.map((s) => s.staffUserId))];
  const staffMap = new Map<string, string>();
  shifts.forEach((s) => staffMap.set(s.staffUserId, s.staffName));

  const getShiftsForCell = (staffId: string, date: string) =>
    shifts.filter((s) => s.staffUserId === staffId && s.date === date);

  const getCoverageForDay = (date: string) =>
    coverage.find((c) => c.date === date);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1B365D]">
            Staff Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Week of {formatShortDate(weekStart)} &ndash; {formatShortDate(addDays(weekStart, 6))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors min-h-[44px] text-[#1B365D]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {!isCurrentWeek && (
            <button
              onClick={handleThisWeek}
              className="px-4 py-2.5 bg-[#1B365D] text-white text-sm font-medium rounded-lg hover:bg-[#152a4a] transition-colors min-h-[44px]"
            >
              This Week
            </button>
          )}
          <button
            onClick={handleNextWeek}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors min-h-[44px] text-[#1B365D]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => openAddModal()}
            className="px-4 py-2.5 bg-[#62A2C3] text-white text-sm font-medium rounded-lg hover:bg-[#5191b0] transition-colors min-h-[44px] ml-2"
          >
            + Add Shift
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          {error}
        </div>
      )}

      {/* Coverage Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Daily Coverage
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateStr = formatDateISO(day);
            const cov = getCoverageForDay(dateStr);
            const isToday = formatDateISO(new Date()) === dateStr;
            return (
              <div
                key={dateStr}
                className={`text-center p-2 rounded-lg ${
                  isToday ? 'bg-[#62A2C3]/10 border border-[#62A2C3]/30' : 'bg-gray-50'
                }`}
              >
                <div className={`text-xs font-medium ${isToday ? 'text-[#62A2C3]' : 'text-gray-500'}`}>
                  {formatDayName(day)}
                </div>
                <div className="text-lg font-bold text-[#1B365D]">
                  {cov?.staffCount ?? '-'}
                </div>
                <div className="text-xs text-gray-400">
                  {cov ? cov.ratio : '--'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: Week Grid */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-[#1B365D] bg-[#F8F6F3] w-40 sticky left-0 z-10">
                    Staff
                  </th>
                  {weekDays.map((day) => {
                    const dateStr = formatDateISO(day);
                    const isToday = formatDateISO(new Date()) === dateStr;
                    return (
                      <th
                        key={dateStr}
                        className={`text-center px-2 py-3 text-sm font-semibold min-w-[130px] ${
                          isToday
                            ? 'bg-[#62A2C3]/10 text-[#62A2C3]'
                            : 'bg-[#F8F6F3] text-[#1B365D]'
                        }`}
                      >
                        <div>{formatDayName(day)}</div>
                        <div className="text-xs font-normal text-gray-400">
                          {formatShortDate(day)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staffIds.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                      No shifts scheduled for this week
                    </td>
                  </tr>
                ) : (
                  staffIds.map((staffId) => (
                    <tr key={staffId} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#62A2C3]/15 flex items-center justify-center">
                            <span className="text-xs font-semibold text-[#1B365D]">
                              {(staffMap.get(staffId) || '??')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[100px]">
                            {staffMap.get(staffId) || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dateStr = formatDateISO(day);
                        const cellShifts = getShiftsForCell(staffId, dateStr);
                        const isToday = formatDateISO(new Date()) === dateStr;
                        return (
                          <td
                            key={dateStr}
                            className={`px-2 py-2 align-top ${isToday ? 'bg-[#62A2C3]/5' : ''}`}
                          >
                            {cellShifts.length > 0 ? (
                              <div className="space-y-1">
                                {cellShifts.map((shift) => (
                                  <div key={shift.id}>
                                    <button
                                      onClick={() => openEditModal(shift)}
                                      className="w-full text-left px-2 py-1.5 rounded-md bg-[#1B365D]/8 hover:bg-[#1B365D]/15 transition-colors group"
                                    >
                                      <div className="text-xs font-medium text-[#1B365D]">
                                        {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                                      </div>
                                      <div className="text-xs text-gray-400 capitalize">
                                        {shift.role}
                                      </div>
                                    </button>
                                    {shift.breaks?.length > 0 && (
                                      <div className="mt-0.5 space-y-0.5">
                                        {shift.breaks.map((b) => (
                                          <div key={b.id} className="flex items-center gap-1 px-2 text-[10px] text-gray-400">
                                            <span className="capitalize">{b.type}</span>
                                            <span>{formatTime(b.startTime)}-{formatTime(b.endTime)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <button
                                onClick={() => openAddModal(dateStr)}
                                className="w-full h-12 rounded-md border border-dashed border-gray-200 hover:border-[#62A2C3] hover:bg-[#62A2C3]/5 transition-colors flex items-center justify-center"
                              >
                                <svg
                                  className="w-4 h-4 text-gray-300"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile: Day View */}
      <div className="lg:hidden">
        {/* Day selector */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
          {weekDays.map((day, i) => {
            const dateStr = formatDateISO(day);
            const isToday = formatDateISO(new Date()) === dateStr;
            const dayShiftCount = shifts.filter((s) => s.date === dateStr).length;
            return (
              <button
                key={dateStr}
                onClick={() => setMobileSelectedDay(i)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg min-w-[52px] min-h-[44px] transition-colors ${
                  mobileSelectedDay === i
                    ? 'bg-[#1B365D] text-white'
                    : isToday
                    ? 'bg-[#62A2C3]/10 text-[#1B365D] border border-[#62A2C3]/30'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <span className="text-xs font-medium">{formatDayName(day)}</span>
                <span className="text-sm font-bold">{day.getDate()}</span>
                {dayShiftCount > 0 && (
                  <span className={`text-xs ${mobileSelectedDay === i ? 'text-white/70' : 'text-gray-400'}`}>
                    {dayShiftCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Day shifts list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#1B365D]">
              {weekDays[mobileSelectedDay].toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <button
              onClick={() => openAddModal(formatDateISO(weekDays[mobileSelectedDay]))}
              className="px-3 py-1.5 text-xs font-medium text-[#62A2C3] border border-[#62A2C3]/30 rounded-lg hover:bg-[#62A2C3]/5 transition-colors min-h-[36px]"
            >
              + Add
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {(() => {
                const dayShifts = shifts.filter(
                  (s) => s.date === formatDateISO(weekDays[mobileSelectedDay])
                );
                if (dayShifts.length === 0) {
                  return (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      No shifts scheduled
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {dayShifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="p-3 rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#62A2C3]/15 flex items-center justify-center">
                              <span className="text-xs font-semibold text-[#1B365D]">
                                {shift.staffName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{shift.staffName}</p>
                              <p className="text-xs text-gray-500 capitalize">{shift.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-sm font-medium text-[#1B365D]">
                                {formatTime(shift.startTime)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatTime(shift.endTime)}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => openEditModal(shift)}
                                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                                title="Edit shift"
                              >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteShift(shift.id)}
                                className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                title="Delete shift"
                              >
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Breaks */}
                        {shift.breaks?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-50 space-y-1">
                            {shift.breaks.map((b) => (
                              <div key={b.id} className="flex items-center justify-between text-xs text-gray-500 pl-12">
                                <span>
                                  <span className="capitalize font-medium">{b.type}</span>
                                  {' '}{formatTime(b.startTime)} - {formatTime(b.endTime)}
                                </span>
                                <button
                                  onClick={() => handleRemoveBreak(b.id)}
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Remove break"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add break inline form */}
                        {showBreakForm === shift.id ? (
                          <div className="mt-2 pt-2 border-t border-gray-50 pl-12">
                            <div className="flex items-end gap-2 flex-wrap">
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-0.5">Type</label>
                                <select
                                  value={breakType}
                                  onChange={(e) => setBreakType(e.target.value)}
                                  className="px-2 py-1.5 border border-gray-200 rounded text-xs min-h-[36px]"
                                >
                                  <option value="lunch">Lunch</option>
                                  <option value="short">Short</option>
                                  <option value="personal">Personal</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-0.5">Start</label>
                                <input
                                  type="time"
                                  value={breakStartTime}
                                  onChange={(e) => setBreakStartTime(e.target.value)}
                                  className="px-2 py-1.5 border border-gray-200 rounded text-xs min-h-[36px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-0.5">End</label>
                                <input
                                  type="time"
                                  value={breakEndTime}
                                  onChange={(e) => setBreakEndTime(e.target.value)}
                                  className="px-2 py-1.5 border border-gray-200 rounded text-xs min-h-[36px]"
                                />
                              </div>
                              <button
                                onClick={() => handleAddBreak(shift.id)}
                                disabled={isBreakSubmitting}
                                className="px-3 py-1.5 bg-[#62A2C3] text-white rounded text-xs font-medium hover:bg-[#5191b0] disabled:opacity-50 min-h-[36px]"
                              >
                                {isBreakSubmitting ? '...' : 'Add'}
                              </button>
                              <button
                                onClick={() => setShowBreakForm(null)}
                                className="px-2 py-1.5 text-gray-500 text-xs min-h-[36px]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 pt-2 border-t border-gray-50">
                            <button
                              onClick={() => setShowBreakForm(shift.id)}
                              className="text-xs text-[#62A2C3] hover:text-[#4F8BA8] font-medium ml-12 min-h-[32px]"
                            >
                              + Add Break
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Available Staff (desktop sidebar info) */}
      <div className="hidden lg:block mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-[#1B365D] mb-3">All Staff Members</h3>
          <div className="flex flex-wrap gap-2">
            {staffList.filter((s) => s.is_active).map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F8F6F3] text-sm text-gray-700"
              >
                <span className="w-2 h-2 rounded-full bg-[#7FB685]" />
                {member.first_name} {member.last_name}
                <span className="text-xs text-gray-400 capitalize">({member.role})</span>
              </span>
            ))}
            {staffList.filter((s) => s.is_active).length === 0 && (
              <span className="text-sm text-gray-400">No active staff members</span>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Shift Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-heading text-xl font-semibold text-[#1B365D] mb-4">
              {editingShift ? 'Edit Shift' : 'Add Shift'}
            </h2>

            {formError && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              {/* Staff select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                <select
                  value={formStaffId}
                  onChange={(e) => setFormStaffId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] min-h-[44px]"
                >
                  <option value="">Select staff...</option>
                  {staffList
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} ({s.role})
                      </option>
                    ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] min-h-[44px]"
                />
              </div>

              {/* Time row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] min-h-[44px]"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] min-h-[44px]"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              {editingShift && (
                <button
                  onClick={() => {
                    handleDeleteShift(editingShift.id);
                    handleCloseModal();
                  }}
                  className="px-4 py-2.5 text-red-600 text-sm font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors min-h-[44px]"
                >
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={handleCloseModal}
                className="px-4 py-2.5 text-gray-600 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#1B365D] text-white text-sm font-medium rounded-lg hover:bg-[#152a4a] disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {isSubmitting ? 'Saving...' : editingShift ? 'Update' : 'Add Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
