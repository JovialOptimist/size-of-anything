import { useState, type ReactNode } from "react";
import { ChevronRight, Heart, Code, Mail } from "lucide-react";
import { useSettings, type Settings } from "../../state/settings";
import { useUI } from "../../state/ui";
import { useShapes } from "../../state/shapes";
import { toast } from "../../state/toasts";
import { mercatorInflation } from "../../geo/geometry";
import { getMap } from "../../map/mapCore";
import { CONTACT_EMAIL, SUPPORT_URL } from "../../config";
import { ViewHeader } from "./common";

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="srow">
      <span>{title}{sub && <small>{sub}</small>}</span>
      {children}
    </div>
  );
}

export function SettingsView() {
  const s = useSettings();
  const set = <K extends keyof Omit<Settings, "set" | "reset">>(k: K) => (v: Settings[K]) => s.set(k, v);
  const shapeCount = useShapes((st) => st.shapes.length);
  return (
    <>
      <ViewHeader title="Settings" />
      <div className="panel__scroll">
        <div className="sgroup-title">Appearance</div>
        <div className="sgroup">
          <Row title="Theme"><Seg label="Theme" value={s.theme} onChange={set("theme")} options={[["light", "Light"], ["dark", "Dark"], ["system", "Auto"]]} /></Row>
          <Row title="Map" sub="Satellite and the globe live in the Layers button too"><Seg label="Map" value={s.basemap} onChange={set("basemap")} options={[["map", "Map"], ["satellite", "Satellite"]]} /></Row>
          <Row title="Globe view" sub="Show the whole Earth as a ball when zoomed out"><Switch label="Globe view" checked={s.globe} onChange={set("globe")} /></Row>
        </div>

        <div className="sgroup-title">Units</div>
        <div className="sgroup">
          <Row title="Measurements"><Seg label="Measurements" value={s.units} onChange={set("units")} options={[["metric", "Metric"], ["us", "US"]]} /></Row>
          <Row title="Show both" sub={s.showBothUnits ? "3.41 km² and 1.32 sq mi" : "Just one"}><Switch label="Show both units" checked={s.showBothUnits} onChange={set("showBothUnits")} /></Row>
        </div>

        <div className="sgroup-title">Shapes on the map</div>
        <div className="sgroup">
          <Row title="Names"><Seg label="Names" value={s.labels} onChange={set("labels")} options={[["off", "Off"], ["auto", "Auto"], ["always", "Always"]]} /></Row>
          <Row title="Fill"><Seg label="Fill" value={s.fill} onChange={set("fill")} options={[["light", "Light"], ["medium", "Medium"], ["strong", "Strong"]]} /></Row>
          <Row title="Shape tools" sub={s.shapeTools === "panel" ? "Selecting a shape opens its page" : "A toolbar floats above the selected shape"}>
            <Seg label="Shape tools" value={s.shapeTools} onChange={set("shapeTools")} options={[["panel", "Panel"], ["toolbar", "Toolbar"]]} />
          </Row>
        </div>

        <div className="sgroup-title">Data &amp; privacy</div>
        <div className="sgroup">
          <Row title="Remember recent searches" sub="Saved only in this browser"><Switch label="Remember recent searches" checked={s.rememberRecent} onChange={set("rememberRecent")} /></Row>
          <button type="button" className="srow" onClick={() => {
            const prev = useUI.getState().recent;
            useUI.getState().set({ recent: [] });
            try { localStorage.removeItem("soa-recent"); } catch { /* ignore */ }
            toast({ text: "Recent searches cleared", action: { label: "Undo", run: () => { useUI.getState().set({ recent: prev }); try { localStorage.setItem("soa-recent", JSON.stringify(prev)); } catch { /* ignore */ } } } });
          }}><span>Clear recent searches</span><ChevronRight size={18} /></button>
          <button type="button" className="srow" disabled={!shapeCount} onClick={() => {
            useShapes.getState().clear();
            toast({ text: `Removed ${shapeCount} shape${shapeCount === 1 ? "" : "s"}`, action: { label: "Undo", run: () => useShapes.getState().undo() } });
          }}><span>Remove all shapes<small>{shapeCount} on the map</small></span><ChevronRight size={18} /></button>
          <button type="button" className="srow" onClick={() => { s.reset(); toast({ text: "Settings reset" }); }}><span>Reset settings</span><ChevronRight size={18} /></button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "16px 6px" }}>Changes apply right away.</p>
      </div>
    </>
  );
}

