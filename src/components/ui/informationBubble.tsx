// src/components/ui/informationBubble.tsx
/**
 * Information bubble component that displays help text when clicked.
 * Provides context or explanations for UI elements.
 */
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
        tabIndex={0}
      >
        i
      </button>
      {open && (
        <div className="info-bubble info-bubble-left">
          <div style={{ marginBottom: 8 }} className="info-bubble-message">
            {message}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="info-bubble-close"
            tabIndex={0}
          >
            Got it!
          </button>
        </div>
      )}
    </div>
  );
};
