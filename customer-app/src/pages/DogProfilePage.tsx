import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dogProfileApi } from '../lib/api';
import { BottomNav } from '../components/BottomNav';
import { Button, Modal, Input, Alert } from '../components/ui';

interface Vaccination {
  id: string;
  name: string;
  dateGiven: string;
  expiresAt: string | null;
  verified: boolean;
  notes: string | null;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
  notes: string | null;
}

interface BehaviorNote {
  id: string;
  note: string;
  staffName: string;
  date: string;
}

interface ComplianceStatus {
  overall: 'current' | 'expiring_soon' | 'expired' | 'unknown';
  vaccinations: Array<{
    name: string;
    status: 'current' | 'expiring_soon' | 'expired';
    expiresAt: string | null;
  }>;
}

interface DogProfile {
  id: string;
  name: string;
  breed: string | null;
  birthDate: string | null;
  sizeCategory: string | null;
  weight: number | null;
  temperament: string | null;
  photoUrl: string | null;
  notes: string | null;
  vaccinations: Vaccination[];
  medications: Medication[];
  behaviorNotes: BehaviorNote[];
}

export function DogProfilePage() {
  const { dogId } = useParams<{ dogId: string }>();
  const navigate = useNavigate();

  const [dog, setDog] = useState<DogProfile | null>(null);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', breed: '', sizeCategory: '', weight: '', temperament: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Vaccination modal
  const [isVaxModalOpen, setIsVaxModalOpen] = useState(false);
  const [editingVax, setEditingVax] = useState<Vaccination | null>(null);
  const [vaxForm, setVaxForm] = useState({ name: '', dateGiven: '', expiresAt: '' });
  const [isSavingVax, setIsSavingVax] = useState(false);
  const [vaxError, setVaxError] = useState<string | null>(null);

  // Medication modal
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
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
      setDog(data);
      setEditForm({
        name: data.name || '',
        breed: data.breed || '',
        sizeCategory: data.sizeCategory || '',
        weight: data.weight ? String(data.weight) : '',
        temperament: data.temperament || '',
      });
    }
    setIsLoading(false);
  }, [dogId]);

  const fetchCompliance = useCallback(async () => {
    if (!dogId) return;
    const { data } = await dogProfileApi.getCompliance(dogId);
    if (data) {
      setCompliance(data);
    }
  }, [dogId]);

  useEffect(() => {
    fetchDog();
    fetchCompliance();
  }, [fetchDog, fetchCompliance]);

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
  const openAddVax = () => {
    setEditingVax(null);
    setVaxForm({ name: '', dateGiven: '', expiresAt: '' });
    setVaxError(null);
    setIsVaxModalOpen(true);
  };

  const openEditVax = (vax: Vaccination) => {
    setEditingVax(vax);
    setVaxForm({
      name: vax.name,
      dateGiven: vax.dateGiven ? vax.dateGiven.split('T')[0] : '',
      expiresAt: vax.expiresAt ? vax.expiresAt.split('T')[0] : '',
    });
    setVaxError(null);
    setIsVaxModalOpen(true);
  };

  const handleSaveVax = async () => {
    if (!dogId) return;
    setIsSavingVax(true);
    setVaxError(null);
    const payload = {
      name: vaxForm.name,
      dateGiven: vaxForm.dateGiven,
      expiresAt: vaxForm.expiresAt || null,
    };
    let result;
    if (editingVax) {
      result = await dogProfileApi.updateVaccination(dogId, editingVax.id, payload);
    } else {
      result = await dogProfileApi.addVaccination(dogId, payload);
    }
    if (result.error) {
      setVaxError(result.error);
    } else {
      setIsVaxModalOpen(false);
      fetchDog();
      fetchCompliance();
    }
    setIsSavingVax(false);
  };

  // Medication handlers
  const openAddMed = () => {
    setEditingMed(null);
    setMedForm({ name: '', dosage: '', frequency: '', startDate: '', endDate: '', notes: '' });
    setMedError(null);
    setIsMedModalOpen(true);
  };

  const openEditMed = (med: Medication) => {
    setEditingMed(med);
    setMedForm({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      startDate: med.startDate ? med.startDate.split('T')[0] : '',
      endDate: med.endDate ? med.endDate.split('T')[0] : '',
      notes: med.notes || '',
    });
    setMedError(null);
    setIsMedModalOpen(true);
  };

  const handleSaveMed = async () => {
    if (!dogId) return;
    setIsSavingMed(true);
    setMedError(null);
    const payload = {
      name: medForm.name,
      dosage: medForm.dosage,
      frequency: medForm.frequency,
      startDate: medForm.startDate,
      endDate: medForm.endDate || null,
      notes: medForm.notes || null,
    };
    let result;
    if (editingMed) {
      result = await dogProfileApi.updateMedication(dogId, editingMed.id, payload);
    } else {
      result = await dogProfileApi.addMedication(dogId, payload);
    }
    if (result.error) {
      setMedError(result.error);
    } else {
      setIsMedModalOpen(false);
      fetchDog();
    }
    setIsSavingMed(false);
  };

  // Delete handlers
  const handleDelete = async () => {
    if (!dogId || !deleteTarget) return;
    setIsDeleting(true);
    let result;
    if (deleteTarget.type === 'vax') {
      result = await dogProfileApi.deleteVaccination(dogId, deleteTarget.id);
    } else {
      result = await dogProfileApi.deleteMedication(dogId, deleteTarget.id);
    }
    if (!result.error) {
      setDeleteTarget(null);
      fetchDog();
      if (deleteTarget.type === 'vax') fetchCompliance();
    }
    setIsDeleting(false);
  };

  const formatDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'current': return 'bg-brand-soft-green';
      case 'expiring_soon': return 'bg-brand-golden-yellow';
      case 'expired': return 'bg-brand-coral';
      default: return 'bg-gray-300';
    }
  };

  const getComplianceLabel = (status: string) => {
    switch (status) {
      case 'current': return 'All Current';
      case 'expiring_soon': return 'Expiring Soon';
      case 'expired': return 'Needs Attention';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-warm-white flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-brand-blue" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error || !dog) {
    return (
      <div className="min-h-screen bg-brand-warm-white">
        <header className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-6 h-6 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="font-heading text-xl font-bold text-brand-navy">Dog Profile</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Alert variant="error">{error || 'Dog not found'}</Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-warm-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-6 h-6 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-heading text-xl font-bold text-brand-navy">{dog.name}'s Profile</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* Dog Identity Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-start gap-4">
            {/* Photo or placeholder */}
            <div className="flex-shrink-0">
              {dog.photoUrl ? (
                <img src={dog.photoUrl} alt={dog.name} className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-brand-cream flex items-center justify-center">
                  <svg className="w-10 h-10 text-brand-blue" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.5 11.5c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm11 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-7.5 4c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm3.5-8c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-5 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-3">
                  <Input label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <Input label="Breed" value={editForm.breed} onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })} placeholder="e.g. Golden Retriever" />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <select
                      value={editForm.sizeCategory}
                      onChange={(e) => setEditForm({ ...editForm, sizeCategory: e.target.value })}
                      className="w-full px-3 py-2 border border-brand-light-gray rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[44px]"
                    >
                      <option value="">Select size</option>
                      <option value="small">Small (under 25 lbs)</option>
                      <option value="medium">Medium (25-50 lbs)</option>
                      <option value="large">Large (50-100 lbs)</option>
                      <option value="xlarge">X-Large (100+ lbs)</option>
                    </select>
                  </div>
                  <Input label="Weight (lbs)" type="number" value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })} placeholder="e.g. 65" />
                  <Input label="Temperament" value={editForm.temperament} onChange={(e) => setEditForm({ ...editForm, temperament: e.target.value })} placeholder="e.g. Friendly, energetic" />
                  {saveError && <Alert variant="error">{saveError}</Alert>}
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                    <Button className="flex-1" onClick={handleSaveProfile} isLoading={isSaving}>Save</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-heading text-2xl font-bold text-brand-navy">{dog.name}</h2>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-blue hover:bg-brand-cream transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {dog.breed && <p><span className="font-medium text-brand-navy">Breed:</span> {dog.breed}</p>}
                    {dog.sizeCategory && <p><span className="font-medium text-brand-navy">Size:</span> <span className="capitalize">{dog.sizeCategory}</span></p>}
                    {dog.weight && <p><span className="font-medium text-brand-navy">Weight:</span> {dog.weight} lbs</p>}
                    {dog.temperament && <p><span className="font-medium text-brand-navy">Temperament:</span> {dog.temperament}</p>}
                    {dog.birthDate && <p><span className="font-medium text-brand-navy">Birthday:</span> {formatDate(dog.birthDate)}</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Vaccination Compliance Bar */}
        {compliance && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="font-heading text-lg font-semibold text-brand-navy mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Vaccination Status
            </h3>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{getComplianceLabel(compliance.overall)}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getComplianceColor(compliance.overall)}`}>
                  {compliance.overall === 'current' ? 'Up to Date' : compliance.overall === 'expiring_soon' ? 'Check Soon' : compliance.overall === 'expired' ? 'Action Needed' : 'N/A'}
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getComplianceColor(compliance.overall)}`}
                  style={{ width: compliance.overall === 'current' ? '100%' : compliance.overall === 'expiring_soon' ? '66%' : compliance.overall === 'expired' ? '33%' : '0%' }}
                />
              </div>
            </div>
            {compliance.vaccinations.length > 0 && (
              <div className="space-y-1.5">
                {compliance.vaccinations.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{v.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      v.status === 'current' ? 'bg-green-100 text-green-800' :
                      v.status === 'expiring_soon' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {v.status === 'current' ? 'Current' : v.status === 'expiring_soon' ? 'Expiring Soon' : 'Expired'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vaccinations Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold text-brand-navy flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Vaccinations
            </h3>
            <button
              onClick={openAddVax}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-blue hover:bg-brand-cream transition-colors text-sm font-medium gap-1 px-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
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
                        {vax.verified && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-brand-soft-green text-white">
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Given: {formatDate(vax.dateGiven)}
                        {vax.expiresAt && ` | Expires: ${formatDate(vax.expiresAt)}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditVax(vax)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-blue hover:bg-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: 'vax', id: vax.id, name: vax.name })}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-coral hover:bg-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <p className="text-sm">No vaccination records yet</p>
              <button onClick={openAddVax} className="text-brand-blue font-medium text-sm mt-1 hover:underline min-h-[44px]">
                Add first vaccination
              </button>
            </div>
          )}
        </div>

        {/* Medications Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold text-brand-navy flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Medications
            </h3>
            <button
              onClick={openAddMed}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-blue hover:bg-brand-cream transition-colors text-sm font-medium gap-1 px-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add
            </button>
          </div>

          {dog.medications && dog.medications.filter(m => m.active).length > 0 ? (
            <div className="space-y-3">
              {dog.medications.filter(m => m.active).map((med) => (
                <div key={med.id} className="bg-brand-cream rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-brand-navy">{med.name}</p>
                      <p className="text-sm text-gray-600">{med.dosage} &middot; {med.frequency}</p>
                      {med.notes && <p className="text-sm text-gray-500 mt-1">{med.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditMed(med)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-blue hover:bg-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: 'med', id: med.id, name: med.name })}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-coral hover:bg-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <p className="text-sm">No active medications</p>
              <button onClick={openAddMed} className="text-brand-blue font-medium text-sm mt-1 hover:underline min-h-[44px]">
                Add medication
              </button>
            </div>
          )}
        </div>

        {/* Behavior Notes Section */}
        {dog.behaviorNotes && dog.behaviorNotes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="font-heading text-lg font-semibold text-brand-navy mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Staff Observations
            </h3>
            <div className="space-y-3">
              {dog.behaviorNotes.map((note) => (
                <div key={note.id} className="bg-brand-cream rounded-xl p-4">
                  <p className="text-gray-800 text-sm">{note.note}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {note.staffName} &middot; {formatDate(note.date)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Vaccination Modal */}
      <Modal
        isOpen={isVaxModalOpen}
        onClose={() => setIsVaxModalOpen(false)}
        title={editingVax ? 'Edit Vaccination' : 'Add Vaccination'}
      >
        <div className="space-y-4">
          <Input
            label="Vaccination Name"
            value={vaxForm.name}
            onChange={(e) => setVaxForm({ ...vaxForm, name: e.target.value })}
            placeholder="e.g. Rabies, DHPP, Bordetella"
          />
          <Input
            label="Date Given"
            type="date"
            value={vaxForm.dateGiven}
            onChange={(e) => setVaxForm({ ...vaxForm, dateGiven: e.target.value })}
          />
          <Input
            label="Expiration Date (optional)"
            type="date"
            value={vaxForm.expiresAt}
            onChange={(e) => setVaxForm({ ...vaxForm, expiresAt: e.target.value })}
          />
          {vaxError && <Alert variant="error">{vaxError}</Alert>}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsVaxModalOpen(false)} disabled={isSavingVax}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveVax} isLoading={isSavingVax} disabled={!vaxForm.name || !vaxForm.dateGiven}>
              {editingVax ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Medication Modal */}
      <Modal
        isOpen={isMedModalOpen}
        onClose={() => setIsMedModalOpen(false)}
        title={editingMed ? 'Edit Medication' : 'Add Medication'}
      >
        <div className="space-y-4">
          <Input
            label="Medication Name"
            value={medForm.name}
            onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
            placeholder="e.g. Apoquel, Heartgard"
          />
          <Input
            label="Dosage"
            value={medForm.dosage}
            onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
            placeholder="e.g. 16mg"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={medForm.frequency}
              onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
              className="w-full px-3 py-2 border border-brand-light-gray rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[44px]"
            >
              <option value="">Select frequency</option>
              <option value="once_daily">Once daily</option>
              <option value="twice_daily">Twice daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="as_needed">As needed</option>
            </select>
          </div>
          <Input
            label="Start Date"
            type="date"
            value={medForm.startDate}
            onChange={(e) => setMedForm({ ...medForm, startDate: e.target.value })}
          />
          <Input
            label="End Date (optional)"
            type="date"
            value={medForm.endDate}
            onChange={(e) => setMedForm({ ...medForm, endDate: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={medForm.notes}
              onChange={(e) => setMedForm({ ...medForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-brand-light-gray rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
              rows={2}
              placeholder="Any special instructions..."
            />
          </div>
          {medError && <Alert variant="error">{medError}</Alert>}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsMedModalOpen(false)} disabled={isSavingMed}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveMed} isLoading={isSavingMed} disabled={!medForm.name || !medForm.dosage || !medForm.frequency}>
              {editingMed ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button
              className="flex-1 !bg-brand-coral hover:!bg-red-500"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
