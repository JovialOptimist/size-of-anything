import { useState, useEffect } from "react";
import "../../styles/Feedback.css";

type FeedbackType = "major-bug" | "minor-bug" | "feature-request";

interface FeedbackModalProps {
  onClose: () => void;
}

export default function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("minor-bug");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Close modal when escape key is pressed
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Handle click outside modal to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Format data for Netlify forms
      const formData = new FormData();
      formData.append("form-name", "feedback");
      formData.append("feedbackType", feedbackType);
      formData.append("details", details);
      formData.append("email", email);

      // Submit the form data to Netlify
      const response = await fetch("/", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSuccess(true);
        // Close modal after 3 seconds on success
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        throw new Error(`Form submission failed: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      setError("Something went wrong submitting your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getButtonLabel = () => {
    if (submitting) return "Submitting...";
    if (success) return "Thanks for your feedback!";
    return "Submit Feedback";
  };

  return (
    <div className="feedback-modal-backdrop" onClick={handleBackdropClick}>
      <div className="feedback-modal">
        <button className="feedback-close-button" onClick={onClose}>
          ×
        </button>
        <h2>Give Feedback</h2>
        
        {!success ? (
          <form onSubmit={handleSubmit} data-netlify="true" name="feedback">
            {/* Hidden input for Netlify form name */}
            <input type="hidden" name="form-name" value="feedback" />
            
            <div className="feedback-form-group">
              <label className="feedback-label">Feedback Type</label>
              <div className="feedback-radio-group">
                <label>
                  <input
                    type="radio"
                    name="feedbackType"
                    value="major-bug"
                    checked={feedbackType === "major-bug"}
                    onChange={() => setFeedbackType("major-bug")}
                  />
                  Major Bug
                </label>
                <label>
                  <input
                    type="radio"
                    name="feedbackType"
                    value="minor-bug"
                    checked={feedbackType === "minor-bug"}
                    onChange={() => setFeedbackType("minor-bug")}
                  />
                  Minor Bug
                </label>
                <label>
                  <input
                    type="radio"
                    name="feedbackType"
                    value="feature-request"
                    checked={feedbackType === "feature-request"}
                    onChange={() => setFeedbackType("feature-request")}
                  />
                  Feature Request
                </label>
              </div>
            </div>

            <div className="feedback-form-group">
              <label htmlFor="feedback-details" className="feedback-label">
                Details <span className="required">*</span>
              </label>
              <textarea
                id="feedback-details"
                name="details"
                rows={5}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Please describe your feedback in detail..."
                required
              ></textarea>
            </div>

            <div className="feedback-form-group">
              <label htmlFor="feedback-email" className="feedback-label">
                Email (optional)
              </label>
              <input
                type="email"
                id="feedback-email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email if you'd like us to follow up"
              />
            </div>

            {error && <div className="feedback-error">{error}</div>}

            <div className="feedback-actions">
              <button type="button" onClick={onClose} className="feedback-cancel-btn">
                Cancel
              </button>
              <button 
                type="submit" 
                className="feedback-submit-btn"
                disabled={submitting || success || !details.trim()}
              >
                {getButtonLabel()}
              </button>
            </div>
          </form>
        ) : (
          <div className="feedback-success">
            <p>Thank you for your feedback! Your input helps us improve the application.</p>
          </div>
        )}
      </div>
    </div>
  );
}