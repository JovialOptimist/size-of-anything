import { useState } from "react";
import FeedbackModal from "../ui/FeedbackModal";
import "../../styles/Feedback.css";

export default function FeedbackButton() {
  const [showModal, setShowModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Handle feedback button click
  const handleClick = () => {
    setShowModal(true);
  };

  return (
    <>
      <div
        className="feedback-button-container"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          className="feedback-button map-controls icon-button"
          onClick={handleClick}
          aria-label="Give feedback"
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
        {showTooltip && <div className={`tooltip`}>{"Give feedback"}</div>}
      </div>
      {showModal && <FeedbackModal onClose={() => setShowModal(false)} />}
    </>
  );
}
