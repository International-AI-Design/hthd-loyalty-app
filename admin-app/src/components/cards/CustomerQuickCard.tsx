import { useNavigate } from 'react-router-dom';

interface CustomerQuickCardProps {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    pointsBalance: number;
    dogsCount?: number;
    lastVisit?: string | null;
  };
  onMessage?: () => void;
  onViewProfile?: () => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function CustomerQuickCard({ customer, onMessage, onViewProfile }: CustomerQuickCardProps) {
  const navigate = useNavigate();
  const fullName = `${customer.firstName} ${customer.lastName}`;

  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile();
    } else {
      navigate(`/customers/${customer.id}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-[#1B365D]">{fullName}</h3>
          <p className="text-xs text-gray-500">{customer.email}</p>
          {customer.phone && (
            <p className="text-xs text-gray-500">{customer.phone}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5C65D]/20">
          <svg className="w-3.5 h-3.5 text-[#D4A843]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0114 15a3.989 3.989 0 01-3.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.917l-1.763.665 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 016 15a3.989 3.989 0 01-3.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
          </svg>
          <span className="text-xs font-bold text-[#B8941F]">
            {customer.pointsBalance.toLocaleString()} pts
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-gray-500">
        {customer.dogsCount !== undefined && (
          <span>{customer.dogsCount} dog{customer.dogsCount !== 1 ? 's' : ''}</span>
        )}
        {customer.lastVisit && (
          <span>Last visit: {formatDate(customer.lastVisit)}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
              border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors min-h-[36px]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call
          </a>
        )}
        {onMessage && (
          <button
            onClick={onMessage}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
              border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors min-h-[36px]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Message
          </button>
        )}
        <button
          onClick={handleViewProfile}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
            bg-[#62A2C3] text-white hover:bg-[#4F8BA8] transition-colors min-h-[36px]"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
