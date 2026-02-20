import { Badge } from '../ui/Badge';

interface StaffProfileCardProps {
  staff: {
    id: string;
    name: string;
    role: string;
    shiftStart: string;
    shiftEnd: string;
  };
  dogCount?: number;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '--:--';
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return timeStr;
  }
}

const roleBadgeVariants: Record<string, string> = {
  manager: 'active',
  groomer: 'confirmed',
  general: 'pending',
  kennel_tech: 'checked_in',
};

export function StaffProfileCard({ staff, dogCount }: StaffProfileCardProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#62A2C3]/25 to-[#1B365D]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#1B365D]">{getInitials(staff.name)}</span>
        </div>

        {/* Info */}
        <div>
          <p className="text-sm font-medium text-gray-900">{staff.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={roleBadgeVariants[staff.role] ?? 'closed'}>
              {staff.role.replace('_', ' ')}
            </Badge>
            {dogCount !== undefined && (
              <span className="text-xs text-gray-400">
                {dogCount} dog{dogCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Shift time */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm text-gray-600">
          {formatTime(staff.shiftStart)} - {formatTime(staff.shiftEnd)}
        </p>
      </div>
    </div>
  );
}
