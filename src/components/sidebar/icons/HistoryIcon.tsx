import React from 'react';

interface IconProps {
  active?: boolean;
  className?: string;
}

const HistoryIcon: React.FC<IconProps> = ({ active = false, className = '' }) => {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={active ? "#4F46E5" : "currentColor"} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
};

export default HistoryIcon;