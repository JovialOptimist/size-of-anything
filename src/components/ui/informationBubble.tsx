import React, { useState } from "react";

interface InformationBubbleProps {
  message: string;
}

export const InformationBubble: React.FC<InformationBubbleProps> = ({
  message,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        aria-label="Show information"
        className="info-bubble-button"
      >
        i
      </button>
      {open && (
        <div className="info-bubble">
          <div style={{ marginBottom: 8 }} className="info-bubble-message">
            {message}
          </div>
          <button onClick={() => setOpen(false)} className="info-bubble-close">
            Close
          </button>
        </div>
      )}
    </div>
  );
};
