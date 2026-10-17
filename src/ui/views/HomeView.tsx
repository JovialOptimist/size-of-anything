import { Crosshair, PenLine, Shapes, Search, PanelLeftClose, Eye, EyeOff } from "lucide-react";
import { useUI } from "../../state/ui";
import { useShapes } from "../../state/shapes";
import { MenuButton, ShapeRow } from "./common";
import { useSwatch } from "../hooks";
import { TRY, runTry } from "../try";
import { revealShape } from "../actions";
import { useIsDesktop } from "../hooks";

export default function HomeView() {
  const shapes = useShapes((s) => s.shapes);
  const desktop = useIsDesktop();
  const swatch = useSwatch();
  const ui = useUI.getState();
  return (
    <>
      <div className="omni">
        <MenuButton />
        <button type="button" className="omni__fake" onClick={() => ui.go({ name: "search" })}>
          Search places &amp; things…
        </button>
        {desktop ? <span className="kbd" aria-hidden="true">/</span> : <Search size={18} className="muted" aria-hidden="true" />}
        {desktop && (
          <button type="button" className="iconbtn" aria-label="Hide panel" onClick={() => ui.set({ panelCollapsed: true })}>
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>
      <div className="panel__scroll">
        {!desktop && shapes.length > 0 && (
          <div className="chips chips--scroll" style={{ margin: "2px 0 12px" }} aria-label="Shapes on the map">
            {[...shapes].reverse().map((s) => (
              <button key={s.id} type="button" className="chip" style={{ ["--c" as string]: swatch(s.slot) }} onClick={() => {
                useShapes.getState().select(s.id);
                ui.go({ name: "detail", id: s.id });
                revealShape(s.id);
              }}>
                <span className="sw" /> {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="tools">
          <button type="button" className="tool" style={{ ["--c" as string]: swatch(2) }} onClick={() => ui.go({ name: "pick" })}>
            <Crosshair size={22} /> Pick on map
          </button>
          <button type="button" className="tool" style={{ ["--c" as string]: swatch(1) }} onClick={() => ui.go({ name: "create" })}>
            <PenLine size={22} /> Create
          </button>
          <button type="button" className="tool" style={{ ["--c" as string]: swatch(4) }} onClick={() => ui.go({ name: "objects" })}>
            <Shapes size={22} /> Objects
          </button>
        </div>

        {shapes.length === 0 ? (
          <div className="empty">
            <EmptyArt />
            <h3>What do you want to compare?</h3>
            <p>Find any place on Earth, then drag it anywhere else. It keeps its true size wherever it goes.</p>
            <div className="chips" style={{ justifyContent: "center" }}>
              {TRY.map((t, i) => (
                <button key={t.label} type="button" className="chip chip--tint" style={{ ["--c" as string]: swatch(t.tint) }} onClick={() => runTry(i)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="sec">
              <span>On the map · {shapes.length}</span>
              <button type="button" onClick={() => {
                const all = useShapes.getState().shapes;
                const anyHidden = all.some((s) => !s.visible);
                all.forEach((s) => useShapes.getState().update(s.id, { visible: anyHidden }, { history: false }));
              }}>
                {shapes.some((s) => !s.visible) ? <><Eye size={13} /> Show all</> : <><EyeOff size={13} /> Hide all</>}
              </button>
            </div>
            {[...shapes].reverse().map((s) => <ShapeRow key={s.id} s={s} />)}
            <div className="sec"><span>Try something else</span></div>
            <div className="chips">
              {TRY.map((t, i) => (
                <button key={t.label} type="button" className="chip chip--tint" style={{ ["--c" as string]: swatch(t.tint) }} onClick={() => runTry(i)}>
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function EmptyArt() {
  return (
    <svg className="empty__art" viewBox="0 0 120 84" aria-hidden="true">
      <path d="M14 58 C10 40 26 22 44 24 C58 26 60 12 76 14 C92 16 100 30 96 44 C92 58 76 70 56 68 C36 66 18 74 14 58Z" fill="color-mix(in oklch, var(--accent) 18%, transparent)" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="5 4" />
      <path d="M52 34 L78 30 L84 58 L56 62Z" fill="color-mix(in oklch, #ec7c0e 25%, transparent)" stroke="#ec7c0e" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="68" cy="46" r="7" fill="#ec7c0e" stroke="#fff" strokeWidth="2" />
      <path d="M30 40 l-8 -6 M30 40 l-9 4" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
