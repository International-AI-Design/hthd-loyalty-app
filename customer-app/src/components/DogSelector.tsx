import type { Dog } from '../lib/api';

interface DogSelectorProps {
  dogs: Dog[];
  selectedDogIds: string[];
  onToggle: (dogId: string) => void;
  isLoading: boolean;
}

export function DogSelector({ dogs, selectedDogIds, onToggle, isLoading }: DogSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-teal" />
      </div>
    );
  }

  if (dogs.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-md">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <p className="mt-4 text-gray-500 font-medium">No dogs on your profile yet.</p>
        <p className="text-sm text-gray-400 mt-1">Add a dog from your dashboard to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {dogs.map((dog) => {
        const isSelected = selectedDogIds.includes(dog.id);
        return (
          <button
            key={dog.id}
            onClick={() => onToggle(dog.id)}
            className={`w-full rounded-2xl p-4 text-left transition-all min-h-[72px] ${
              isSelected
                ? 'bg-brand-teal/10 ring-2 ring-brand-teal shadow-md'
                : 'bg-white shadow-md hover:shadow-lg'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
                  isSelected ? 'bg-brand-teal' : 'bg-gray-300'
                }`}
              >
                {dog.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-brand-navy">{dog.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {dog.breed && <span className="text-sm text-gray-500">{dog.breed}</span>}
                  {dog.size_category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-brand-cream text-brand-navy capitalize">
                      {dog.size_category}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
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
        );
      })}
      <p className="text-center text-xs text-gray-400 mt-2">
        {selectedDogIds.length === 0
          ? 'Select at least one dog'
          : `${selectedDogIds.length} dog${selectedDogIds.length > 1 ? 's' : ''} selected`}
      </p>
    </div>
  );
}
