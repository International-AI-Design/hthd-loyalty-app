import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { customerApi } from '../lib/api';
import type { Dog } from '../lib/api';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui';

const SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'X-Large',
};

const SIZE_ICONS: Record<string, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  xlarge: 'XL',
};

function getAvatarGradient(name: string): string {
  const gradients = [
    'from-brand-primary to-brand-primary-dark',
    'from-brand-sage to-brand-sage-dark',
    'from-brand-amber to-brand-amber-dark',
    'from-brand-primary-light to-brand-primary',
    'from-brand-sage-light to-brand-sage',
    'from-brand-amber-light to-brand-amber',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate + 'T00:00:00');
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;

  if (totalMonths < 1) return 'Puppy';
  if (totalMonths < 12) return `${totalMonths}mo`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (m === 0) return `${y}yr${y > 1 ? 's' : ''}`;
  return `${y}yr ${m}mo`;
}

export function MyPetsPage() {
  const { customer } = useAuth();
  const navigate = useNavigate();

  const [dogs, setDogs] = useState<Dog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDogs = useCallback(async () => {
    const { data } = await customerApi.getDogs();
    if (data) {
      setDogs(data.dogs);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDogs();
  }, [fetchDogs]);

  if (!customer) return null;

  return (
    <AppShell title="My Pets">
      <div className="px-4 pt-6 pb-8 space-y-6">
        {/* Header area with count + add button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-brand-forest">
              Your Pups
            </h2>
            {!isLoading && dogs.length > 0 && (
              <p className="text-sm text-brand-forest-muted mt-0.5">
                {dogs.length} {dogs.length === 1 ? 'pet' : 'pets'} registered
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/book')}
            className="flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Pet
          </Button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full border-3 border-brand-sand border-t-brand-primary animate-spin" />
            <p className="text-sm text-brand-forest-muted mt-4">Loading your pets...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && dogs.length === 0 && (
          <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-8 text-center">
            {/* Paw illustration placeholder */}
            <div className="w-24 h-24 mx-auto mb-6 bg-brand-cream rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-brand-primary/60" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="7" cy="7" r="2.5" />
                <circle cx="17" cy="7" r="2.5" />
                <circle cx="4.5" cy="13" r="2" />
                <circle cx="19.5" cy="13" r="2" />
                <path d="M12 21c-3 0-5.5-2.5-5.5-5.5S9 10 12 10s5.5 2.5 5.5 5.5S15 21 12 21z" />
              </svg>
            </div>
            <h3 className="font-heading text-xl font-semibold text-brand-forest mb-2">
              No pets yet
            </h3>
            <p className="text-brand-forest-muted text-sm leading-relaxed max-w-xs mx-auto mb-6">
              Add your first furry friend when you book an appointment. We will keep track of all their info here.
            </p>
            <Button onClick={() => navigate('/book')} className="mx-auto">
              Book Your First Visit
            </Button>
          </div>
        )}

        {/* Pet cards grid */}
        {!isLoading && dogs.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {dogs.map((dog, index) => (
              <button
                key={dog.id}
                onClick={() => navigate(`/dogs/${dog.id}`)}
                className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5 text-left
                  hover:shadow-warm-lg hover:border-brand-primary/20 transition-all duration-200
                  active:scale-[0.98] min-h-[88px] group"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar with first letter */}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(dog.name)}
                    flex items-center justify-center flex-shrink-0 shadow-warm-sm
                    group-hover:shadow-glow transition-shadow duration-200`}
                  >
                    <span className="text-white font-heading font-bold text-xl">
                      {dog.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Pet info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-pet text-lg font-bold text-brand-forest truncate">
                      {dog.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {dog.breed && (
                        <span className="text-sm text-brand-forest-light truncate">
                          {dog.breed}
                        </span>
                      )}
                      {dog.breed && (dog.size_category || dog.birth_date) && (
                        <span className="text-brand-forest-muted/40">|</span>
                      )}
                      {dog.birth_date && (
                        <span className="text-sm text-brand-forest-muted">
                          {calculateAge(dog.birth_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Size badge + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {dog.size_category && (
                      <div className="flex flex-col items-center">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl
                          bg-brand-sand/60 text-brand-forest-light text-xs font-bold">
                          {SIZE_ICONS[dog.size_category] || dog.size_category.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-brand-forest-muted mt-0.5">
                          {SIZE_LABELS[dog.size_category] || dog.size_category}
                        </span>
                      </div>
                    )}
                    <svg
                      className="w-5 h-5 text-brand-forest-muted/50 group-hover:text-brand-primary transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>

                {/* Notes preview if present */}
                {dog.notes && (
                  <div className="mt-3 pt-3 border-t border-brand-sand/30">
                    <p className="text-xs text-brand-forest-muted line-clamp-1">
                      <span className="font-medium text-brand-forest-light">Note:</span> {dog.notes}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Add pet CTA at bottom when dogs exist */}
        {!isLoading && dogs.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => navigate('/book')}
              className="w-full border-2 border-dashed border-brand-sand hover:border-brand-primary/40
                rounded-3xl p-5 flex items-center justify-center gap-3 text-brand-forest-muted
                hover:text-brand-primary transition-all duration-200 min-h-[64px]
                hover:bg-brand-primary/5 active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-cream flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="font-medium text-sm">Add another pet during booking</span>
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
