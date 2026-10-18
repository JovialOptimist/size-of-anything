/**
 * Points visitors of this (old) version to the new one. Shows once on its own,
 * and again whenever someone picks "Try the new version" from the ⋮ menu.
 */
import { useEffect, useState } from "react";
import "./VersionPrompt.css";

const SEEN_KEY = "soa-version-prompt-seen";
export const NEW_VERSION_URL = "https://thesizeofanything.com";
const OPEN_EVENT = "soa:version-prompt";

/** Open the prompt from anywhere (the ⋮ menu uses this). */
export function openVersionPrompt() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export default function VersionPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage unavailable: show it once per visit instead */
    }
    const first = seen ? undefined : setTimeout(() => setOpen(true), 800);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      clearTimeout(first);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="version-prompt__scrim" onClick={close}>
      <div className="version-prompt" role="dialog" aria-modal="true" aria-labelledby="version-prompt-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="version-prompt-title">There's a new version of The Size of Anything</h2>
        <p>
          It has a cleaner map, faster search, true-size objects to compare with, and a lot more. This older
          version will stay here for anyone who prefers it.
        </p>
        <div className="version-prompt__buttons">
          <a className="version-prompt__primary" href={NEW_VERSION_URL} onClick={close}>
            Try the new version
          </a>
          <button type="button" className="version-prompt__secondary" onClick={close} autoFocus>
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}
