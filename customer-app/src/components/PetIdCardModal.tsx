import type { PetIdCard } from '../lib/api';

interface PetIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  idCard: PetIdCard;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  } catch {
    return 'N/A';
  }
}

function formatCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return 'N/A';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-8 h-8 rounded-full bg-brand-cream flex items-center justify-center flex-shrink-0 mt-0.5">
      {children}
    </div>
  );
}

export function PetIdCardModal({ isOpen, onClose, idCard }: PetIdCardModalProps) {
  if (!isOpen) return null;

  const alteredLabel = idCard.pet.alteredStatus === 'spayed'
    ? 'Spayed Female'
    : idCard.pet.alteredStatus === 'neutered'
    ? 'Neutered Male'
    : idCard.pet.alteredStatus === 'intact'
    ? 'Intact'
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative w-full sm:max-w-md max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-heading text-xl font-bold text-brand-navy">Pet ID Card</h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Pet Section */}
          <div className="flex gap-3">
            <SectionIcon>
              <svg className="w-4 h-4 text-brand-blue" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="7" cy="7" r="2" />
                <circle cx="17" cy="7" r="2" />
                <circle cx="5" cy="13" r="1.5" />
                <circle cx="19" cy="13" r="1.5" />
                <path d="M12 20c-2.5 0-4.5-2-4.5-4.5S9.5 11 12 11s4.5 2 4.5 4.5S14.5 20 12 20z" />
              </svg>
            </SectionIcon>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-lg font-bold text-brand-navy">{idCard.pet.name}</p>
              {idCard.pet.birthDate && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-brand-navy">D.O.B.:</span> {formatDate(idCard.pet.birthDate)}
                </p>
              )}
              {idCard.pet.breed && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-brand-navy">Breed:</span> {idCard.pet.breed}
                </p>
              )}
              {idCard.pet.color && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-brand-navy">Color:</span> {idCard.pet.color}
                </p>
              )}
              {alteredLabel && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-brand-navy">Sex:</span> {alteredLabel}
                </p>
              )}
              {idCard.pet.weight && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-brand-navy">Weight:</span> {idCard.pet.weight} lb
                </p>
              )}
              {idCard.pet.microchipNumber && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-brand-navy">Microchip:</span> {idCard.pet.microchipNumber}
                </p>
              )}
              {idCard.pet.allergies && (
                <p className="text-sm text-brand-coral">
                  <span className="font-medium">Allergies:</span> {idCard.pet.allergies}
                </p>
              )}
              {idCard.pet.specialNeeds && (
                <p className="text-sm text-brand-coral">
                  <span className="font-medium">Special Needs:</span> {idCard.pet.specialNeeds}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Owner Section */}
          <div className="flex gap-3">
            <SectionIcon>
              <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </SectionIcon>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-brand-navy">{idCard.owner.name}</p>
              {idCard.owner.phone && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-brand-navy">Phone:</span>{' '}
                  <a href={`tel:${idCard.owner.phone}`} className="text-brand-blue hover:underline">{idCard.owner.phone}</a>
                </p>
              )}
              {idCard.owner.email && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-brand-navy">Email:</span>{' '}
                  <a href={`mailto:${idCard.owner.email}`} className="text-brand-blue hover:underline">{idCard.owner.email}</a>
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Vet Section */}
          {(idCard.vet.name || idCard.vet.phone) && (
            <>
              <div className="flex gap-3">
                <SectionIcon>
                  <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </SectionIcon>
                <div className="flex-1 min-w-0">
                  {idCard.vet.name && <p className="font-semibold text-brand-navy">{idCard.vet.name}</p>}
                  {idCard.vet.phone && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-brand-navy">Phone:</span>{' '}
                      <a href={`tel:${idCard.vet.phone}`} className="text-brand-blue hover:underline">{idCard.vet.phone}</a>
                    </p>
                  )}
                  {idCard.vet.email && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-brand-navy">Email:</span>{' '}
                      <a href={`mailto:${idCard.vet.email}`} className="text-brand-blue hover:underline">{idCard.vet.email}</a>
                    </p>
                  )}
                  {idCard.vet.address && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-brand-navy">Address:</span> {idCard.vet.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-100" />
            </>
          )}

          {/* Emergency Agent Section */}
          {idCard.emergencyAgent.name && (
            <>
              <div className="flex gap-3">
                <SectionIcon>
                  <svg className="w-4 h-4 text-brand-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </SectionIcon>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-brand-coral uppercase tracking-wide mb-0.5">Emergency Contact</p>
                  <p className="font-semibold text-brand-navy">{idCard.emergencyAgent.name}</p>
                  {idCard.emergencyAgent.relationship && (
                    <p className="text-sm text-gray-600">{idCard.emergencyAgent.relationship}</p>
                  )}
                  {idCard.emergencyAgent.phone && (
                    <p className="text-sm text-gray-600">
                      <a href={`tel:${idCard.emergencyAgent.phone}`} className="text-brand-blue hover:underline">{idCard.emergencyAgent.phone}</a>
                    </p>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-100" />
            </>
          )}

          {/* Emergency Vet Cost Limit */}
          {idCard.emergencyVet.costLimit && (
            <>
              <div className="bg-brand-cream rounded-xl p-3">
                <p className="text-sm text-brand-navy">
                  <span className="font-semibold">Emergency Vet Authorization:</span> Up to {formatCurrency(idCard.emergencyVet.costLimit)}
                </p>
                {idCard.emergencyVet.name && (
                  <p className="text-sm text-gray-600 mt-1">
                    Emergency Vet: {idCard.emergencyVet.name}
                    {idCard.emergencyVet.phone && (
                      <> &middot; <a href={`tel:${idCard.emergencyVet.phone}`} className="text-brand-blue hover:underline">{idCard.emergencyVet.phone}</a></>
                    )}
                  </p>
                )}
              </div>
              <div className="border-t border-gray-100" />
            </>
          )}

          {/* Medical History / Vaccinations */}
          <div>
            <h3 className="font-heading text-lg font-bold text-brand-navy mb-3">Medical History</h3>
            {idCard.vaccinations.length > 0 ? (
              <div className="space-y-3">
                {idCard.vaccinations.map((vax, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-brand-navy text-sm">{vax.name}</p>
                      {vax.vetName && <p className="text-xs text-gray-500">{vax.vetName}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {vax.goodUntil && (
                        <p className="text-xs text-brand-soft-green font-medium">Good until</p>
                      )}
                      <p className="text-sm text-gray-700">{formatDate(vax.goodUntil || vax.dateGiven)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No verified vaccination records</p>
            )}
          </div>
        </div>

        {/* Footer with Share button */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${idCard.pet.name}'s Pet ID Card`,
                  text: `Pet ID Card for ${idCard.pet.name} (${idCard.pet.breed || 'Unknown breed'})`,
                });
              }
            }}
            className="w-full bg-brand-blue text-white font-semibold py-3 px-6 rounded-xl
              hover:bg-brand-blue/90 transition-colors min-h-[48px] flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Send ID Card
          </button>
        </div>
      </div>
    </div>
  );
}
