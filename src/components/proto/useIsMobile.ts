import { useEffect, useState } from "react";

/** True below the app's 500px phone breakpoint; updates on resize. */
export default function useIsMobile(): boolean {
  const query = "(max-width: 500px)";
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
