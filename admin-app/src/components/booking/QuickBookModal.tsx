import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import {
  adminCustomersApi,
  adminCustomersListApi,
  adminBookingApi,
  type CustomerSearchResult,
  type CustomerDog,
  type ServiceType,
  type AvailabilityDay,
} from '../../lib/api';

interface QuickBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated?: () => void;
}

type Step = 'search' | 'dogs' | 'service' | 'date' | 'confirm';

const stepLabels: Record<Step, string> = {
  search: 'Find Customer',
  dogs: 'Select Dogs',
  service: 'Choose Service',
  date: 'Pick Date',
  confirm: 'Confirm Booking',
};

const stepNumbers: Step[] = ['search', 'dogs', 'service', 'date', 'confirm'];

function formatDate(dateStr: string): string {
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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function QuickBookModal({ isOpen, onClose, onBookingCreated }: QuickBookModalProps) {
  const [step, setStep] = useState<Step>('search');

  // Step 1: Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

  // Step 2: Dogs
  const [customerDogs, setCustomerDogs] = useState<CustomerDog[]>([]);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [isLoadingDogs, setIsLoadingDogs] = useState(false);

  // Step 3: Service
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // Step 4: Date
  const [selectedDate, setSelectedDate] = useState('');
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  // Step 5: Confirm
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('search');
        setSearchQuery('');
        setSearchResults([]);
        setSelectedCustomer(null);
        setCustomerDogs([]);
        setSelectedDogIds([]);
        setSelectedService(null);
        setSelectedDate('');
        setAvailability([]);
        setNotes('');
        setSubmitError(null);
        setBookingSuccess(false);
      }, 200);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const result = await adminCustomersApi.search(searchQuery);
      setIsSearching(false);
      if (result.data) {
        setSearchResults(result.data.customers || []);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load dogs when customer is selected
  const loadCustomerDogs = useCallback(async (customerId: string) => {
    setIsLoadingDogs(true);
    const result = await adminCustomersListApi.get(customerId);
    setIsLoadingDogs(false);
    if (result.data) {
      setCustomerDogs(result.data.dogs || []);
    }
  }, []);

  // Load service types
  const loadServiceTypes = useCallback(async () => {
    setIsLoadingServices(true);
    const result = await adminBookingApi.getServiceTypes();
    setIsLoadingServices(false);
    if (result.data) {
      setServiceTypes(result.data.serviceTypes || []);
    }
  }, []);

  // Check availability when date changes
  const checkAvailability = useCallback(async (serviceTypeId: string, date: string) => {
    setIsCheckingAvailability(true);
    const result = await adminBookingApi.checkAvailability(serviceTypeId, date, date);
    setIsCheckingAvailability(false);
    if (result.data) {
      setAvailability(result.data.availability || []);
    }
  }, []);

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    loadCustomerDogs(customer.id);
    setStep('dogs');
  };

  const toggleDog = (dogId: string) => {
    setSelectedDogIds((prev) =>
      prev.includes(dogId) ? prev.filter((id) => id !== dogId) : [...prev, dogId]
    );
  };

  const handleDogsNext = () => {
    loadServiceTypes();
    setStep('service');
  };

  const handleSelectService = (service: ServiceType) => {
    setSelectedService(service);
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];
    setSelectedDate(defaultDate);
    checkAvailability(service.id, defaultDate);
    setStep('date');
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (selectedService) {
      checkAvailability(selectedService.id, date);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedService || !selectedDate || selectedDogIds.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await adminBookingApi.create({
      customerId: selectedCustomer.id,
      serviceTypeId: selectedService.id,
      dogIds: selectedDogIds,
      date: selectedDate,
      notes: notes || undefined,
    });

    setIsSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
    } else {
      setBookingSuccess(true);
      onBookingCreated?.();
    }
  };

  const isDateAvailable = availability.length > 0 && availability[0]?.available;

  const currentStepIndex = stepNumbers.indexOf(step);

  // Service icon mapping
  const serviceIcons: Record<string, JSX.Element> = {
    daycare: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    boarding: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
    grooming: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243z" />
      </svg>
    ),
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Header with step indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg font-semibold text-[#1B365D]">New Booking</h2>
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

        {/* Step progress */}
        {!bookingSuccess && (
          <div className="flex items-center gap-1">
            {stepNumbers.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`h-1 w-full rounded-full transition-colors ${
                    i <= currentStepIndex ? 'bg-[#62A2C3]' : 'bg-gray-200'
                  }`}
                />
              </div>
            ))}
          </div>
        )}
        {!bookingSuccess && (
          <p className="text-xs text-gray-400 mt-1.5">
            Step {currentStepIndex + 1} of {stepNumbers.length}: {stepLabels[step]}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="border-b border-gray-100 -mx-4 mb-4" />

      {/* Success state */}
      {bookingSuccess && (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-[#7FB685]/15 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-[#7FB685]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-heading text-lg font-semibold text-[#1B365D] mb-1">Booking Created</h3>
          <p className="text-sm text-gray-500 mb-4">
            {selectedService?.displayName} for {selectedCustomer?.name} on {formatDate(selectedDate)}
          </p>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      )}

      {/* Step 1: Search Customer */}
      {step === 'search' && !bookingSuccess && (
        <div>
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or email..."
              className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] min-h-[44px]"
              autoFocus
            />
          </div>

          {isSearching && <Skeleton variant="text" lines={3} />}

          {!isSearching && searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {searchResults.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-[#62A2C3]/30 hover:bg-[#62A2C3]/[0.03] transition-all text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1B365D]">{customer.name}</p>
                    <p className="text-xs text-gray-500">{customer.phone || customer.email}</p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F5C65D]/20">
                    <span className="text-xs font-medium text-[#B8941F]">
                      {customer.points_balance} pts
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">No customers found</p>
          )}

          {searchQuery.length < 2 && (
            <p className="text-center text-sm text-gray-400 py-6">
              Type at least 2 characters to search
            </p>
          )}
        </div>
      )}

      {/* Step 2: Select Dogs */}
      {step === 'dogs' && !bookingSuccess && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Select dogs for <span className="font-medium text-[#1B365D]">{selectedCustomer?.name}</span>
          </p>

          {isLoadingDogs && <Skeleton variant="text" lines={3} />}

          {!isLoadingDogs && customerDogs.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">No dogs on file for this customer</p>
          )}

          {!isLoadingDogs && customerDogs.length > 0 && (
            <div className="space-y-2 mb-4">
              {customerDogs.map((dog) => (
                <button
                  key={dog.id}
                  onClick={() => toggleDog(dog.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    selectedDogIds.includes(dog.id)
                      ? 'border-[#62A2C3] bg-[#62A2C3]/5 ring-1 ring-[#62A2C3]'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedDogIds.includes(dog.id)
                        ? 'border-[#62A2C3] bg-[#62A2C3]'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedDogIds.includes(dog.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B365D]">{dog.name}</p>
                    <p className="text-xs text-gray-500">
                      {[dog.breed, dog.size_category].filter(Boolean).join(' \u00B7 ')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep('search')} className="flex-1">
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleDogsNext}
              disabled={selectedDogIds.length === 0}
              className="flex-1"
            >
              Next ({selectedDogIds.length} selected)
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Select Service */}
      {step === 'service' && !bookingSuccess && (
        <div>
          <p className="text-sm text-gray-500 mb-3">Choose a service type</p>

          {isLoadingServices && <Skeleton variant="text" lines={3} />}

          {!isLoadingServices && (
            <div className="grid grid-cols-1 gap-2 mb-4">
              {serviceTypes.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleSelectService(service)}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-100 hover:border-[#62A2C3]/30 hover:bg-[#62A2C3]/[0.03] transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#62A2C3]/10 flex items-center justify-center text-[#62A2C3] group-hover:bg-[#62A2C3]/20 transition-colors flex-shrink-0">
                    {serviceIcons[service.name] || (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1B365D]">{service.displayName}</p>
                    <p className="text-xs text-gray-500">
                      From {formatCents(service.basePriceCents)}/dog
                      {service.durationMinutes ? ` \u00B7 ${service.durationMinutes} min` : ''}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-[#62A2C3] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => setStep('dogs')} className="w-full">
            Back
          </Button>
        </div>
      )}

      {/* Step 4: Select Date */}
      {step === 'date' && !bookingSuccess && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Pick a date for <span className="font-medium text-[#1B365D]">{selectedService?.displayName}</span>
          </p>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] min-h-[44px] mb-3"
          />

          {/* Availability indicator */}
          {isCheckingAvailability && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
              Checking availability...
            </div>
          )}

          {!isCheckingAvailability && availability.length > 0 && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm ${
                isDateAvailable
                  ? 'bg-[#7FB685]/10 text-[#5A9A62]'
                  : 'bg-[#E8837B]/10 text-[#E8837B]'
              }`}
            >
              {isDateAvailable ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {availability[0].spotsRemaining} spot{availability[0].spotsRemaining !== 1 ? 's' : ''} available
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  No availability on this date
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep('service')} className="flex-1">
              Back
            </Button>
            <Button
              size="sm"
              onClick={() => setStep('confirm')}
              disabled={!selectedDate || !isDateAvailable}
              className="flex-1"
            >
              Review Booking
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Confirm */}
      {step === 'confirm' && !bookingSuccess && (
        <div>
          {/* Summary */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F6F3]">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Customer</span>
              <span className="text-sm font-medium text-[#1B365D]">{selectedCustomer?.name}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F6F3]">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Dogs</span>
              <span className="text-sm font-medium text-[#1B365D]">
                {customerDogs
                  .filter((d) => selectedDogIds.includes(d.id))
                  .map((d) => d.name)
                  .join(', ')}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F6F3]">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Service</span>
              <span className="text-sm font-medium text-[#1B365D]">{selectedService?.displayName}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F6F3]">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Date</span>
              <span className="text-sm font-medium text-[#1B365D]">{formatDate(selectedDate)}</span>
            </div>
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes (optional)..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3] mb-4 resize-none"
          />

          {/* Error */}
          {submitError && (
            <div className="mb-3 px-3 py-2 bg-[#E8837B]/10 border border-[#E8837B]/20 rounded-lg text-[#E8837B] text-sm">
              {submitError}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep('date')} className="flex-1">
              Back
            </Button>
            <Button size="sm" onClick={handleSubmit} isLoading={isSubmitting} className="flex-1">
              Create Booking
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
