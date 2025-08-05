import React, { useState } from "react";

interface InformationBubbleProps {
  message: string;
}

export const InformationBubble: React.FC<InformationBubbleProps> = ({
  message,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="info-bubble-container">
      <button
        onClick={() => setOpen(true)}
        aria-label="Show information"
        className="info-bubble-button"
      >
        i
      </button>
      {open && (
        <div className="info-bubble info-bubble-left">
          <div style={{ marginBottom: 8 }} className="info-bubble-message">
            {message}
          </div>
          <button onClick={() => setOpen(false)} className="info-bubble-close">
            Got it!
          </button>
        </div>
      )}
    </div>
  );
};
