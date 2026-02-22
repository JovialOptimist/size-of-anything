/**
 * Inline SVG icons used across the app (no emojis).
 */
import React from "react";

const iconClass = "creation-panel-inline-icon";

export function SearchIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

/** Circle shape for custom area segment control */
export function CircleShapeIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

/** Square shape for custom area segment control */
export function SquareShapeIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="1" />
    </svg>
  );
}

/** Info bubble (circle with "i") for empty states e.g. no search results */
export function InfoBubbleIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function BuildingIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

export function ParkIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22v-4" />
      <path d="M12 18a4 4 0 0 0 4-4V8" />
      <path d="M12 18a4 4 0 0 1-4-4V8" />
      <path d="M8 8v6a4 4 0 0 0 8 0V8" />
      <path d="M4 4h16v4H4z" />
    </svg>
  );
}

export function WaterIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22c5.5 0 10-4.5 10-10 0-4-6-10-10-14S2 8 2 12c0 5.5 4.5 10 10 10z" />
    </svg>
  );
}

export function PlaceIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function PinIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22v-8" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      <path d="M12 14V8" />
      <path d="M8 8h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2z" />
    </svg>
  );
}

export function RoadIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 18h16" />
      <path d="M4 14h16" />
      <path d="M4 10h6" />
      <path d="M14 10h6" />
      <path d="M4 6h3" />
      <path d="M17 6h3" />
      <path d="M10 6h4" />
    </svg>
  );
}

export function BoundaryIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

export function LanduseIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3h6v6H3z" />
      <path d="M15 3h6v6h-6z" />
      <path d="M3 15h6v6H3z" />
      <path d="M15 15h6v6h-6z" />
    </svg>
  );
}

export function LeisureIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export function SchoolIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m4 10 8-5 8 5" />
      <path d="M4 14v6h16v-6" />
      <path d="M4 14h16" />
      <path d="M12 14v6" />
    </svg>
  );
}

const LIST_ICONS: Record<string, React.FC<{ className?: string }>> = {
  building: BuildingIcon,
  park: ParkIcon,
  water: WaterIcon,
  place: PlaceIcon,
  road: RoadIcon,
  boundary: BoundaryIcon,
  landuse: LanduseIcon,
  leisure: LeisureIcon,
  school: SchoolIcon,
  other: PinIcon,
};

export function ListResultIcon({ type, className }: { type: string; className?: string }) {
  const Icon = LIST_ICONS[type] ?? PinIcon;
  return <Icon className={className} />;
}
