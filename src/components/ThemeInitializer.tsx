import { useEffect } from "react";
import { useSettings, applyTheme } from "../state/settingsStore";

/**
 * Component that initializes and applies settings when the app loads
 * This ensures settings are applied before the UI fully renders
 */
const ThemeInitializer: React.FC = () => {
  const { theme, pinSettings } = useSettings();

  useEffect(() => {
    // Set platform class for CSS (e.g. Android needs bottom buffer for nav bar; iOS does not)
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) {
      document.documentElement.classList.add("platform-android");
    } else {
      document.documentElement.classList.remove("platform-android");
    }

    // Android + mobile: use Visual Viewport API so bottom inset adapts to any system UI height
    // (e.g. large accessibility nav bar). See https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
    if (!isAndroid) return;

    const setBottomInset = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const layoutBottom = window.innerHeight;
      const visibleBottom = vv.offsetTop + vv.height;
      const inset = Math.max(0, layoutBottom - visibleBottom);
      document.documentElement.style.setProperty("--mobile-bottom-inset", `${Math.round(inset)}px`);
    };

    const media = window.matchMedia("(max-width: 500px)");
    const setup = () => {
      if (media.matches) {
        setBottomInset();
        window.visualViewport?.addEventListener("resize", setBottomInset);
        window.visualViewport?.addEventListener("scroll", setBottomInset);
      } else {
        window.visualViewport?.removeEventListener("resize", setBottomInset);
        window.visualViewport?.removeEventListener("scroll", setBottomInset);
        document.documentElement.style.removeProperty("--mobile-bottom-inset");
      }
    };
    setup();
    media.addEventListener("change", setup);
    return () => {
      media.removeEventListener("change", setup);
      window.visualViewport?.removeEventListener("resize", setBottomInset);
      window.visualViewport?.removeEventListener("scroll", setBottomInset);
      document.documentElement.style.removeProperty("--mobile-bottom-inset");
    };
  }, []);

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
