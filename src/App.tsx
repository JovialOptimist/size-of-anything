/**
 * The Size of Anything: pick up any place on Earth and drop it somewhere else at its true size.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import MapView from "./map/MapView";
import Overlays from "./map/Overlays";
import ModeLayers from "./map/ModeLayers";
import Shell from "./ui/Shell";
import { HelpDialog, SettingsDialog, LiveRegion, MapControls, ShareDialog, Toasts } from "./ui/Chrome";
import { useKeyboard } from "./ui/keyboard";
import { useIsDark } from "./state/settings";
import { restoreSession } from "./state/shapes";
import { loadFromUrl } from "./share/url";
import { ACCENT, ACCENT_PRESETS } from "./config";
import { toast } from "./state/toasts";

export default function App() {
  const isDark = useIsDark();
  const [ready, setReady] = useState(false);
  useKeyboard();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = isDark ? "dark" : "light";
    root.style.setProperty("--accent-light", ACCENT_PRESETS[ACCENT].light);
    root.style.setProperty("--accent-dark", ACCENT_PRESETS[ACCENT].dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#171b20" : "#ffffff");
  }, [isDark]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (await loadFromUrl()) {
        toast({ text: "Here's the comparison someone shared with you." });
        return;
      }
      await restoreSession();
    })();
  }, [ready]);

  return (
    <div className="app">
      <h1 className="sr-only">The Size of Anything</h1>
      <main>
        <MapView onReady={() => setReady(true)} />
        {ready && <Overlays />}
        {ready && <ModeLayers />}
        <MapControls />
        <Shell />
      </main>
      <ShareDialog />
      <HelpDialog />
      <SettingsDialog />
      <Toasts />
      <LiveRegion />
    </div>
  );
}
