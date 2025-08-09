import React from "react";

interface IconProps {
  active?: boolean;
  className?: string;
}

const MagicWandIcon: React.FC<IconProps> = ({
  active = false,
  className = "",
}) => {
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
      {/* Wand */}
      <line x1="18" y1="6" x2="6" y2="18" />
      {/* Stars */}
      <path d="M8 2 L9 4 L7 4 Z" />
      <path d="M16 19 L17 21 L15 21 Z" />
      <path d="M21 13 L19 14 L19 12 Z" />
    </svg>
  );
};

export default MagicWandIcon;
