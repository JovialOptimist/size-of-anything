// src/state/messageStore.ts
/**
 * Store for managing messages in the application.
 * Handles persistent storage of dismissed message IDs and toast notifications.
 */
import { create } from "zustand";

// Key for storing dismissed messages in localStorage
const DISMISSED_MESSAGES_KEY = "sizeOfAnything_dismissedMessages";

// Toast message type
export type ToastType = 'info' | 'success' | 'error' | 'warning';

// Toast message data
interface Toast {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
}

interface MessageState {
  // Set of dismissed message IDs
  dismissedMessageIds: Set<string>;
  
  // Active toast messages
  toasts: Toast[];

  // Check if a specific message has been dismissed
  isMessageDismissed: (messageId: string) => boolean;

  // Mark a message as dismissed
  dismissMessage: (messageId: string) => void;

  // Reset all dismissed messages (make them show again)
  resetAllMessages: () => void;
  
  // Show a toast message
  showMessage: (message: string, type: ToastType) => void;
  
  // Remove a toast message
  removeMessage: (id: string) => void;
  
  // Clear all toast messages
  clearMessages: () => void;
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

// Generate a unique ID for toast messages
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const useMessage = create<MessageState>((set, get) => ({
  dismissedMessageIds: loadDismissedMessages(),
  toasts: [],

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
  
  showMessage: (message: string, type: ToastType = 'info') => {
    const toast: Toast = {
      id: generateId(),
      message,
      type,
      timestamp: Date.now(),
    };
    
    set((state) => ({ 
      toasts: [...state.toasts, toast] 
    }));
    
    // Auto-remove toast after a timeout
    setTimeout(() => {
      get().removeMessage(toast.id);
    }, 5000); // 5 seconds
  },
  
  removeMessage: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter(toast => toast.id !== id)
    }));
  },
  
  clearMessages: () => {
    set({ toasts: [] });
  }
}));

// For backward compatibility
export const useMessageStore = useMessage;