export function HelpView() {
  const lat = getMap()?.getCenter().lat ?? 45;
  const k = mercatorInflation(lat);
  return (
    <>
      <ViewHeader title="Help" />
      <div className="panel__scroll prose">
        <h3 style={{ marginTop: 0 }}>Three steps</h3>
        <div className="steps">
          <div className="step"><span className="step__n">1</span><div><b>Find something.</b> Search for any place (a park, a city, your school), pick it on the map, or grab an object like a blue whale.</div></div>
          <div className="step"><span className="step__n">2</span><div><b>Drag it anywhere.</b> Grab the round pin and move it. On a phone you can also hold a shape for a moment to pick it up.</div></div>
          <div className="step"><span className="step__n">3</span><div><b>Compare.</b> The shape page tells you how many times bigger it is, and how many soccer pitches fit inside.</div></div>
        </div>

        <h3>Why does my shape change shape?</h3>
        <p>
          Flat web maps use the Mercator projection, which stretches things more the farther they are from the equator. Here, at about {Math.round(Math.abs(lat))}° {lat >= 0 ? "north" : "south"}, the map draws areas <b>{k.toFixed(1)}×</b> bigger than they are at the equator.
        </p>
        <p>Your shapes keep their true size. So when you drag one toward the poles, it grows on screen to match the map's stretching, and when you drag it toward the equator it shrinks. Try the Greenland example, or turn on the globe in Layers to see the Earth without the stretching.</p>

        <h3>Moving without dragging</h3>
        <ul>
          <li>On a shape's page: <b>Move here</b>, <b>Move to…</b> any place, or <b>My location</b>.</li>
          <li>The arrow pad nudges a shape, and the rotation field takes exact degrees.</li>
        </ul>

        <h3>Keyboard shortcuts</h3>
        <ul>
          <li><span className="kbd">/</span> search</li>
          <li><span className="kbd">←</span> <span className="kbd">→</span> <span className="kbd">↑</span> <span className="kbd">↓</span> nudge the selected shape (hold Shift for bigger steps)</li>
          <li><span className="kbd">[</span> <span className="kbd">]</span> rotate 15°</li>
          <li><span className="kbd">Delete</span> remove · <span className="kbd">Ctrl</span>+<span className="kbd">Z</span> undo · <span className="kbd">Ctrl</span>+<span className="kbd">D</span> copy</li>
          <li><span className="kbd">Esc</span> deselect or go back</li>
        </ul>

        <h3>Where the shapes come from</h3>
        <p>Outlines come from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>, a map made by volunteers. If a place has no outline, it's only mapped as a point. You can add it on openstreetmap.org, or draw it yourself with Create.</p>

        <h3>Tell me what you think</h3>
        <Feedback />
      </div>
    </>
  );
}

function Feedback() {
  const [type, setType] = useState("feature-request");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) return <p><b>Thanks!</b> Your message is on its way.</p>;
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!details.trim()) return;
        try {
          await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "form-name": "feedback", feedbackType: type, details, email }).toString() });
          setSent(true);
        } catch {
          toast({ text: `Couldn't send that. You can email ${CONTACT_EMAIL} instead.`, tone: "error" });
        }
      }}
    >
      <Seg label="Kind of feedback" value={type} onChange={setType} options={[["major-bug", "Bug"], ["feature-request", "Idea"], ["minor-bug", "Nitpick"]]} />
      <div className="field"><label htmlFor="fb">What's on your mind?</label><textarea id="fb" rows={4} className="input" style={{ padding: 10 }} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
      <div className="field"><label htmlFor="fbe">Email (optional, if you'd like a reply)</label><div className="input"><input id="fbe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
      <button type="submit" className="btn btn--primary" disabled={!details.trim()}>Send</button>
    </form>
  );
}

export function AboutView() {
  return (
    <>
      <ViewHeader title="About" />
      <div className="panel__scroll prose">
        <p style={{ fontSize: 17, marginTop: 0 }}><b>The Size of Anything</b> lets you pick up any place on Earth and drop it somewhere else, at its true size.</p>
        <p>Hey, I'm Jac Chambers. This started as my capstone at the University of Washington Bothell, after I spent a day wondering how big my local Costco really is. "168,000 square feet" didn't help at all. Putting it next to things I knew did.</p>
        <p>Go put your house in Romania, or steal the Eiffel Tower. The whole world is literally for the taking!</p>
        <div className="btnrow">
          <a className="btn btn--primary" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer"><Heart size={17} /> Buy me a coffee</a>
          <a className="btn" href="https://github.com/JovialOptimist/size-of-anything" target="_blank" rel="noopener noreferrer"><Code size={17} /> Source code</a>
        </div>
        <p className="muted"><Mail size={14} /> {CONTACT_EMAIL}</p>

        <h3>Credits</h3>
        <ul>
          <li>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL).</li>
          <li>Map styles and tiles: <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> and OpenMapTiles. Satellite imagery: Esri, Maxar, Earthstar Geographics.</li>
          <li>Search: <a href="https://nominatim.org" target="_blank" rel="noopener noreferrer">Nominatim</a> and <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon</a> by komoot. "What's here" uses the Overpass API.</li>
          <li>Map rendering: MapLibre GL JS. Icons: Lucide. Fonts: Inter and Bricolage Grotesque.</li>
        </ul>

        <h3>Privacy</h3>
        <p>There are no accounts and no tracking. Your shapes, settings and recent searches stay in this browser. What you type into search is sent to the search services above, so don't type anything personal.</p>
      </div>
    </>
  );
}
