import { useState } from 'react';
import { Button, Input, Alert } from './ui';
import { agreementApi } from '../lib/api';

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 19; h++) {
  for (const m of ['00', '30']) {
    if (h === 19 && m === '30') continue;
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const amPm = h >= 12 ? 'PM' : 'AM';
    TIME_OPTIONS.push(`${hour12}:${m} ${amPm}`);
  }
}

interface BoardingIntakeFormProps {
  bookingId: string;
  onSaved?: () => void;
}

export function BoardingIntakeForm({ bookingId, onSaved }: BoardingIntakeFormProps) {
  const [feedingSchedule, setFeedingSchedule] = useState('');
  const [foodType, setFoodType] = useState('');
  const [foodBrand, setFoodBrand] = useState('');
  const [feedingNotes, setFeedingNotes] = useState('');
  const [dropOffTime, setDropOffTime] = useState('');
  const [pickUpTime, setPickUpTime] = useState('');
  const [specialItems, setSpecialItems] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await agreementApi.saveBoardingDetail(bookingId, {
      feedingSchedule: feedingSchedule || undefined,
      foodType: foodType || undefined,
      foodBrand: foodBrand || undefined,
      feedingNotes: feedingNotes || undefined,
      dropOffTime: dropOffTime || undefined,
      pickUpTime: pickUpTime || undefined,
      specialItems: specialItems || undefined,
      emergencyContact: emergencyContact || undefined,
    });

    setSaving(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSaved(true);
      onSaved?.();
    }
  }

  if (saved) {
    return (
      <div className="bg-brand-success/10 border border-brand-success/30 rounded-2xl p-6 text-center">
        <svg className="w-10 h-10 text-brand-success mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="font-heading font-semibold text-brand-forest">Boarding details saved!</p>
        <p className="text-sm text-brand-forest-muted mt-1">
          You can update these anytime before check-in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="font-heading font-semibold text-brand-forest text-lg mb-1">
          Boarding Details
        </h3>
        <p className="text-sm text-brand-forest-muted">
          Help us give your pup the best stay by sharing their routine.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Feeding section */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-body font-semibold text-brand-forest-light uppercase tracking-wider">
          Feeding
        </legend>

        <div>
          <label className="block text-sm font-body text-brand-forest mb-1">Feeding Schedule</label>
          <select
            value={feedingSchedule}
            onChange={(e) => setFeedingSchedule(e.target.value)}
            className="w-full rounded-2xl border border-brand-sand px-4 py-3 text-brand-forest bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]"
          >
            <option value="">Select schedule...</option>
            <option value="once_morning">Once daily (morning)</option>
            <option value="once_evening">Once daily (evening)</option>
            <option value="twice_daily">Twice daily (morning & evening)</option>
            <option value="three_times">Three times daily</option>
            <option value="free_feed">Free feed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-body text-brand-forest mb-1">Food Type</label>
          <select
            value={foodType}
            onChange={(e) => setFoodType(e.target.value)}
            className="w-full rounded-2xl border border-brand-sand px-4 py-3 text-brand-forest bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]"
          >
            <option value="">Select food type...</option>
            <option value="dry_kibble">Dry Kibble</option>
            <option value="wet_canned">Wet / Canned</option>
            <option value="raw">Raw Diet</option>
            <option value="mixed">Mixed (Dry + Wet)</option>
            <option value="home_cooked">Home Cooked</option>
            <option value="other">Other</option>
          </select>
        </div>

        <Input
          value={foodBrand}
          onChange={(e) => setFoodBrand(e.target.value)}
          placeholder="Food brand (e.g., Blue Buffalo)"
        />

        <textarea
          value={feedingNotes}
          onChange={(e) => setFeedingNotes(e.target.value)}
          placeholder="Special feeding instructions (allergies, portion size, etc.)"
          rows={2}
          className="w-full rounded-2xl border border-brand-sand px-4 py-3 text-brand-forest bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm"
        />
      </fieldset>

      {/* Schedule section */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-body font-semibold text-brand-forest-light uppercase tracking-wider">
          Drop-off & Pick-up
        </legend>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-body text-brand-forest mb-1">Drop-off Time</label>
            <select
              value={dropOffTime}
              onChange={(e) => setDropOffTime(e.target.value)}
              className="w-full rounded-2xl border border-brand-sand px-4 py-3 text-brand-forest bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]"
            >
              <option value="">Select time...</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-body text-brand-forest mb-1">Pick-up Time</label>
            <select
              value={pickUpTime}
              onChange={(e) => setPickUpTime(e.target.value)}
              className="w-full rounded-2xl border border-brand-sand px-4 py-3 text-brand-forest bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]"
            >
              <option value="">Select time...</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Additional info */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-body font-semibold text-brand-forest-light uppercase tracking-wider">
          Additional Info
        </legend>

        <textarea
          value={specialItems}
          onChange={(e) => setSpecialItems(e.target.value)}
          placeholder="Special items to bring (favorite toy, blanket, etc.)"
          rows={2}
          className="w-full rounded-2xl border border-brand-sand px-4 py-3 text-brand-forest bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm"
        />

        <Input
          value={emergencyContact}
          onChange={(e) => setEmergencyContact(e.target.value)}
          placeholder="Emergency contact name & phone"
        />
      </fieldset>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        isLoading={saving}
        disabled={saving}
      >
        Save Boarding Details
      </Button>
    </form>
  );
}
