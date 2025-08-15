// src/components/map/ShareButton.tsx
/**
 * Button component that enables sharing the current map state.
 * Generates and copies a shareable link with the current view and selected areas.
 */
import { useState } from "react";
import { generateShareableLink } from "../../state/urlSync";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Handle share button click
  const handleShare = async () => {
    try {
      const shareableLink = generateShareableLink();
      await navigator.clipboard.writeText(shareableLink);

      // Show copied confirmation
      setCopied(true);
      setShowTooltip(true);
      let shouldAlert = localStorage.getItem("openedShare");
      if (!shouldAlert) {
        alert(
          "For now, the share button just copies the URL. In the future, it will copy all of your comparisons to make for easy exporting and showing to your friends!"
        );
        localStorage.setItem("openedShare", "true");
      }

      // Hide after 3 seconds
      setTimeout(() => {
        setCopied(false);
        setShowTooltip(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <div className="share-button-container ">
      <button
        className="share-button map-controls icon-button"
        onClick={handleShare}
        aria-label="Share link"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => !copied && setShowTooltip(false)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      </button>
      {showTooltip && (
        <div className={`tooltip ${copied ? "success" : ""}`}>
          {copied ? "Link copied!" : "Share link"}
        </div>
      )}
    </div>
  );
}
