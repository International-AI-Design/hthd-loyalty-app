import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportCardApi, customerApi } from '../lib/api';
import type { Dog } from '../lib/api';

interface ReportCardPhoto {
  id: string;
  url: string;
  caption: string | null;
}

interface ReportCard {
  id: string;
  dogId: string;
  dogName: string;
  date: string;
  moodEmoji: string | null;
  rating: number | null;
  activities: string[];
  meals: string | null;
  socialBehavior: string | null;
  notes: string | null;
  staffName: string | null;
  photos: ReportCardPhoto[];
}

export function ReportCardsPage() {
  const navigate = useNavigate();

  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDogId, setSelectedDogId] = useState<string>('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);

  const fetchReportCards = useCallback(async () => {
    setIsLoading(true);
    const { data, error: fetchErr } = await reportCardApi.getReportCards(50);
    if (fetchErr) {
      setError(fetchErr);
    } else if (data) {
      const cards = Array.isArray(data) ? data : (data as any).reportCards || [];
      setReportCards(cards);
    }
    setIsLoading(false);
  }, []);

  const fetchDogs = useCallback(async () => {
    const { data } = await customerApi.getDogs();
    if (data) {
      setDogs(data.dogs);
    }
  }, []);

  useEffect(() => {
    fetchReportCards();
    fetchDogs();
  }, [fetchReportCards, fetchDogs]);

  // Filter by dog
  const filteredCards = selectedDogId === 'all'
    ? reportCards
    : reportCards.filter((c) => c.dogId === selectedDogId);

  // Group by date
  const groupedByDate = filteredCards.reduce<Record<string, ReportCard[]>>((groups, card) => {
    const dateKey = card.date.split('T')[0];
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(card);
    return groups;
  }, {});

  // Sort dates most recent first
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatShortDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-brand-golden-yellow' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    );
  };

  const getMoodDisplay = (emoji: string | null) => {
    if (!emoji) return null;
    const moodMap: Record<string, string> = {
      happy: 'Happy',
      excited: 'Excited',
      calm: 'Calm',
      playful: 'Playful',
      tired: 'Tired',
      anxious: 'Anxious',
    };
    return moodMap[emoji] || emoji;
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
          <h1 className="font-heading text-xl font-bold text-brand-navy">Report Cards</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* Dog Filter */}
        {dogs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            <button
              onClick={() => setSelectedDogId('all')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
                selectedDogId === 'all'
                  ? 'bg-brand-blue text-white'
                  : 'bg-white text-brand-navy border border-brand-light-gray hover:bg-brand-cream'
              }`}
            >
              All Dogs
            </button>
            {dogs.map((dog) => (
              <button
                key={dog.id}
                onClick={() => setSelectedDogId(dog.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
                  selectedDogId === dog.id
                    ? 'bg-brand-blue text-white'
                    : 'bg-white text-brand-navy border border-brand-light-gray hover:bg-brand-cream'
                }`}
              >
                {dog.name}
              </button>
            ))}
          </div>
        )}

        {/* Report Cards */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto bg-brand-cream rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-semibold text-brand-navy mb-2">No Report Cards Yet</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              After your pup's next visit, you'll find their daily report card here with activities, meals, and fun updates from our team!
            </p>
          </div>
        ) : (
          sortedDates.map((dateKey) => (
            <div key={dateKey}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-blue rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{formatShortDate(dateKey)}</span>
                </div>
                <h2 className="font-heading text-base font-semibold text-brand-navy">{formatDate(dateKey)}</h2>
              </div>

              <div className="space-y-3 ml-5 border-l-2 border-brand-cream pl-8 pb-6">
                {groupedByDate[dateKey].map((card) => {
                  const isExpanded = expandedCardId === card.id;
                  return (
                    <div key={card.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      {/* Card Header - always visible */}
                      <button
                        onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                        className="w-full p-4 text-left min-h-[64px]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-brand-cream rounded-full flex items-center justify-center flex-shrink-0">
                              {card.moodEmoji ? (
                                <span className="text-lg">{card.moodEmoji}</span>
                              ) : (
                                <span className="text-brand-blue font-bold">{card.dogName.charAt(0)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-brand-navy">{card.dogName}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {card.rating !== null && renderStars(card.rating)}
                                {card.moodEmoji && (
                                  <span className="text-xs text-gray-500">{getMoodDisplay(card.moodEmoji)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Summary tags when collapsed */}
                        {!isExpanded && card.activities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {card.activities.slice(0, 3).map((activity, idx) => (
                              <span key={idx} className="bg-brand-cream text-brand-navy text-xs px-2 py-0.5 rounded-full">
                                {activity}
                              </span>
                            ))}
                            {card.activities.length > 3 && (
                              <span className="text-xs text-gray-400">+{card.activities.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                          {/* Activities */}
                          {card.activities.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Activities</h4>
                              <div className="flex flex-wrap gap-2">
                                {card.activities.map((activity, idx) => (
                                  <span key={idx} className="bg-brand-cream text-brand-navy text-sm px-3 py-1 rounded-full font-medium">
                                    {activity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Meals */}
                          {card.meals && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Meals</h4>
                              <p className="text-sm text-gray-700">{card.meals}</p>
                            </div>
                          )}

                          {/* Social Behavior */}
                          {card.socialBehavior && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Social Behavior</h4>
                              <p className="text-sm text-gray-700">{card.socialBehavior}</p>
                            </div>
                          )}

                          {/* Notes */}
                          {card.notes && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes from Staff</h4>
                              <div className="bg-brand-cream rounded-xl p-3">
                                <p className="text-sm text-gray-700">{card.notes}</p>
                                {card.staffName && (
                                  <p className="text-xs text-gray-500 mt-1">-- {card.staffName}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Photos */}
                          {card.photos && card.photos.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photos</h4>
                              <div className="grid grid-cols-3 gap-2">
                                {card.photos.map((photo) => (
                                  <button
                                    key={photo.id}
                                    onClick={() => setPhotoModalUrl(photo.url)}
                                    className="aspect-square rounded-xl overflow-hidden bg-brand-cream"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={photo.caption || `${card.dogName} photo`}
                                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Photo Lightbox Modal */}
      {photoModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPhotoModalUrl(null)}
        >
          <button
            onClick={() => setPhotoModalUrl(null)}
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/80 hover:text-white"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={photoModalUrl}
            alt="Report card photo"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
