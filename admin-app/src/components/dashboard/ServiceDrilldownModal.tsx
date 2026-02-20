import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { DogProfileCard } from '../cards/DogProfileCard';
import { adminDashboardApi, type FacilityDetailDog } from '../../lib/api';

interface ServiceDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: 'daycare' | 'boarding' | 'grooming';
  date: string;
}

const serviceLabels: Record<string, string> = {
  daycare: 'Daycare',
  boarding: 'Boarding',
  grooming: 'Grooming',
};

const serviceIcons: Record<string, React.ReactNode> = {
  daycare: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  boarding: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  grooming: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243z" />
    </svg>
  ),
};

function formatDateDisplay(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function ServiceDrilldownModal({ isOpen, onClose, service, date }: ServiceDrilldownModalProps) {
  const [dogs, setDogs] = useState<FacilityDetailDog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    adminDashboardApi.getFacilityDetails(date, service).then((result) => {
      setIsLoading(false);
      if (result.error) {
        setError(result.error);
        setDogs([]);
      } else if (result.data) {
        setDogs(result.data.dogs || []);
      }
    });
  }, [isOpen, date, service]);

  const label = serviceLabels[service] || service;
  const dateDisplay = formatDateDisplay(date);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Custom header with service icon and count */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-[#62A2C3]/10 flex items-center justify-center text-[#62A2C3]">
          {serviceIcons[service]}
        </div>
        <div className="flex-1">
          <h2 className="font-heading text-lg font-semibold text-[#1B365D]">
            {label}
          </h2>
          <p className="text-xs text-gray-500">
            {dateDisplay}
            {!isLoading && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#62A2C3]/10 text-[#4F8BA8] text-xs font-medium">
                {dogs.length} dog{dogs.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="border-b border-gray-100 -mx-4 mb-4" />

      {/* Error */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton variant="circle" />
              <Skeleton variant="text" lines={2} className="flex-1" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && dogs.length === 0 && !error && (
        <EmptyState
          title={`No ${label.toLowerCase()} dogs for this date`}
          description="Check back later or try a different date."
        />
      )}

      {/* Dog list */}
      {!isLoading && dogs.length > 0 && (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto -mx-1 px-1">
          {dogs.map((dog) => (
            <DogProfileCard
              key={dog.dogId}
              dog={{
                id: dog.dogId,
                name: dog.dogName,
                breed: dog.breed,
                sizeCategory: dog.sizeCategory,
                photoUrl: dog.photoUrl,
              }}
              ownerName={dog.ownerName}
              ownerId={dog.ownerId}
              checkInTime={dog.checkInTime}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
