/**
 * Utility functions for device detection
 */

/**
 * Checks if the current device is a mobile device.
 * Uses a combination of user agent detection and screen size.
 * 
 * @returns boolean True if the device is mobile, false otherwise
 */
export function isMobileDevice(): boolean {
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || 
                   navigator.maxTouchPoints > 0 || 
                   (navigator as any).msMaxTouchPoints > 0;

  // Check for mobile user agent
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Check for screen size (typically mobile devices are under 768px width)
  const smallScreen = window.innerWidth <= 768;

  // Consider it a mobile device if it has a touch screen and either 
  // has a mobile user agent or a small screen size
  return hasTouch && (mobileUserAgent || smallScreen);
}