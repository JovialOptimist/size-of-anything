import React from "react";

interface IconProps {
  active?: boolean;
  className?: string;
}

const CustomAreaIcon: React.FC<IconProps> = ({
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
      <polygon points="5,5 19,5 19,19 5,19" />
    </svg>
  );
};

export default CustomAreaIcon;
