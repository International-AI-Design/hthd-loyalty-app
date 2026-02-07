import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { bookingApi, customerApi } from '../lib/api';
import { Input } from '../components/ui';
import type {
  ServiceType,
  Dog,
  AvailabilityDay,
  GroomingSlot,
  ServiceBundle,
  BundleCalculation,
  Booking,
} from '../lib/api';
import { Button, Alert } from '../components/ui';

type BookingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small', desc: 'Under 25 lbs' },
  { value: 'medium', label: 'Medium', desc: '25-50 lbs' },
  { value: 'large', label: 'Large', desc: '50-100 lbs' },
  { value: 'xl', label: 'XL', desc: '100+ lbs' },
];

export function BookingPage() {
  const { customer: _customer } = useAuth();
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState<BookingStep>(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Service selection
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);

  // Step 2: Dog selection
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [isLoadingDogs, setIsLoadingDogs] = useState(true);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [sizePendingDogId, setSizePendingDogId] = useState<string | null>(null);
  const [updatingSize, setUpdatingSize] = useState(false);

  // Step 3: Date selection
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Step 4: Time selection (grooming only)
  const [groomingSlots, setGroomingSlots] = useState<GroomingSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Step 5: Photo upload (grooming only)
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [groomingPriceRange, setGroomingPriceRange] = useState<{ min: number; max: number } | null>(null);

  // Step 6: Bundle upsell
  const [bundles, setBundles] = useState<ServiceBundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<ServiceBundle | null>(null);
  const [bundleCalc, setBundleCalc] = useState<BundleCalculation | null>(null);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);

  // Step 7: Review & confirm
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Add dog inline
  const [showAddDog, setShowAddDog] = useState(false);
  const [newDogName, setNewDogName] = useState('');
  const [newDogBreed, setNewDogBreed] = useState('');
  const [isAddingDog, setIsAddingDog] = useState(false);

  const isGrooming = selectedService?.name === 'grooming';

  // Load service types on mount
  useEffect(() => {
    const loadServices = async () => {
      const { data, error: err } = await bookingApi.getServiceTypes();
      if (data) {
        setServiceTypes(data.serviceTypes.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
      } else if (err) {
        setError(err);
      }
      setIsLoadingServices(false);
    };
    loadServices();
  }, []);

  // Load dogs on mount
  useEffect(() => {
    const loadDogs = async () => {
      const { data } = await customerApi.getDogs();
      if (data) {
        setDogs(data.dogs);
      }
      setIsLoadingDogs(false);
    };
    loadDogs();
  }, []);

  // Load availability when service and step 3
  const loadAvailability = useCallback(async () => {
    if (!selectedService) return;
    setIsLoadingAvailability(true);
    setError(null);
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data, error: err } = await bookingApi.checkAvailability(selectedService.id, startDate, endDate);
    if (data) {
      setAvailability(data.availability);
    } else if (err) {
      setError(err);
    }
    setIsLoadingAvailability(false);
  }, [selectedService]);

  useEffect(() => {
    if (step === 3) {
      loadAvailability();
    }
  }, [step, loadAvailability]);

  // Load grooming slots when date selected (step 4)
  const loadGroomingSlots = useCallback(async () => {
    if (!selectedDate) return;
    setIsLoadingSlots(true);
    setError(null);
    const { data, error: err } = await bookingApi.getGroomingSlots(selectedDate);
    if (data) {
      setGroomingSlots(data.slots);
    } else if (err) {
      setError(err);
    }
    setIsLoadingSlots(false);
  }, [selectedDate]);

  useEffect(() => {
    if (step === 4 && isGrooming) {
      loadGroomingSlots();
    }
  }, [step, isGrooming, loadGroomingSlots]);

  // Load grooming price range for photo step
  useEffect(() => {
    if (step === 5 && isGrooming && selectedDogIds.length === 1) {
      const dog = dogs.find((d) => d.id === selectedDogIds[0]);
      if (dog?.size_category) {
        bookingApi.getGroomingPriceRange(dog.size_category).then(({ data }) => {
          if (data) {
            setGroomingPriceRange({ min: data.minPriceCents, max: data.maxPriceCents });
          }
        });
      }
    }
  }, [step, isGrooming, selectedDogIds, dogs]);

  // Load bundle suggestions
  useEffect(() => {
    if (step === 6 && selectedService) {
      setIsLoadingBundles(true);
      bookingApi.getBundleSuggestions(selectedService.id).then(({ data }) => {
        if (data && data.bundles.length > 0) {
          setBundles(data.bundles);
        } else {
          setBundles([]);
          // Auto-skip if no bundles
          setStep(7);
        }
        setIsLoadingBundles(false);
      });
    }
  }, [step, selectedService]);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${minutes} ${ampm}`;
  };

  const goNext = () => {
    if (step === 3 && !isGrooming) {
      // Skip time and photo steps for non-grooming
      setStep(6);
    } else if (step === 4 && isGrooming) {
      setStep(5);
    } else {
      setStep((s) => Math.min(s + 1, 7) as BookingStep);
    }
  };

  const goBack = () => {
    if (step === 6 && !isGrooming) {
      setStep(3);
    } else if (step === 5 && isGrooming) {
      setStep(4);
    } else {
      setStep((s) => Math.max(s - 1, 1) as BookingStep);
    }
  };

  const handleServiceSelect = (service: ServiceType) => {
    setSelectedService(service);
    setSelectedDogIds([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setPhotoData(null);
    setSelectedBundle(null);
    setBundleCalc(null);
    setNotes('');
    setError(null);
    goNext();
  };

  const handleDogToggle = (dogId: string) => {
    if (isGrooming) {
      // Grooming: single dog only
      setSelectedDogIds([dogId]);
      // Check if size is needed
      const dog = dogs.find((d) => d.id === dogId);
      if (dog && !dog.size_category) {
        setSizePendingDogId(dogId);
      } else {
        setSizePendingDogId(null);
      }
    } else {
      setSelectedDogIds((prev) =>
        prev.includes(dogId) ? prev.filter((id) => id !== dogId) : [...prev, dogId]
      );
    }
  };

  const handleSizeUpdate = async (dogId: string, size: string) => {
    setUpdatingSize(true);
    setError(null);
    const { data, error: err } = await bookingApi.updateDogSize(dogId, size);
    if (data) {
      setDogs((prev) => prev.map((d) => (d.id === dogId ? { ...d, size_category: size } : d)));
      setSizePendingDogId(null);
    } else if (err) {
      setError(err);
    }
    setUpdatingSize(false);
  };

  const handleDateSelect = (day: AvailabilityDay) => {
    if (!day.available) return;
    setSelectedDate(day.date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (slot: GroomingSlot) => {
    if (!slot.available) return;
    setSelectedTime(slot.startTime);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddDog = async () => {
    if (!newDogName.trim()) return;
    setIsAddingDog(true);
    const { data } = await customerApi.addDog({
      name: newDogName.trim(),
      breed: newDogBreed.trim() || undefined,
    });
    if (data) {
      setDogs((prev) => [...prev, data]);
      setNewDogName('');
      setNewDogBreed('');
      setShowAddDog(false);
    }
    setIsAddingDog(false);
  };

  const handleBundleSelect = async (bundle: ServiceBundle) => {
    setSelectedBundle(bundle);
    const { data } = await bookingApi.calculateBundlePrice(bundle.id, selectedDogIds);
    if (data) {
      setBundleCalc(data);
    }
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || selectedDogIds.length === 0) return;
    setIsSubmitting(true);
    setError(null);

    const { data, error: err } = await bookingApi.createBooking({
      serviceTypeId: selectedService.id,
      dogIds: selectedDogIds,
      date: selectedDate,
      startTime: selectedTime || undefined,
      notes: notes || undefined,
    });

    if (data) {
      // Upload photo if provided (non-blocking — booking is already confirmed)
      if (photoData && selectedDogIds.length === 1) {
        const photoResult = await bookingApi.uploadDogPhoto(data.booking.id, selectedDogIds[0], photoData);
        if (photoResult.error) {
          console.warn('Photo upload failed:', photoResult.error);
          setError('Booking confirmed, but photo upload failed. You can share a photo at your appointment.');
        }
      }
      setConfirmedBooking(data.booking);
    } else if (err) {
      setError(err);
    }
    setIsSubmitting(false);
  };

  // Progress dots
  const totalSteps = isGrooming ? 7 : 5; // non-grooming skips steps 4,5
  const currentStepIndex = isGrooming
    ? step
    : step <= 3
    ? step
    : step === 6
    ? 4
    : 5;

  const renderProgressDots = () => (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: totalSteps }, (_, i) => {
        const dotStep = i + 1;
        return (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              dotStep === currentStepIndex
                ? 'bg-brand-teal w-6 rounded-full'
                : dotStep < currentStepIndex
                ? 'bg-brand-teal/40'
                : 'bg-gray-300'
            }`}
          />
        );
      })}
    </div>
  );

  const renderHeader = () => (
    <header className="bg-white shadow-sm">
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          {step > 1 && !confirmedBooking && (
            <button
              onClick={goBack}
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <svg className="w-6 h-6 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 flex items-center justify-center gap-3">
            <img src="/logo.png" alt="Happy Tail Happy Dog" className="h-8" />
            <h1 className="font-heading text-lg font-bold text-brand-navy">Book Appointment</h1>
          </div>
          {step > 1 && !confirmedBooking && <div className="w-11" />}
        </div>
        {!confirmedBooking && renderProgressDots()}
      </div>
    </header>
  );

  // Success screen
  if (confirmedBooking) {
    return (
      <div className="min-h-screen bg-brand-cream">
        {renderHeader()}
        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="mx-auto w-20 h-20 bg-brand-soft-green/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-brand-soft-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-heading text-2xl font-bold text-brand-navy mb-2">Booking Confirmed!</h2>
            <p className="text-gray-600 mb-6">Your appointment has been submitted.</p>

            <div className="bg-brand-cream rounded-xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Service</span>
                <span className="font-semibold text-brand-navy">{confirmedBooking.serviceType.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date</span>
                <span className="font-semibold text-brand-navy">{formatDate(confirmedBooking.date)}</span>
              </div>
              {confirmedBooking.startTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Time</span>
                  <span className="font-semibold text-brand-navy">{formatTime(confirmedBooking.startTime)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Dogs</span>
                <span className="font-semibold text-brand-navy">
                  {confirmedBooking.dogs.map((bd) => bd.dog.name).join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 capitalize">
                  {confirmedBooking.status}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => navigate(`/checkout/${confirmedBooking.id}`, { state: { booking: confirmedBooking } })}>
                Pay Now
              </Button>
              <Button variant="outline" className="w-full" size="lg" onClick={() => navigate('/bookings')}>
                View My Bookings
              </Button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full text-center text-sm text-brand-teal font-medium hover:underline py-2 min-h-[44px]"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      {renderHeader()}
      <main className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Step 1: Select Service */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-brand-navy">Choose a Service</h2>
            {isLoadingServices ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-teal" />
              </div>
            ) : (
              <div className="space-y-3">
                {serviceTypes.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="w-full bg-white rounded-2xl shadow-md p-5 text-left hover:shadow-lg hover:ring-2 hover:ring-brand-teal transition-all min-h-[88px]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-heading text-lg font-bold text-brand-navy">
                          {service.displayName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      </div>
                      <div className="ml-4 text-right flex-shrink-0">
                        <p className="text-xl font-bold text-brand-teal">
                          {service.name === 'grooming'
                            ? `From ${formatPrice(service.basePriceCents)}+`
                            : formatPrice(service.basePriceCents)}
                        </p>
                        {service.durationMinutes && (
                          <p className="text-xs text-gray-500">{service.durationMinutes} min</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Dogs */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-brand-navy">
              {isGrooming ? 'Select Your Dog' : 'Select Your Dogs'}
            </h2>
            {isGrooming && (
              <p className="text-sm text-gray-600">Grooming appointments are for one dog at a time.</p>
            )}
            {isLoadingDogs ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-teal" />
              </div>
            ) : dogs.length === 0 && !showAddDog ? (
              <div className="text-center py-12 text-gray-500">
                <p>No dogs on your profile yet.</p>
                <Button className="mt-4" onClick={() => setShowAddDog(true)}>
                  Add Your Dog
                </Button>
              </div>
            ) : showAddDog && dogs.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-md p-5 space-y-4">
                <h3 className="font-semibold text-brand-navy">Add Your Dog</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input
                    value={newDogName}
                    onChange={(e) => setNewDogName(e.target.value)}
                    placeholder="Dog's name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Breed (optional)</label>
                  <Input
                    value={newDogBreed}
                    onChange={(e) => setNewDogBreed(e.target.value)}
                    placeholder="e.g., Golden Retriever"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAddDog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddDog}
                    disabled={!newDogName.trim() || isAddingDog}
                    isLoading={isAddingDog}
                  >
                    Add Dog
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {dogs.map((dog) => {
                  const isSelected = selectedDogIds.includes(dog.id);
                  const needsSize = isGrooming && isSelected && !dog.size_category;
                  return (
                    <div key={dog.id}>
                      <button
                        onClick={() => handleDogToggle(dog.id)}
                        className={`w-full rounded-2xl p-4 text-left transition-all min-h-[68px] ${
                          isSelected
                            ? 'bg-brand-teal/10 ring-2 ring-brand-teal shadow-md'
                            : 'bg-white shadow-md hover:shadow-lg'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                              isSelected ? 'bg-brand-teal' : 'bg-gray-300'
                            }`}
                          >
                            {dog.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-brand-navy">{dog.name}</p>
                            {dog.breed && <p className="text-sm text-gray-500">{dog.breed}</p>}
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-brand-teal bg-brand-teal' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Inline size selector for grooming */}
                      {needsSize && sizePendingDogId === dog.id && (
                        <div className="mt-2 bg-white rounded-xl p-4 shadow-md">
                          <p className="text-sm font-medium text-brand-navy mb-3">
                            What size is {dog.name}?
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {SIZE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => handleSizeUpdate(dog.id, opt.value)}
                                disabled={updatingSize}
                                className="py-3 px-3 rounded-xl border-2 border-gray-200 hover:border-brand-teal hover:bg-brand-teal/5 transition-all text-center min-h-[44px]"
                              >
                                <p className="font-semibold text-brand-navy text-sm">{opt.label}</p>
                                <p className="text-xs text-gray-500">{opt.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add another dog */}
                {!showAddDog ? (
                  <button
                    onClick={() => setShowAddDog(true)}
                    className="w-full text-sm text-brand-teal hover:text-brand-teal-dark font-medium py-2"
                  >
                    + Add another dog
                  </button>
                ) : (
                  <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
                    <h3 className="font-semibold text-brand-navy text-sm">Add a Dog</h3>
                    <Input
                      value={newDogName}
                      onChange={(e) => setNewDogName(e.target.value)}
                      placeholder="Dog's name"
                    />
                    <Input
                      value={newDogBreed}
                      onChange={(e) => setNewDogBreed(e.target.value)}
                      placeholder="Breed (optional)"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" size="sm" onClick={() => { setShowAddDog(false); setNewDogName(''); setNewDogBreed(''); }}>
                        Cancel
                      </Button>
                      <Button className="flex-1" size="sm" onClick={handleAddDog} disabled={!newDogName.trim() || isAddingDog} isLoading={isAddingDog}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full mt-4"
                  size="lg"
                  onClick={goNext}
                  disabled={selectedDogIds.length === 0 || sizePendingDogId !== null}
                >
                  Continue
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Select Date */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-brand-navy">Pick a Date</h2>
            {isLoadingAvailability ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-teal" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {availability.map((day) => {
                    const date = new Date(day.date + 'T00:00:00');
                    const isSelected = selectedDate === day.date;
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayNum = date.getDate();
                    const monthName = date.toLocaleDateString('en-US', { month: 'short' });

                    return (
                      <button
                        key={day.date}
                        onClick={() => handleDateSelect(day)}
                        disabled={!day.available}
                        className={`rounded-xl p-3 text-center transition-all min-h-[72px] ${
                          isSelected
                            ? 'bg-brand-teal text-white shadow-md'
                            : day.available
                            ? 'bg-white hover:ring-2 hover:ring-brand-teal shadow-sm'
                            : 'bg-gray-100 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                          {dayName}
                        </p>
                        <p className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-brand-navy'}`}>
                          {dayNum}
                        </p>
                        <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                          {monthName}
                        </p>
                        {day.available && (
                          <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${isSelected ? 'bg-white' : 'bg-brand-soft-green'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={goNext}
                  disabled={!selectedDate}
                >
                  Continue
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step 4: Select Time (grooming only) */}
        {step === 4 && isGrooming && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-brand-navy">Pick a Time</h2>
            <p className="text-sm text-gray-600">
              {selectedDate && formatDate(selectedDate)}
            </p>
            {isLoadingSlots ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-teal" />
              </div>
            ) : groomingSlots.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No available slots for this date.</p>
                <Button variant="outline" className="mt-4" onClick={goBack}>
                  Pick a different date
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {groomingSlots.map((slot) => {
                    const isSelected = selectedTime === slot.startTime;
                    return (
                      <button
                        key={slot.startTime}
                        onClick={() => handleTimeSelect(slot)}
                        disabled={!slot.available}
                        className={`rounded-xl p-4 text-center transition-all min-h-[56px] ${
                          isSelected
                            ? 'bg-brand-teal text-white shadow-md'
                            : slot.available
                            ? 'bg-white hover:ring-2 hover:ring-brand-teal shadow-sm'
                            : 'bg-gray-100 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <p className={`font-semibold ${isSelected ? 'text-white' : 'text-brand-navy'}`}>
                          {formatTime(slot.startTime)}
                        </p>
                        <p className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                          {slot.spotsRemaining} spot{slot.spotsRemaining !== 1 ? 's' : ''} left
                        </p>
                      </button>
                    );
                  })}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={goNext}
                  disabled={!selectedTime}
                >
                  Continue
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step 5: Photo Upload (grooming only, skippable) */}
        {step === 5 && isGrooming && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-brand-navy">Coat Condition Photo</h2>
            <p className="text-sm text-gray-600">
              Upload a photo of your dog's coat to help us prepare for the appointment. This is optional.
            </p>

            {groomingPriceRange && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-600">
                  Grooming price range for your dog's size:
                </p>
                <p className="text-lg font-bold text-brand-navy">
                  {formatPrice(groomingPriceRange.min)} - {formatPrice(groomingPriceRange.max)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Final price depends on coat condition and services needed.
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-md p-6">
              {photoData ? (
                <div className="space-y-3">
                  <img
                    src={photoData}
                    alt="Dog coat photo"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <button
                    onClick={() => setPhotoData(null)}
                    className="text-sm text-brand-coral hover:underline"
                  >
                    Remove photo
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-8 cursor-pointer border-2 border-dashed border-gray-300 rounded-xl hover:border-brand-teal transition-colors min-h-[120px]">
                  <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm text-gray-600">Tap to take or upload a photo</p>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                size="lg"
                onClick={goNext}
              >
                Skip
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={goNext}
                disabled={!photoData}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Bundle Upsell */}
        {step === 6 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-brand-navy">Save with a Bundle</h2>
            {isLoadingBundles ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-teal" />
              </div>
            ) : bundles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No bundle deals available right now.</p>
              </div>
            ) : (
              <>
                {bundles.map((bundle) => {
                  const isSelected = selectedBundle?.id === bundle.id;
                  return (
                    <button
                      key={bundle.id}
                      onClick={() => handleBundleSelect(bundle)}
                      className={`w-full rounded-2xl p-5 text-left transition-all ${
                        isSelected
                          ? 'bg-brand-golden-yellow/10 ring-2 ring-brand-golden-yellow shadow-md'
                          : 'bg-white shadow-md hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-brand-navy">{bundle.name}</h3>
                          {bundle.description && (
                            <p className="text-sm text-gray-600 mt-1">{bundle.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {bundle.items.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-brand-cream text-brand-navy"
                              >
                                {item.serviceType.displayName}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-brand-golden-yellow/20 text-brand-navy">
                            {bundle.discountType === 'percentage'
                              ? `${bundle.discountValue}% off`
                              : `${formatPrice(bundle.discountValue)} off`}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {bundleCalc && selectedBundle && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Base total</span>
                      <span className="text-gray-600">{formatPrice(bundleCalc.baseTotalCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-brand-soft-green mt-1">
                      <span>Bundle savings</span>
                      <span>-{formatPrice(bundleCalc.discountCents)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-brand-navy mt-2 pt-2 border-t">
                      <span>Total</span>
                      <span>{formatPrice(bundleCalc.finalTotalCents)}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="lg"
                    onClick={() => {
                      setSelectedBundle(null);
                      setBundleCalc(null);
                      setStep(7);
                    }}
                  >
                    No Thanks
                  </Button>
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() => setStep(7)}
                    disabled={!selectedBundle}
                  >
                    Add Bundle
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 7: Review & Confirm */}
        {step === 7 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-brand-navy">Review & Confirm</h2>

            <div className="bg-white rounded-2xl shadow-md p-5 space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Service</span>
                <span className="font-semibold text-brand-navy">{selectedService?.displayName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Dog{selectedDogIds.length > 1 ? 's' : ''}</span>
                <span className="font-semibold text-brand-navy">
                  {selectedDogIds.map((id) => dogs.find((d) => d.id === id)?.name).filter(Boolean).join(', ')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Date</span>
                <span className="font-semibold text-brand-navy">
                  {selectedDate && formatDate(selectedDate)}
                </span>
              </div>
              {selectedTime && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Time</span>
                  <span className="font-semibold text-brand-navy">{formatTime(selectedTime)}</span>
                </div>
              )}
              {selectedBundle && bundleCalc && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Bundle</span>
                  <span className="font-semibold text-brand-soft-green">{selectedBundle.name}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Estimated Total</span>
                <span className="text-xl font-bold text-brand-navy">
                  {bundleCalc
                    ? formatPrice(bundleCalc.finalTotalCents)
                    : selectedService
                    ? formatPrice(selectedService.basePriceCents * selectedDogIds.length)
                    : '--'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes for the team (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-brand-teal focus:border-transparent resize-none"
                placeholder="Any special requests or things we should know..."
              />
            </div>

            {photoData && (
              <div className="bg-white rounded-2xl shadow-md p-5">
                <p className="text-sm font-medium text-gray-700 mb-2">Coat Photo</p>
                <img
                  src={photoData}
                  alt="Coat condition"
                  className="w-full h-32 object-cover rounded-xl"
                />
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              Confirm Booking
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
