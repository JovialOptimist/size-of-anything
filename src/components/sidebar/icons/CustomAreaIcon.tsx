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
      viewBox="2 4 20 20"
      fill="none"
      stroke={active ? "#4F46E5" : "currentColor"}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <defs>
        <mask id="inverted-clip">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <polygon points="7,12 17,12 17,22 7,22" fill="black" />
        </mask>
      </defs>
      <polygon points="7,12 17,12 17,22 7,22" fill="none" />
      <circle cx="17" cy="12" r="4" mask="url(#inverted-clip)" />
      <polygon
        points="7,8 12,16 3,16"
        mask="url(#inverted-clip)"
        fill="none"
        stroke={active ? "#4F46E5" : "currentColor"}
      />
    </svg>
  );
};

export default CustomAreaIcon;
