import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dogProfileApi, bookingApi } from '../lib/api';
import type { DogProfile, VaccinationRecord, MedicationRecord, PetIdCard, Booking } from '../lib/api';
import { AppShell } from '../components/AppShell';
import { Button, Modal, Input, Alert } from '../components/ui';
import { PhotoUpload } from '../components/PhotoUpload';
import { VaccinationUpload } from '../components/VaccinationUpload';
import { PetIdCardModal } from '../components/PetIdCardModal';

type Tab = 'profile' | 'appointments' | 'reminders';

interface ComplianceStatus {
  overall: 'current' | 'expiring_soon' | 'expired' | 'unknown';
  vaccinations: Array<{
    name: string;
    status: 'current' | 'expiring_soon' | 'expired';
    expiresAt: string | null;
  }>;
}

const SELECT_CLASS = "w-full px-3 py-2 border border-brand-light-gray rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[44px]";

function InfoRow({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      {href ? (
        <a href={href} className="text-sm font-medium text-brand-blue hover:underline text-right">{value}</a>
      ) : (
        <span className="text-sm font-medium text-brand-navy text-right max-w-[60%]">{value}</span>
      )}
    </div>
  );
}

export function DogProfilePage() {
  const { dogId } = useParams<{ dogId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [dog, setDog] = useState<DogProfile | null>(null);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pet ID Card
  const [idCard, setIdCard] = useState<PetIdCard | null>(null);
  const [isIdCardOpen, setIsIdCardOpen] = useState(false);
  const [isLoadingIdCard, setIsLoadingIdCard] = useState(false);

  // Appointments
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', breed: '', sizeCategory: '', weight: '', temperament: '', color: '',
    allergies: '', specialNeeds: '', socialNotes: '', goodWith: '',
    // Altered
    alteredStatus: '', alteredDate: '',
    // Vet
    vetName: '', vetPhone: '', vetAddress: '', vetEmail: '',
    emergencyVetName: '', emergencyVetPhone: '', emergencyVetCostLimit: '',
    // Feeding
    feedingMethod: '', foodType: '', feedingNotes: '',
    // Emergency agent
    emergencyAgent: '', emergencyAgentRelationship: '', emergencyAgentPhone: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Vaccination modal
  const [isVaxModalOpen, setIsVaxModalOpen] = useState(false);
  const [editingVax, setEditingVax] = useState<VaccinationRecord | null>(null);
  const [vaxForm, setVaxForm] = useState({ name: '', dateGiven: '', expiresAt: '' });
  const [isSavingVax, setIsSavingVax] = useState(false);
  const [vaxError, setVaxError] = useState<string | null>(null);

  // Medication modal
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicationRecord | null>(null);
  const [medForm, setMedForm] = useState({ name: '', dosage: '', frequency: '', startDate: '', endDate: '', notes: '' });
  const [isSavingMed, setIsSavingMed] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'vax' | 'med'; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDog = useCallback(async () => {
    if (!dogId) return;
    const { data, error: fetchErr } = await dogProfileApi.getDog(dogId);
    if (fetchErr) {
      setError(fetchErr);
    } else if (data) {
      const d = data.dog;
      setDog(d);
      setEditForm({
        name: d.name || '', breed: d.breed || '', sizeCategory: d.sizeCategory || '',
        weight: d.weight ? String(d.weight) : '', temperament: d.temperament || '', color: d.color || '',
        allergies: d.allergies || '', specialNeeds: d.specialNeeds || '',
        socialNotes: d.socialNotes || '', goodWith: d.goodWith || '',
        alteredStatus: d.alteredStatus || '', alteredDate: d.alteredDate ? d.alteredDate.split('T')[0] : '',
        vetName: d.vetName || '', vetPhone: d.vetPhone || '',
        vetAddress: d.vetAddress || '', vetEmail: d.vetEmail || '',
        emergencyVetName: d.emergencyVetName || '', emergencyVetPhone: d.emergencyVetPhone || '',
        emergencyVetCostLimit: d.emergencyVetCostLimit ? String(d.emergencyVetCostLimit / 100) : '',
        feedingMethod: d.feedingMethod || '', foodType: d.foodType || '', feedingNotes: d.feedingNotes || '',
        emergencyAgent: d.emergencyAgent || '',
        emergencyAgentRelationship: d.emergencyAgentRelationship || '',
        emergencyAgentPhone: d.emergencyAgentPhone || '',
      });
    }
    setIsLoading(false);
  }, [dogId]);

  const fetchCompliance = useCallback(async () => {
    if (!dogId) return;
    const { data } = await dogProfileApi.getCompliance(dogId);
    if (data) {
      const raw = data as Record<string, unknown>;
      const items = (raw.compliance as Array<Record<string, unknown>>) || [];
      let overall: ComplianceStatus['overall'] = 'unknown';
      if (items.length === 0) overall = 'unknown';
      else if (items.every((c) => c.status === 'compliant')) overall = 'current';
      else if (items.some((c) => c.status === 'expired' || c.status === 'missing')) overall = 'expired';
      else overall = 'expiring_soon';
      setCompliance({
        overall,
        vaccinations: items.map((c) => ({
          name: (c.requirement as string) || 'Unknown',
          status: c.status === 'compliant' ? 'current' as const : 'expired' as const,
          expiresAt: (c.expiresAt as string) || null,
        })),
      });
    }
  }, [dogId]);

  const fetchBookings = useCallback(async () => {
    if (!dogId) return;
    setIsLoadingBookings(true);
    const { data } = await bookingApi.getBookings({ limit: 50 });
    if (data) {
      // Filter bookings that include this dog
      const filtered = data.bookings.filter((b) =>
        b.dogs?.some((bd) => bd.dogId === dogId || bd.dog?.id === dogId)
      );
      setBookings(filtered);
    }
    setIsLoadingBookings(false);
  }, [dogId]);

  useEffect(() => {
    fetchDog();
    fetchCompliance();
  }, [fetchDog, fetchCompliance]);

  useEffect(() => {
    if (activeTab === 'appointments' && bookings.length === 0) {
      fetchBookings();
    }
  }, [activeTab, fetchBookings, bookings.length]);

  const handleViewIdCard = async () => {
    if (!dogId) return;
    setIsLoadingIdCard(true);
    const { data } = await dogProfileApi.getIdCard(dogId);
    if (data) {
      setIdCard(data.idCard);
      setIsIdCardOpen(true);
    }
    setIsLoadingIdCard(false);
  };

  const handleSaveProfile = async () => {
    if (!dogId) return;
    setIsSaving(true);
    setSaveError(null);
    const { error: saveErr } = await dogProfileApi.updateDog(dogId, {
      name: editForm.name,
      breed: editForm.breed || null,
      sizeCategory: editForm.sizeCategory || null,
      weight: editForm.weight ? parseFloat(editForm.weight) : null,
      temperament: editForm.temperament || null,
      color: editForm.color || null,
      allergies: editForm.allergies || null,
      specialNeeds: editForm.specialNeeds || null,
      socialNotes: editForm.socialNotes || null,
      goodWith: editForm.goodWith || null,
      alteredStatus: editForm.alteredStatus || null,
      alteredDate: editForm.alteredDate || null,
      vetName: editForm.vetName || null,
      vetPhone: editForm.vetPhone || null,
      vetAddress: editForm.vetAddress || null,
      vetEmail: editForm.vetEmail || null,
      emergencyVetName: editForm.emergencyVetName || null,
      emergencyVetPhone: editForm.emergencyVetPhone || null,
      emergencyVetCostLimit: editForm.emergencyVetCostLimit ? Math.round(parseFloat(editForm.emergencyVetCostLimit) * 100) : null,
      feedingMethod: editForm.feedingMethod || null,
      foodType: editForm.foodType || null,
      feedingNotes: editForm.feedingNotes || null,
      emergencyAgent: editForm.emergencyAgent || null,
      emergencyAgentRelationship: editForm.emergencyAgentRelationship || null,
      emergencyAgentPhone: editForm.emergencyAgentPhone || null,
    });
    if (saveErr) {
      setSaveError(saveErr);
    } else {
      setIsEditing(false);
      fetchDog();
    }
    setIsSaving(false);
  };

  // Vaccination handlers
  const openAddVax = () => { setEditingVax(null); setVaxForm({ name: '', dateGiven: '', expiresAt: '' }); setVaxError(null); setIsVaxModalOpen(true); };
  const openEditVax = (vax: VaccinationRecord) => {
    setEditingVax(vax);
    setVaxForm({ name: vax.name, dateGiven: vax.dateGiven ? vax.dateGiven.split('T')[0] : '', expiresAt: vax.expiresAt ? vax.expiresAt.split('T')[0] : '' });
    setVaxError(null); setIsVaxModalOpen(true);
  };
  const handleSaveVax = async () => {
    if (!dogId) return;
    setIsSavingVax(true); setVaxError(null);
    const payload = { name: vaxForm.name, dateGiven: vaxForm.dateGiven, expiresAt: vaxForm.expiresAt || null };
    const result = editingVax
      ? await dogProfileApi.updateVaccination(dogId, editingVax.id, payload)
      : await dogProfileApi.addVaccination(dogId, payload);
    if (result.error) { setVaxError(result.error); } else { setIsVaxModalOpen(false); fetchDog(); fetchCompliance(); }
    setIsSavingVax(false);
  };

  // Medication handlers
  const openAddMed = () => { setEditingMed(null); setMedForm({ name: '', dosage: '', frequency: '', startDate: '', endDate: '', notes: '' }); setMedError(null); setIsMedModalOpen(true); };
  const openEditMed = (med: MedicationRecord) => {
    setEditingMed(med);
    setMedForm({ name: med.name, dosage: med.dosage || '', frequency: med.frequency || '', startDate: med.startDate ? med.startDate.split('T')[0] : '', endDate: med.endDate ? med.endDate.split('T')[0] : '', notes: med.instructions || '' });
    setMedError(null); setIsMedModalOpen(true);
  };
  const handleSaveMed = async () => {
    if (!dogId) return;
    setIsSavingMed(true); setMedError(null);
    const payload = { name: medForm.name, dosage: medForm.dosage || undefined, frequency: medForm.frequency || undefined, startDate: medForm.startDate || undefined, endDate: medForm.endDate || undefined, instructions: medForm.notes || undefined };
    const result = editingMed
      ? await dogProfileApi.updateMedication(dogId, editingMed.id, payload)
      : await dogProfileApi.addMedication(dogId, payload);
    if (result.error) { setMedError(result.error); } else { setIsMedModalOpen(false); fetchDog(); }
    setIsSavingMed(false);
  };

  // Delete handlers
  const handleDelete = async () => {
    if (!dogId || !deleteTarget) return;
    setIsDeleting(true);
    const result = deleteTarget.type === 'vax'
      ? await dogProfileApi.deleteVaccination(dogId, deleteTarget.id)
      : await dogProfileApi.deleteMedication(dogId, deleteTarget.id);
    if (!result.error) { setDeleteTarget(null); fetchDog(); if (deleteTarget.type === 'vax') fetchCompliance(); }
    setIsDeleting(false);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return 'N/A'; }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'current': return 'bg-brand-soft-green';
      case 'expiring_soon': return 'bg-brand-golden-yellow';
      case 'expired': return 'bg-brand-coral';
      default: return 'bg-gray-300';
    }
  };

  const alteredLabel = (s: string | null) => {
    if (!s) return null;
    if (s === 'spayed') return 'Spayed Female';
    if (s === 'neutered') return 'Neutered Male';
    return 'Intact';
  };

  const feedingLabel = (s: string | null) => {
    if (!s) return null;
    const map: Record<string, string> = { free_feed: 'Free Feed', scheduled: 'Scheduled', measured: 'Measured' };
    return map[s] || s;
  };

  const foodLabel = (s: string | null) => {
    if (!s) return null;
    const map: Record<string, string> = { dry: 'Dry', wet: 'Wet', raw: 'Raw', mixed: 'Mixed' };
    return map[s] || s;
  };

  // --- Reminders logic ---
  const getReminders = () => {
    if (!dog) return [];
    const reminders: Array<{ type: 'vaccination' | 'grooming'; title: string; detail: string; urgent: boolean }> = [];
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    // Vaccination reminders
    if (dog.vaccinations) {
      for (const vax of dog.vaccinations) {
        if (vax.expiresAt) {
          const expires = new Date(vax.expiresAt);
          if (expires < now) {
            reminders.push({ type: 'vaccination', title: `${vax.name} Expired`, detail: `Expired ${formatDate(vax.expiresAt)}`, urgent: true });
          } else if (expires.getTime() - now.getTime() < thirtyDays) {
            reminders.push({ type: 'vaccination', title: `${vax.name} Expiring Soon`, detail: `Expires ${formatDate(vax.expiresAt)}`, urgent: false });
          }
        }
      }
    }

    // Grooming reminder
    if (dog.lastGroomDate) {
      const lastGroom = new Date(dog.lastGroomDate);
      const sixWeeks = 42 * 24 * 60 * 60 * 1000;
      if (now.getTime() - lastGroom.getTime() > sixWeeks) {
        reminders.push({ type: 'grooming', title: 'Grooming Overdue', detail: `Last groomed ${formatDate(dog.lastGroomDate)}`, urgent: false });
      }
    }

    return reminders;
  };

  // --- Loading / Error states ---
  if (isLoading) {
    return (
      <AppShell title="Pet Profile" showBack>
        <div className="flex flex-col items-center justify-center py-16">
          <svg className="animate-spin h-10 w-10 text-brand-blue" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-gray-500 mt-4">Loading pet profile...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !dog) {
    return (
      <AppShell title="Dog Profile" showBack>
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-cream flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-bold text-brand-navy mb-2">
              {error ? 'Failed to load pet profile' : 'Pet not found'}
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              {error || "We couldn't find this pet. It may have been removed."}
            </p>
            <button onClick={() => { setError(null); setIsLoading(true); fetchDog(); fetchCompliance(); }}
              className="w-full bg-brand-blue text-white font-semibold py-3 px-6 rounded-xl hover:bg-brand-blue/90 transition-colors min-h-[44px] mb-3">
              Try Again
            </button>
            <button onClick={() => window.history.back()}
              className="w-full text-brand-blue font-medium py-3 px-6 rounded-xl hover:bg-brand-cream transition-colors min-h-[44px]">
              Go Back
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const reminders = getReminders();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingBookings = bookings.filter(b => new Date(b.date) >= today && b.status !== 'cancelled');
  const pastBookings = bookings.filter(b => new Date(b.date) < today || b.status === 'cancelled');

  return (
    <AppShell title={dog.name} showBack>
      {/* Header: Photo + ID Card Button */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1" />
          <button
            onClick={handleViewIdCard}
            disabled={isLoadingIdCard}
            className="border border-brand-navy text-brand-navy text-xs font-semibold px-3 py-1.5 rounded-lg
              hover:bg-brand-navy hover:text-white transition-colors min-h-[36px] flex items-center gap-1.5"
          >
            {isLoadingIdCard ? (
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
              </svg>
            )}
            View Pet ID Card
          </button>
        </div>

        {/* Photo centered */}
        <div className="flex justify-center -mt-2 mb-2">
          <div className="w-28 h-28 relative">
            <PhotoUpload dogId={dog.id} currentPhotoUrl={dog.photoUrl} onUploadComplete={() => fetchDog()} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 px-4">
        {([
          { key: 'profile' as Tab, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'Profile' },
          { key: 'appointments' as Tab, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Appointments' },
          { key: 'reminders' as Tab, icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', label: 'Reminders' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors min-h-[44px]
              ${activeTab === tab.key
                ? 'text-brand-blue border-b-2 border-brand-blue'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 py-5 space-y-5 pb-8">

        {/* ===== PROFILE TAB ===== */}
        {activeTab === 'profile' && (
          <>
            {isEditing ? (
              /* ----- EDIT MODE ----- */
              <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
                <h3 className="font-heading text-lg font-bold text-brand-navy">Edit Profile</h3>

                {/* Basic Info */}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basic Info</p>
                <Input label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <Input label="Breed" value={editForm.breed} onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })} placeholder="e.g. Golden Retriever" />
                <Input label="Color / Markings" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} placeholder="e.g. Golden, Black and Tan" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <select value={editForm.sizeCategory} onChange={(e) => setEditForm({ ...editForm, sizeCategory: e.target.value })} className={SELECT_CLASS}>
                    <option value="">Select size</option>
                    <option value="small">Small (under 25 lbs)</option>
                    <option value="medium">Medium (25-50 lbs)</option>
                    <option value="large">Large (50-100 lbs)</option>
                    <option value="xl">X-Large (100+ lbs)</option>
                  </select>
                </div>
                <Input label="Weight (lbs)" type="number" value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })} placeholder="e.g. 65" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sex / Altered Status</label>
                  <select value={editForm.alteredStatus} onChange={(e) => setEditForm({ ...editForm, alteredStatus: e.target.value })} className={SELECT_CLASS}>
                    <option value="">Select status</option>
                    <option value="intact">Intact</option>
                    <option value="spayed">Spayed</option>
                    <option value="neutered">Neutered</option>
                  </select>
                </div>
                {(editForm.alteredStatus === 'spayed' || editForm.alteredStatus === 'neutered') && (
                  <Input label="Date Altered" type="date" value={editForm.alteredDate} onChange={(e) => setEditForm({ ...editForm, alteredDate: e.target.value })} />
                )}
                <Input label="Temperament" value={editForm.temperament} onChange={(e) => setEditForm({ ...editForm, temperament: e.target.value })} placeholder="e.g. Friendly, energetic" />
                <Input label="Good With" value={editForm.goodWith} onChange={(e) => setEditForm({ ...editForm, goodWith: e.target.value })} placeholder="e.g. Kids, small dogs, cats" />
                <Input label="Social Notes" value={editForm.socialNotes} onChange={(e) => setEditForm({ ...editForm, socialNotes: e.target.value })} placeholder="e.g. Prefers small playgroups" />

                {/* Health */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Health & Safety</p>
                  <div className="space-y-3">
                    <Input label="Allergies" value={editForm.allergies} onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })} placeholder="e.g. Chicken, certain shampoos" />
                    <Input label="Special Needs" value={editForm.specialNeeds} onChange={(e) => setEditForm({ ...editForm, specialNeeds: e.target.value })} placeholder="e.g. Needs extra bathroom breaks" />
                  </div>
                </div>

                {/* Primary Vet */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Primary Veterinarian</p>
                  <div className="space-y-3">
                    <Input label="Vet Name" value={editForm.vetName} onChange={(e) => setEditForm({ ...editForm, vetName: e.target.value })} placeholder="e.g. Dr. Sarah Mitchell" />
                    <Input label="Vet Phone" type="tel" value={editForm.vetPhone} onChange={(e) => setEditForm({ ...editForm, vetPhone: e.target.value })} placeholder="e.g. (555) 987-6543" />
                    <Input label="Vet Email" type="email" value={editForm.vetEmail} onChange={(e) => setEditForm({ ...editForm, vetEmail: e.target.value })} placeholder="e.g. info@vetclinic.com" />
                    <Input label="Vet Address" value={editForm.vetAddress} onChange={(e) => setEditForm({ ...editForm, vetAddress: e.target.value })} placeholder="e.g. 123 Pet Care Ave" />
                  </div>
                </div>

                {/* Emergency Vet */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Emergency Vet</p>
                  <div className="space-y-3">
                    <Input label="Emergency Vet Name" value={editForm.emergencyVetName} onChange={(e) => setEditForm({ ...editForm, emergencyVetName: e.target.value })} placeholder="e.g. Animal Emergency Center" />
                    <Input label="Emergency Vet Phone" type="tel" value={editForm.emergencyVetPhone} onChange={(e) => setEditForm({ ...editForm, emergencyVetPhone: e.target.value })} placeholder="e.g. (555) 123-4567" />
                    <Input label="Emergency Cost Limit ($)" type="number" value={editForm.emergencyVetCostLimit} onChange={(e) => setEditForm({ ...editForm, emergencyVetCostLimit: e.target.value })} placeholder="e.g. 3000" />
                  </div>
                </div>

                {/* Emergency Agent */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Emergency Contact Person</p>
                  <div className="space-y-3">
                    <Input label="Name" value={editForm.emergencyAgent} onChange={(e) => setEditForm({ ...editForm, emergencyAgent: e.target.value })} placeholder="e.g. Jane Smith" />
                    <Input label="Relationship" value={editForm.emergencyAgentRelationship} onChange={(e) => setEditForm({ ...editForm, emergencyAgentRelationship: e.target.value })} placeholder="e.g. Spouse, Parent, Roommate" />
                    <Input label="Phone" type="tel" value={editForm.emergencyAgentPhone} onChange={(e) => setEditForm({ ...editForm, emergencyAgentPhone: e.target.value })} placeholder="e.g. (555) 123-4568" />
                  </div>
                </div>

                {/* Feeding */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Feeding</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Feeding Method</label>
                      <select value={editForm.feedingMethod} onChange={(e) => setEditForm({ ...editForm, feedingMethod: e.target.value })} className={SELECT_CLASS}>
                        <option value="">Select method</option>
                        <option value="free_feed">Free Feed</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="measured">Measured</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Food Type</label>
                      <select value={editForm.foodType} onChange={(e) => setEditForm({ ...editForm, foodType: e.target.value })} className={SELECT_CLASS}>
                        <option value="">Select type</option>
                        <option value="dry">Dry</option>
                        <option value="wet">Wet</option>
                        <option value="raw">Raw</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Feeding Notes</label>
                      <textarea value={editForm.feedingNotes} onChange={(e) => setEditForm({ ...editForm, feedingNotes: e.target.value })}
                        className="w-full px-3 py-2 border border-brand-light-gray rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                        rows={2} placeholder="e.g. 2 cups twice daily, morning and evening" />
                    </div>
                  </div>
                </div>

                {saveError && <Alert variant="error">{saveError}</Alert>}
                <div className="flex gap-3 pt-3">
                  <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSaveProfile} isLoading={isSaving}>Save</Button>
                </div>
              </div>
            ) : (
              /* ----- READ MODE ----- */
              <>
                {/* Pet Profile — Otto-style list */}
                <div className="bg-white rounded-2xl shadow-lg p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-heading text-lg font-bold text-brand-navy">Pet Profile</h3>
                    <button onClick={() => setIsEditing(true)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-blue hover:bg-brand-cream transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  <InfoRow label="Name" value={dog.name} />
                  <InfoRow label="Breed" value={dog.breed} />
                  <InfoRow label="Color" value={dog.color} />
                  <InfoRow label="Sex" value={alteredLabel(dog.alteredStatus)} />
                  <InfoRow label="Date of Birth" value={dog.birthDate ? formatDate(dog.birthDate) : null} />
                  <InfoRow label="Weight" value={dog.weight ? `${dog.weight} lb` : null} />
                  <InfoRow label="Size" value={dog.sizeCategory ? dog.sizeCategory.charAt(0).toUpperCase() + dog.sizeCategory.slice(1) : null} />
                  <InfoRow label="Temperament" value={dog.temperament} />
                  <InfoRow label="Microchip" value={dog.microchipNumber} />
                  <InfoRow label="Good With" value={dog.goodWith} />
                  <InfoRow label="Last Groom" value={dog.lastGroomDate ? formatDate(dog.lastGroomDate) : null} />
                </div>

                {/* Vet Info */}
                {(dog.vetName || dog.vetPhone) && (
                  <div className="bg-white rounded-2xl shadow-lg p-5">
                    <h3 className="font-heading text-base font-bold text-brand-navy mb-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Veterinarian
                    </h3>
                    <InfoRow label="Name" value={dog.vetName} />
                    <InfoRow label="Phone" value={dog.vetPhone} href={dog.vetPhone ? `tel:${dog.vetPhone}` : undefined} />
                    <InfoRow label="Email" value={dog.vetEmail} href={dog.vetEmail ? `mailto:${dog.vetEmail}` : undefined} />
                    <InfoRow label="Address" value={dog.vetAddress} />
                  </div>
                )}

                {/* Health & Safety */}
                {(dog.allergies || dog.specialNeeds || dog.emergencyVetName || dog.emergencyVetCostLimit) && (
                  <div className="bg-white rounded-2xl shadow-lg p-5">
                    <h3 className="font-heading text-base font-bold text-brand-navy mb-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Health & Safety
                    </h3>
                    <InfoRow label="Allergies" value={dog.allergies} />
                    <InfoRow label="Special Needs" value={dog.specialNeeds} />
                    <InfoRow label="Emergency Vet" value={dog.emergencyVetName} />
                    <InfoRow label="Emergency Vet Phone" value={dog.emergencyVetPhone} href={dog.emergencyVetPhone ? `tel:${dog.emergencyVetPhone}` : undefined} />
                    {dog.emergencyVetCostLimit && (
                      <InfoRow label="Cost Authorization" value={`$${(dog.emergencyVetCostLimit / 100).toLocaleString()}`} />
                    )}
                  </div>
                )}

                {/* Emergency Contact */}
                {dog.emergencyAgent && (
                  <div className="bg-white rounded-2xl shadow-lg p-5">
                    <h3 className="font-heading text-base font-bold text-brand-navy mb-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Emergency Contact
                    </h3>
                    <InfoRow label="Name" value={dog.emergencyAgent} />
                    <InfoRow label="Relationship" value={dog.emergencyAgentRelationship} />
                    <InfoRow label="Phone" value={dog.emergencyAgentPhone} href={dog.emergencyAgentPhone ? `tel:${dog.emergencyAgentPhone}` : undefined} />
                  </div>
                )}

                {/* Feeding */}
                {(dog.feedingMethod || dog.foodType || dog.feedingNotes) && (
                  <div className="bg-white rounded-2xl shadow-lg p-5">
                    <h3 className="font-heading text-base font-bold text-brand-navy mb-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                      Feeding
                    </h3>
                    <InfoRow label="Method" value={feedingLabel(dog.feedingMethod)} />
                    <InfoRow label="Food Type" value={foodLabel(dog.foodType)} />
                    {dog.feedingNotes && (
                      <div className="py-2.5">
                        <span className="text-sm text-gray-500">Notes</span>
                        <p className="text-sm text-brand-navy mt-0.5">{dog.feedingNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Vaccination Compliance Bar */}
                {compliance && (
                  <div className="bg-white rounded-2xl shadow-lg p-5">
                    <h3 className="font-heading text-base font-bold text-brand-navy mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Vaccination Status
                    </h3>
                    <div className="mb-3">
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${getComplianceColor(compliance.overall)}`}
                          style={{ width: compliance.overall === 'current' ? '100%' : compliance.overall === 'expiring_soon' ? '66%' : compliance.overall === 'expired' ? '33%' : '0%' }} />
                      </div>
                    </div>
                    {compliance.vaccinations.length > 0 && (
                      <div className="space-y-1.5">
                        {compliance.vaccinations.map((v, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{v.name}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              v.status === 'current' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {v.status === 'current' ? 'Current' : 'Expired'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Vaccinations */}
                <div className="bg-white rounded-2xl shadow-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading text-base font-bold text-brand-navy flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      Vaccinations
                    </h3>
                    <button onClick={openAddVax} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-blue hover:bg-brand-cream transition-colors text-sm font-medium gap-1 px-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Add
                    </button>
                  </div>
                  {dog.vaccinations && dog.vaccinations.length > 0 ? (
                    <div className="space-y-3">
                      {dog.vaccinations.map((vax) => (
                        <div key={vax.id} className="bg-brand-cream rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-brand-navy">{vax.name}</p>
                                {vax.verified && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-brand-soft-green text-white">Verified</span>}
                              </div>
                              <p className="text-sm text-gray-600">Given: {formatDate(vax.dateGiven)}{vax.expiresAt && ` | Expires: ${formatDate(vax.expiresAt)}`}</p>
                              <VaccinationUpload dogId={dog.id} vaccinationId={vax.id} currentDocUrl={vax.documentUrl} onUploadComplete={() => fetchDog()} />
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => openEditVax(vax)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-blue hover:bg-white transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => setDeleteTarget({ type: 'vax', id: vax.id, name: vax.name })} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-coral hover:bg-white transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">No vaccination records yet</p>
                      <button onClick={openAddVax} className="text-brand-blue font-medium text-sm mt-1 hover:underline min-h-[44px]">Add first vaccination</button>
                    </div>
                  )}
                </div>

                {/* Medications */}
                <div className="bg-white rounded-2xl shadow-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading text-base font-bold text-brand-navy flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      Medications
                    </h3>
                    <button onClick={openAddMed} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-blue hover:bg-brand-cream transition-colors text-sm font-medium gap-1 px-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Add
                    </button>
                  </div>
                  {dog.medications && dog.medications.filter(m => m.isActive).length > 0 ? (
                    <div className="space-y-3">
                      {dog.medications.filter(m => m.isActive).map((med) => (
                        <div key={med.id} className="bg-brand-cream rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-brand-navy">{med.name}</p>
                              <p className="text-sm text-gray-600">{med.dosage || 'No dosage'} &middot; {med.frequency || 'No frequency'}</p>
                              {med.instructions && <p className="text-sm text-gray-500 mt-1">{med.instructions}</p>}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => openEditMed(med)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-blue hover:bg-white transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => setDeleteTarget({ type: 'med', id: med.id, name: med.name })} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-coral hover:bg-white transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">No active medications</p>
                      <button onClick={openAddMed} className="text-brand-blue font-medium text-sm mt-1 hover:underline min-h-[44px]">Add medication</button>
                    </div>
                  )}
                </div>

                {/* Behavior Notes */}
                {dog.behaviorNotes && dog.behaviorNotes.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-5">
                    <h3 className="font-heading text-base font-bold text-brand-navy mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      Staff Observations
                    </h3>
                    <div className="space-y-3">
                      {dog.behaviorNotes.map((note) => (
                        <div key={note.id} className="bg-brand-cream rounded-xl p-4">
                          <p className="text-gray-800 text-sm">{note.note}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {note.reporter ? `${note.reporter.firstName} ${note.reporter.lastName}` : 'Staff'} &middot; {formatDate(note.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ===== APPOINTMENTS TAB ===== */}
        {activeTab === 'appointments' && (
          <>
            {isLoadingBookings ? (
              <div className="flex flex-col items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-brand-blue" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-gray-500 mt-3">Loading appointments...</p>
              </div>
            ) : (
              <>
                {/* Upcoming */}
                <div className="bg-white rounded-2xl shadow-lg p-5">
                  <h3 className="font-heading text-base font-bold text-brand-navy mb-3">Upcoming Appointments</h3>
                  {upcomingBookings.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingBookings.map((b) => (
                        <button key={b.id} onClick={() => navigate(`/bookings`)}
                          className="w-full text-left bg-brand-cream rounded-xl p-4 hover:bg-brand-cream/70 transition-colors">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-brand-navy text-sm">{b.serviceType?.displayName || 'Service'}</p>
                            <div className="text-right">
                              <p className="text-sm text-brand-navy">{formatDate(b.date)}</p>
                              {b.startTime && <p className="text-xs text-brand-blue">{b.startTime}</p>}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">{dog.name} has no upcoming appointments</p>
                  )}
                </div>

                {/* Previous */}
                <div className="bg-white rounded-2xl shadow-lg p-5">
                  <h3 className="font-heading text-base font-bold text-brand-navy mb-3">Previous Appointments</h3>
                  {pastBookings.length > 0 ? (
                    <div className="space-y-3">
                      {pastBookings.slice(0, 10).map((b) => (
                        <div key={b.id} className="flex justify-between items-start py-2.5 border-b border-gray-50 last:border-0">
                          <p className="font-medium text-brand-navy text-sm">{b.serviceType?.displayName || 'Service'}</p>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">{formatDate(b.date)}</p>
                            {b.startTime && <p className="text-xs text-brand-blue">{b.startTime}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No previous appointments</p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ===== REMINDERS TAB ===== */}
        {activeTab === 'reminders' && (
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h3 className="font-heading text-base font-bold text-brand-navy mb-3">Service Reminders</h3>
            {reminders.length > 0 ? (
              <div className="space-y-3">
                {reminders.map((r, i) => (
                  <div key={i} className={`rounded-xl p-4 ${r.urgent ? 'bg-red-50 border border-red-100' : 'bg-brand-cream'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${r.urgent ? 'bg-brand-coral' : 'bg-brand-golden-yellow'}`}>
                        {r.type === 'vaccination' ? (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${r.urgent ? 'text-red-800' : 'text-brand-navy'}`}>{r.title}</p>
                        <p className="text-sm text-gray-600">{r.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">{dog.name} has no upcoming reminders</p>
            )}
          </div>
        )}
      </div>

      {/* Vaccination Modal */}
      <Modal isOpen={isVaxModalOpen} onClose={() => setIsVaxModalOpen(false)} title={editingVax ? 'Edit Vaccination' : 'Add Vaccination'}>
        <div className="space-y-4">
          <Input label="Vaccination Name" value={vaxForm.name} onChange={(e) => setVaxForm({ ...vaxForm, name: e.target.value })} placeholder="e.g. Rabies, DHPP, Bordetella" />
          <Input label="Date Given" type="date" value={vaxForm.dateGiven} onChange={(e) => setVaxForm({ ...vaxForm, dateGiven: e.target.value })} />
          <Input label="Expiration Date (optional)" type="date" value={vaxForm.expiresAt} onChange={(e) => setVaxForm({ ...vaxForm, expiresAt: e.target.value })} />
          {vaxError && <Alert variant="error">{vaxError}</Alert>}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsVaxModalOpen(false)} disabled={isSavingVax}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveVax} isLoading={isSavingVax} disabled={!vaxForm.name || !vaxForm.dateGiven}>{editingVax ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Modal>

      {/* Medication Modal */}
      <Modal isOpen={isMedModalOpen} onClose={() => setIsMedModalOpen(false)} title={editingMed ? 'Edit Medication' : 'Add Medication'}>
        <div className="space-y-4">
          <Input label="Medication Name" value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} placeholder="e.g. Apoquel, Heartgard" />
          <Input label="Dosage" value={medForm.dosage} onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })} placeholder="e.g. 16mg" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select value={medForm.frequency} onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })} className={SELECT_CLASS}>
              <option value="">Select frequency</option>
              <option value="once_daily">Once daily</option>
              <option value="twice_daily">Twice daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="as_needed">As needed</option>
            </select>
          </div>
          <Input label="Start Date" type="date" value={medForm.startDate} onChange={(e) => setMedForm({ ...medForm, startDate: e.target.value })} />
          <Input label="End Date (optional)" type="date" value={medForm.endDate} onChange={(e) => setMedForm({ ...medForm, endDate: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={medForm.notes} onChange={(e) => setMedForm({ ...medForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-brand-light-gray rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue" rows={2} placeholder="Any special instructions..." />
          </div>
          {medError && <Alert variant="error">{medError}</Alert>}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsMedModalOpen(false)} disabled={isSavingMed}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveMed} isLoading={isSavingMed} disabled={!medForm.name || !medForm.dosage || !medForm.frequency}>{editingMed ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete">
        <div className="space-y-4">
          <p className="text-gray-700">Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>? This action cannot be undone.</p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button className="flex-1 !bg-brand-coral hover:!bg-red-500" onClick={handleDelete} isLoading={isDeleting}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Pet ID Card Modal */}
      {idCard && <PetIdCardModal isOpen={isIdCardOpen} onClose={() => setIsIdCardOpen(false)} idCard={idCard} />}
    </AppShell>
  );
}
