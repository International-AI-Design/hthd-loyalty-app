import type { Dog } from '../lib/api';
import type { ServiceOption } from './ServiceSelector';
import { Button } from './ui';

interface BookingSummaryProps {
  service: ServiceOption | null;
  dogs: Dog[];
  selectedDogIds: string[];
  startDate: string | null;
  endDate: string | null;
  onProceedToCheckout: () => void;
  isSubmitting: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getNumberOfNights(start: string, end: string): number {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getNumberOfDays(start: string, end: string): number {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const diff = endDate.getTime() - startDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

const SERVICE_PRICES: Record<string, number> = {
  'daycare-half': 37,
  'daycare-full': 47,
  boarding: 69,
  grooming: 95,
  walking: 0,
  hiking: 0,
};

export function BookingSummary({
  service,
  dogs,
  selectedDogIds,
  startDate,
  endDate,
  onProceedToCheckout,
  isSubmitting,
}: BookingSummaryProps) {
  const selectedDogs = dogs.filter((d) => selectedDogIds.includes(d.id));
  const pricePerUnit = service ? (SERVICE_PRICES[service.id] || 0) : 0;
  const isBoarding = service?.name === 'boarding';
  const isDaycare = service?.name === 'daycare';

  let unitCount = 1;
  let unitLabel = 'session';

  if (startDate && endDate) {
    if (isBoarding) {
      unitCount = getNumberOfNights(startDate, endDate);
      unitLabel = unitCount === 1 ? 'night' : 'nights';
    } else if (isDaycare) {
      unitCount = getNumberOfDays(startDate, endDate);
      unitLabel = unitCount === 1 ? 'day' : 'days';
    }
  } else if (startDate) {
    unitCount = 1;
    unitLabel = isBoarding ? 'night' : 'day';
  }

  const lineItems: { label: string; amount: number }[] = [];

  if (service && pricePerUnit > 0) {
    selectedDogs.forEach((dog) => {
      lineItems.push({
        label: `${service.displayName} x ${unitCount} ${unitLabel} - ${dog.name}`,
        amount: pricePerUnit * unitCount,
      });
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-4">
      {/* Booking Details */}
      <div className="bg-white rounded-2xl shadow-md p-5 space-y-3">
        <h3 className="font-heading text-lg font-bold text-brand-navy">Booking Summary</h3>

        {service && (
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Service</span>
            <span className="font-semibold text-brand-navy">{service.displayName}</span>
          </div>
        )}

        {selectedDogs.length > 0 && (
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Dog{selectedDogs.length > 1 ? 's' : ''}</span>
            <span className="font-semibold text-brand-navy">
              {selectedDogs.map((d) => d.name).join(', ')}
            </span>
          </div>
        )}

        {startDate && (
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">{endDate ? 'Check-in' : 'Date'}</span>
            <span className="font-semibold text-brand-navy">{formatDate(startDate)}</span>
          </div>
        )}

        {endDate && endDate !== startDate && (
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Check-out</span>
            <span className="font-semibold text-brand-navy">{formatDate(endDate)}</span>
          </div>
        )}

        {(isBoarding || isDaycare) && startDate && endDate && (
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Duration</span>
            <span className="font-semibold text-brand-navy">
              {unitCount} {unitLabel}
            </span>
          </div>
        )}
      </div>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="font-heading text-base font-bold text-brand-navy mb-3">Price Estimate</h3>
          <div className="space-y-2">
            {lineItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.label}</span>
                <span className="font-medium text-brand-navy">${item.amount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 mt-3 border-t border-gray-200">
              <span className="font-bold text-brand-navy">Estimated Total</span>
              <span className="text-xl font-bold text-brand-navy">${subtotal.toFixed(2)}</span>
            </div>
          </div>
          {pricePerUnit === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Price will be confirmed after your request is reviewed.
            </p>
          )}
        </div>
      )}

      {/* CTA */}
      <Button
        className="w-full"
        size="lg"
        onClick={onProceedToCheckout}
        isLoading={isSubmitting}
        disabled={!service || selectedDogIds.length === 0 || !startDate}
      >
        Proceed to Checkout
      </Button>
    </div>
  );
}
