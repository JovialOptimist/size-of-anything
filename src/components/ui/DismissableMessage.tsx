import React, { useState } from 'react';
import { useMessageStore } from '../../state/messageStore';

interface DismissableMessageProps {
  messageId: string;
  children: React.ReactNode;
  className?: string;
}

export const DismissableMessage: React.FC<DismissableMessageProps> = ({
  messageId,
  children,
  className = '',
}) => {
  const { isMessageDismissed, dismissMessage } = useMessageStore();
  const [isDismissing, setIsDismissing] = useState(false);

  // Don't render if the message has been dismissed
  if (isMessageDismissed(messageId)) {
    return null;
  }

  // Handle animation end
  const handleAnimationEnd = () => {
    // Only now actually dismiss the message in the store
    dismissMessage(messageId);
  };

  // Handle dismiss click
  const handleDismiss = () => {
    setIsDismissing(true);
    // The actual dismissMessage will be called after animation completes
  };

  return (
    <div 
      className={`custom-area-info ${className} ${isDismissing ? 'dismissing' : ''}`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="message-content">
        {children}
      </div>
      <div className="dismiss-button-container">
        <button 
          onClick={handleDismiss}
          className="dismiss-message-btn"
          aria-label="Dismiss message"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};