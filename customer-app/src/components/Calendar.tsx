import { useState, useRef, useCallback, useEffect } from 'react';
import type { DateAvailability } from '../lib/api';

type SelectionMode = 'range' | 'multi';

interface CalendarProps {
  availability: Record<string, DateAvailability>;
  startDate: string | null;
  endDate: string | null;
  selectedDates?: string[];
  selectionMode?: SelectionMode;
  onDateSelect: (date: string) => void;
  isLoading: boolean;
  onMonthChange: (year: number, month: number) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getAvailabilityStatus(
  dateKey: string,
  availability: Record<string, DateAvailability>
): 'available' | 'limited' | 'full' | 'unknown' {
  const data = availability[dateKey];
  if (!data) return 'unknown';
  if (data.available <= 0) return 'full';
  const usage = (data.capacity - data.available) / data.capacity;
  if (usage > 0.75) return 'limited';
  return 'available';
}

function isDateInRange(dateKey: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  return dateKey >= start && dateKey <= end;
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
}

function isPast(year: number, month: number, day: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(year, month, day);
  return check < today;
}

export function Calendar({
  availability,
  startDate,
  endDate,
  selectedDates = [],
  selectionMode = 'range',
  onDateSelect,
  isLoading,
  onMonthChange,
}: CalendarProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const goToPrevMonth = useCallback(() => {
    const now = new Date();
    if (currentYear === now.getFullYear() && currentMonth === now.getMonth()) return;
    let newMonth = currentMonth - 1;
    let newYear = currentYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    onMonthChange(newYear, newMonth);
  }, [currentYear, currentMonth, onMonthChange]);

  const goToNextMonth = useCallback(() => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    const nextMonth = currentMonth + 1 > 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth + 1 > 11 ? currentYear + 1 : currentYear;
    if (new Date(nextYear, nextMonth) > maxDate) return;
    setCurrentMonth(nextMonth);
    setCurrentYear(nextYear);
    onMonthChange(nextYear, nextMonth);
  }, [currentYear, currentMonth, onMonthChange]);

  const canGoPrev = !(currentYear === today.getFullYear() && currentMonth === today.getMonth());
  const maxFutureDate = new Date();
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 3);
  const nextMonthDate = new Date(
    currentMonth + 1 > 11 ? currentYear + 1 : currentYear,
    currentMonth + 1 > 11 ? 0 : currentMonth + 1
  );
  const canGoNext = nextMonthDate <= maxFutureDate;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNextMonth();
      else goToPrevMonth();
    }
    touchStartX.current = null;
  };

  useEffect(() => {
    onMonthChange(currentYear, currentMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderDayCell = (day: number) => {
    const dateKey = formatDateKey(currentYear, currentMonth, day);
    const past = isPast(currentYear, currentMonth, day);
    const todayCell = isToday(currentYear, currentMonth, day);
    const status = getAvailabilityStatus(dateKey, availability);
    const disabled = past || status === 'full';

    // Determine selection state based on mode
    let isSelected = false;
    let inRange = false;

    if (selectionMode === 'multi') {
      isSelected = selectedDates.includes(dateKey);
    } else {
      // range mode
      const isStart = dateKey === startDate;
      const isEnd = dateKey === endDate;
      isSelected = isStart || isEnd;
      inRange = isDateInRange(dateKey, startDate, endDate);
    }

    let bgClass = '';
    let textClass = 'text-brand-navy';
    let dotClass = '';

    if (isSelected) {
      bgClass = 'bg-brand-blue shadow-md';
      textClass = 'text-white';
    } else if (inRange) {
      bgClass = 'bg-brand-blue/15';
    } else if (past) {
      textClass = 'text-gray-300';
    }

    if (!isSelected && !past) {
      switch (status) {
        case 'available':
          dotClass = 'bg-brand-soft-green';
          break;
        case 'limited':
          dotClass = 'bg-brand-golden-yellow';
          break;
        case 'full':
          dotClass = 'bg-brand-coral';
          textClass = 'text-gray-400';
          break;
        default:
          dotClass = '';
      }
    }

    return (
      <button
        key={day}
        onClick={() => !disabled && onDateSelect(dateKey)}
        disabled={disabled}
        className={`relative flex flex-col items-center justify-center rounded-xl min-h-[48px] min-w-[44px] transition-all duration-150 ${bgClass} ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-brand-blue/10 active:scale-95'} ${todayCell && !isSelected ? 'ring-2 ring-brand-blue/40' : ''}`}
        aria-label={`${new Date(currentYear, currentMonth, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${isSelected ? ' (selected)' : ''}${status === 'full' ? ' (full)' : ''}`}
      >
        <span className={`text-sm font-semibold ${textClass}`}>{day}</span>
        {dotClass && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dotClass}`} />}
      </button>
    );
  };

  // Hint text based on selection mode
  const renderHint = () => {
    if (selectionMode === 'multi') {
      if (selectedDates.length === 0) {
        return <p className="text-center text-xs text-gray-400 mt-2">Tap dates to select days (tap again to deselect)</p>;
      }
      return (
        <p className="text-center text-xs text-gray-400 mt-2">
          {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
        </p>
      );
    }
    // range mode
    if (!startDate) {
      return <p className="text-center text-xs text-gray-400 mt-2">Tap a date to select your start date</p>;
    }
    if (startDate && !endDate) {
      return <p className="text-center text-xs text-gray-400 mt-2">Tap another date to select your end date</p>;
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-2xl shadow-md p-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          disabled={!canGoPrev}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-heading text-lg font-bold text-brand-navy">{monthLabel}</h3>
        <button
          onClick={goToNextMonth}
          disabled={!canGoNext}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <svg className="w-5 h-5 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="min-h-[48px]" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => renderDayCell(i + 1))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-soft-green" />
          <span className="text-xs text-gray-500">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-golden-yellow" />
          <span className="text-xs text-gray-500">Limited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-coral" />
          <span className="text-xs text-gray-500">Full</span>
        </div>
      </div>

      {/* Selection Hint */}
      {renderHint()}
    </div>
  );
}
