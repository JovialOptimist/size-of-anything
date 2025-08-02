import { useEffect } from 'react';
import { useSettings, applyTheme } from '../state/settingsStore';

/**
 * Component that initializes and applies the theme when the app loads
 * This ensures the theme is applied before the UI renders
 */
const ThemeInitializer: React.FC = () => {
  const { theme } = useSettings();
  
  useEffect(() => {
    // Apply theme on component mount
    applyTheme(theme);
    
    // Set up listener for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
  
  return null; // This component doesn't render anything
};

export default ThemeInitializer;