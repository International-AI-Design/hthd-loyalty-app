interface ServiceOption {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceLabel: string;
  icon: React.ReactNode;
}

interface ServiceSelectorProps {
  onSelect: (serviceId: string, serviceName: string) => void;
  selectedId: string | null;
}

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    id: 'daycare-half',
    name: 'daycare',
    displayName: 'Daycare (Half Day)',
    description: '4 hours of play & enrichment with our loving team',
    priceLabel: '$37',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  {
    id: 'daycare-full',
    name: 'daycare',
    displayName: 'Daycare (Full Day)',
    description: '8+ hours with enrichment activities and rest time',
    priceLabel: '$47',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  {
    id: 'boarding',
    name: 'boarding',
    displayName: 'Boarding',
    description: 'Kennel-free overnight stay with 24-hour attentive care',
    priceLabel: '$69/night',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    id: 'grooming',
    name: 'grooming',
    displayName: 'Grooming',
    description: 'Bath & haircut by our skilled groomers',
    priceLabel: 'From $95',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.696.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 012.068-1.379l5.325-1.628a4.5 4.5 0 012.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.331 4.331 0 0010.607 12m3.736 0l7.794 4.5-.802.215a4.5 4.5 0 01-2.48-.043l-5.326-1.629a4.324 4.324 0 01-2.068-1.379M14.343 12l-2.882 1.664" />
      </svg>
    ),
  },
  {
    id: 'walking',
    name: 'walking',
    displayName: 'Dog Walking',
    description: '30-60 minute walks through Denver neighborhoods',
    priceLabel: 'Contact us',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    id: 'hiking',
    name: 'hiking',
    displayName: 'Hiking Adventures',
    description: 'Mountain trail adventures for active pups',
    priceLabel: 'Contact us',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l5.25-10.5L12 15l3.75-7.5L21 21M3 21h18" />
      </svg>
    ),
  },
];

export function ServiceSelector({ onSelect, selectedId }: ServiceSelectorProps) {
  return (
    <div className="space-y-3">
      {SERVICE_OPTIONS.map((service) => {
        const isSelected = selectedId === service.id;
        return (
          <button
            key={service.id}
            onClick={() => onSelect(service.id, service.name)}
            className={`w-full rounded-2xl p-5 text-left transition-all min-h-[88px] ${
              isSelected
                ? 'bg-brand-teal/10 ring-2 ring-brand-teal shadow-lg'
                : 'bg-white shadow-md hover:shadow-lg hover:ring-2 hover:ring-brand-teal/50'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-brand-teal text-white' : 'bg-brand-cream text-brand-teal'
              }`}>
                {service.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-lg font-bold text-brand-navy">{service.displayName}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{service.description}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-lg font-bold text-brand-teal">{service.priceLabel}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { SERVICE_OPTIONS };
export type { ServiceOption };
