import React from 'react';

interface IconProps {
  active?: boolean;
  className?: string;
}

const HelpIcon: React.FC<IconProps> = ({ active = false, className = '' }) => {
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
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
};

export default HelpIcon;