import React from "react";

interface IconProps {
  active?: boolean;
  className?: string;
}

const DiamondIcon: React.FC<IconProps> = ({
  active = false,
  className = "",
}) => {
  return (
    <svg
      width="62"
      height="70"
      viewBox="0 -5 62 70"
      fill="none"
      stroke={active ? "#4F46E5" : "currentColor"}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Diamond outline */}
      <path d="M62,18 L31,60 L0,18 L10.7,0 L51.3,0 L62,18 Z" />
      <path d="M0,18 L62,18" />
      <path d="M21.5,0 L15.5,18 L31,58.8" />
      <path d="M40.5,0 L46.5,18 L31,58.8" />
    </svg>
  );
};

export default DiamondIcon;
