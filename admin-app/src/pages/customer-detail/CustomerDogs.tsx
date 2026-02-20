import { useState } from 'react';
import { Button, Alert, Modal, Card, Badge } from '../../components/ui';
import { adminDogApi } from '../../lib/api';
import type { CustomerDog } from '../../lib/api';

interface CustomerDogsProps {
  dogs: CustomerDog[];
}

export function CustomerDogs({ dogs }: CustomerDogsProps) {
  const [expandedDogId, setExpandedDogId] = useState<string | null>(null);
  const [showBehaviorNoteModal, setShowBehaviorNoteModal] = useState(false);
  const [behaviorNoteDogId, setBehaviorNoteDogId] = useState<string | null>(null);
  const [behaviorNoteText, setBehaviorNoteText] = useState('');
  const [behaviorNoteType, setBehaviorNoteType] = useState<'positive' | 'concern' | 'info'>('info');
  const [isSubmittingBehaviorNote, setIsSubmittingBehaviorNote] = useState(false);
  const [behaviorNoteSuccess, setBehaviorNoteSuccess] = useState(false);

  if (dogs.length === 0) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateAge = (birthDate: string): string => {
    const birth = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const adjustedYears = months < 0 || (months === 0 && now.getDate() < birth.getDate()) ? years - 1 : years;
    if (adjustedYears < 1) {
      const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
      return totalMonths <= 1 ? '< 1 month' : totalMonths + ' months';
    }
    return adjustedYears === 1 ? '1 year' : adjustedYears + ' years';
  };

  const getVaccinationStatus = (dog: CustomerDog): { label: string; variant: string } => {
    if (!dog.vaccinations || dog.vaccinations.length === 0) {
      return { label: 'No records', variant: 'closed' };
    }
    const now = new Date();
    const hasExpired = dog.vaccinations.some((v) => v.expires_at && new Date(v.expires_at) < now);
    const hasUnverified = dog.vaccinations.some((v) => !v.verified);
    if (hasExpired) return { label: 'Expired', variant: 'overdue' };
    if (hasUnverified) return { label: 'Needs verification', variant: 'pending' };
    return { label: 'Up to date', variant: 'active' };
  };

  const handleOpenBehaviorNote = (dogId: string) => {
    setBehaviorNoteDogId(dogId);
    setBehaviorNoteText('');
    setBehaviorNoteType('info');
    setBehaviorNoteSuccess(false);
    setShowBehaviorNoteModal(true);
  };

  const handleSubmitBehaviorNote = async () => {
    if (!behaviorNoteDogId || !behaviorNoteText.trim()) return;
    setIsSubmittingBehaviorNote(true);
    const result = await adminDogApi.addBehaviorNote(behaviorNoteDogId, {
      note: behaviorNoteText.trim(),
      type: behaviorNoteType,
    });
    setIsSubmittingBehaviorNote(false);
    if (!result.error) {
      setBehaviorNoteSuccess(true);
      setBehaviorNoteText('');
    }
  };

  const handleCloseBehaviorNoteModal = () => {
    setShowBehaviorNoteModal(false);
    setBehaviorNoteDogId(null);
    setBehaviorNoteText('');
    setBehaviorNoteSuccess(false);
  };

  return (
    <>
      <Card title={`Dogs (${dogs.length})`} className="mb-6">
        <div className="space-y-3">
          {dogs.map((dog) => (
            <div key={dog.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedDogId(expandedDogId === dog.id ? null : dog.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-[#62A2C3]/5 transition-colors min-h-[56px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#62A2C3]/15 flex items-center justify-center flex-shrink-0">
                    {dog.photo_url ? (
                      <img src={dog.photo_url} alt={dog.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <svg className="w-5 h-5 text-[#62A2C3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-[#1B365D]">{dog.name}</p>
                    <p className="text-xs text-gray-500">
                      {dog.breed || 'Unknown breed'}
                      {dog.size_category && ` \u00b7 ${dog.size_category}`}
                      {dog.weight && ` \u00b7 ${dog.weight} lbs`}
                      {dog.birth_date && ` \u00b7 ${calculateAge(dog.birth_date)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const vaxStatus = getVaccinationStatus(dog);
                    return <Badge variant={vaxStatus.variant} className="hidden sm:inline-flex">{vaxStatus.label}</Badge>;
                  })()}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedDogId === dog.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedDogId === dog.id && (
                <div className="border-t border-gray-100 p-4 bg-[#F8F6F3]/50">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {dog.birth_date && (
                      <div>
                        <p className="text-xs text-gray-500">Birthday</p>
                        <p className="text-sm font-medium text-[#1B365D]">{formatDate(dog.birth_date)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Neutered/Spayed</p>
                      <p className="text-sm font-medium text-[#1B365D]">{dog.is_neutered ? 'Yes' : 'No'}</p>
                    </div>
                    {dog.temperament && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Temperament</p>
                        <p className="text-sm font-medium text-[#1B365D]">{dog.temperament}</p>
                      </div>
                    )}
                    {dog.care_instructions && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Care Instructions</p>
                        <p className="text-sm text-gray-700">{dog.care_instructions}</p>
                      </div>
                    )}
                    {dog.notes && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="text-sm text-gray-700">{dog.notes}</p>
                      </div>
                    )}
                  </div>

                  {dog.vaccinations && dog.vaccinations.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Vaccinations</p>
                      <div className="space-y-1.5">
                        {dog.vaccinations.map((vax) => {
                          const isExpired = vax.expires_at && new Date(vax.expires_at) < new Date();
                          return (
                            <div key={vax.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  isExpired ? 'bg-[#E8837B]' : vax.verified ? 'bg-[#7FB685]' : 'bg-[#F5C65D]'
                                }`} />
                                <span className="text-gray-700 capitalize">{vax.name.replace('_', ' ')}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {vax.expires_at && (
                                  <span className={isExpired ? 'text-[#E8837B] font-medium' : ''}>
                                    {isExpired ? 'Expired' : 'Exp'} {formatDate(vax.expires_at)}
                                  </span>
                                )}
                                {vax.verified && (
                                  <span className="text-[#5A9A62]">Verified</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {dog.vaccinations && dog.vaccinations.length === 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-1">Vaccinations</p>
                      <p className="text-sm text-gray-400 italic">No vaccination records on file</p>
                    </div>
                  )}

                  <button
                    onClick={() => handleOpenBehaviorNote(dog.id)}
                    className="px-3 py-2 text-sm font-medium text-[#1B365D] border border-[#1B365D]/20 rounded-lg hover:bg-[#1B365D]/5 transition-colors min-h-[40px]"
                  >
                    + Add Behavior Note
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Behavior Note Modal */}
      <Modal
        isOpen={showBehaviorNoteModal}
        onClose={handleCloseBehaviorNoteModal}
        title="Add Behavior Note"
      >
        <div>
          {behaviorNoteSuccess ? (
            <>
              <Alert variant="success" className="mb-4">Behavior note added successfully.</Alert>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleCloseBehaviorNoteModal}>Close</Button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-gray-600 text-sm mb-3">
                  Add a behavior note for{' '}
                  <span className="font-semibold">
                    {dogs.find((d) => d.id === behaviorNoteDogId)?.name || 'this dog'}
                  </span>
                </p>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                  <div className="flex gap-2">
                    {(['positive', 'concern', 'info'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setBehaviorNoteType(type)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors min-h-[40px] ${
                          behaviorNoteType === type
                            ? type === 'positive'
                              ? 'bg-[#7FB685]/15 text-[#5A9A62] border-2 border-[#7FB685]'
                              : type === 'concern'
                              ? 'bg-[#E8837B]/15 text-[#E8837B] border-2 border-[#E8837B]'
                              : 'bg-[#62A2C3]/15 text-[#4F8BA8] border-2 border-[#62A2C3]'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea
                    rows={4}
                    value={behaviorNoteText}
                    onChange={(e) => setBehaviorNoteText(e.target.value)}
                    placeholder="Describe the behavior observation..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleCloseBehaviorNoteModal}>Cancel</Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmitBehaviorNote}
                  isLoading={isSubmittingBehaviorNote}
                  disabled={!behaviorNoteText.trim()}
                >
                  Add Note
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
