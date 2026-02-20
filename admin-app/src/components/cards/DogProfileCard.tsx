import { useNavigate } from 'react-router-dom';

interface DogProfileCardProps {
  dog: {
    id: string;
    name: string;
    breed: string | null;
    sizeCategory: string | null;
    photoUrl?: string | null;
  };
  ownerName: string;
  ownerId: string;
  vaccinationStatus?: 'current' | 'expiring' | 'expired';
  checkInTime?: string | null;
  onClick?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return timeStr;
  }
}

const vaccinationDot: Record<string, string> = {
  current: 'bg-[#7FB685]',
  expiring: 'bg-[#F5C65D]',
  expired: 'bg-[#E8837B]',
};

const vaccinationLabel: Record<string, string> = {
  current: 'Vaccines current',
  expiring: 'Vaccines expiring soon',
  expired: 'Vaccines expired',
};

export function DogProfileCard({
  dog,
  ownerName,
  ownerId,
  vaccinationStatus,
  checkInTime,
  onClick,
}: DogProfileCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/customers/${ownerId}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100
        hover:border-[#62A2C3]/30 hover:bg-[#62A2C3]/[0.03] transition-all text-left group"
    >
      {/* Avatar */}
      {dog.photoUrl ? (
        <img
          src={dog.photoUrl}
          alt={dog.name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#62A2C3]/25 to-[#62A2C3]/10 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-sm font-bold text-[#1B365D]">{getInitials(dog.name)}</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[#1B365D] truncate group-hover:text-[#62A2C3] transition-colors">
            {dog.name}
          </p>
          {vaccinationStatus && (
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${vaccinationDot[vaccinationStatus]}`}
              title={vaccinationLabel[vaccinationStatus]}
            />
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {[dog.breed, dog.sizeCategory].filter(Boolean).join(' \u00B7 ')}
        </p>
        <p className="text-xs text-gray-400 truncate">{ownerName}</p>
      </div>

      {/* Time */}
      {checkInTime && (
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400">{formatTime(checkInTime)}</p>
        </div>
      )}

      {/* Chevron */}
      <svg
        className="w-4 h-4 text-gray-300 group-hover:text-[#62A2C3] transition-colors flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
