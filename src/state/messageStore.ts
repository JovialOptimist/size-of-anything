import { create } from "zustand";

// Key for storing dismissed messages in localStorage
const DISMISSED_MESSAGES_KEY = "sizeOfAnything_dismissedMessages";

interface MessageState {
  // Set of dismissed message IDs
  dismissedMessageIds: Set<string>;

  // Check if a specific message has been dismissed
  isMessageDismissed: (messageId: string) => boolean;

  // Mark a message as dismissed
  dismissMessage: (messageId: string) => void;

  // Reset all dismissed messages (make them show again)
  resetAllMessages: () => void;
}

// Load dismissed messages from localStorage
const loadDismissedMessages = (): Set<string> => {
  if (typeof window === "undefined") return new Set(); // For SSR safety

  const savedMessages = localStorage.getItem(DISMISSED_MESSAGES_KEY);
  if (savedMessages) {
    try {
      return new Set(JSON.parse(savedMessages));
    } catch (e) {
      console.error("Failed to parse dismissed messages from localStorage:", e);
      localStorage.removeItem(DISMISSED_MESSAGES_KEY);
    }
  }
  return new Set();
};

// Save dismissed messages to localStorage
const saveDismissedMessages = (messageIds: Set<string>) => {
  if (typeof window === "undefined") return; // For SSR safety
  localStorage.setItem(
    DISMISSED_MESSAGES_KEY,
    JSON.stringify(Array.from(messageIds))
  );
};

export const useMessageStore = create<MessageState>((set, get) => ({
  dismissedMessageIds: loadDismissedMessages(),

  isMessageDismissed: (messageId: string) => {
    return get().dismissedMessageIds.has(messageId);
  },

  dismissMessage: (messageId: string) => {
    const updatedMessageIds = new Set(get().dismissedMessageIds);
    updatedMessageIds.add(messageId);

    // Save to localStorage
    saveDismissedMessages(updatedMessageIds);

    // Update state
    set({ dismissedMessageIds: updatedMessageIds });
  },

  resetAllMessages: () => {
    localStorage.removeItem(DISMISSED_MESSAGES_KEY);
    set({ dismissedMessageIds: new Set() });
  },
}));
