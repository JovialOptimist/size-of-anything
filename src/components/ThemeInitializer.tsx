import { useEffect } from "react";
import { useSettings, applyTheme } from "../state/settingsStore";

/**
 * Component that initializes and applies settings when the app loads
 * This ensures settings are applied before the UI fully renders
 */
const ThemeInitializer: React.FC = () => {
  const { theme, pinSettings } = useSettings();

  useEffect(() => {
    // Apply theme on component mount
    applyTheme(theme);
    
    // Log initial settings for debugging
    console.log("Initializing settings:", { 
      theme, 
      pinMode: pinSettings.mode,
      pinSize: pinSettings.size,
      pinThreshold: pinSettings.appearanceThreshold
    });

    // Set up listener for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, pinSettings]);

  return null; // This component doesn't render anything
};

export default ThemeInitializer;
