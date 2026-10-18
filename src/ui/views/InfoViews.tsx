import { useState, type ReactNode } from "react";
import { ChevronRight, Heart, Code, Ruler, MessageSquare } from "lucide-react";
import { useSettings, type Settings } from "../../state/settings";
import { useUI, announce, type HelpPage } from "../../state/ui";
import { useShapes } from "../../state/shapes";
import { toast } from "../../state/toasts";
import { CONTACT_EMAIL, SUPPORT_URL } from "../../config";
import MercatorExplainer from "../MercatorExplainer";

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="srow">
      <span>{title}{sub && <small>{sub}</small>}</span>
      {children}
    </div>
  );
}

/** Everything in the Settings popover. Map style and the globe live in Layers. */
export function SettingsBody() {
  const s = useSettings();
  const set = <K extends keyof Omit<Settings, "set" | "reset">>(k: K) => (v: Settings[K]) => s.set(k, v);
  const shapeCount = useShapes((st) => st.shapes.length);
  return (
    <div className="settings-cols">
      <section>
      <div className="sgroup-title" style={{ marginTop: 0 }}>Appearance</div>
      <div className="sgroup">
        <Row title="Theme"><Seg label="Theme" value={s.theme} onChange={set("theme")} options={[["light", "Light"], ["dark", "Dark"], ["system", "Auto"]]} /></Row>
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
        <Row title="Show shape toolbar" sub="A small toolbar floats above the selected shape, as well as its page">
          <Switch label="Show shape toolbar" checked={s.showToolbar} onChange={set("showToolbar")} />
        </Row>
      </div>

      </section>
      <section>
      <div className="sgroup-title" style={{ marginTop: 0 }}>Data &amp; privacy</div>
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
          announce(`Removed ${shapeCount} shape${shapeCount === 1 ? "" : "s"}`);
        }}><span>Remove all shapes<small>{shapeCount} on the map</small></span><ChevronRight size={18} /></button>
        <button type="button" className="srow" onClick={() => { s.reset(); toast({ text: "Settings reset" }); }}><span>Reset settings</span><ChevronRight size={18} /></button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: "12px 4px 0" }}>Changes apply right away. Map style, the globe and units are also in Layers.</p>
      </section>
    </div>
  );
}

export function HelpBody({ go }: { go: (p: HelpPage) => void }) {
  return (
    <div className="help">
      <div className="help-intro">
        <span className="brand__mark"><Ruler size={22} /></span>
        <div className="help-intro__text">
          <b>The Size of Anything</b>
          <p>A website to teach the scale of every place, object, or thing in our world.</p>
        </div>
        <div className="btnrow">
          <button type="button" className="btn btn--sm" onClick={() => go("about")}>About <ChevronRight size={15} /></button>
          <button type="button" className="btn btn--sm" onClick={() => go("feedback")}><MessageSquare size={15} /> Send feedback</button>
        </div>
      </div>

      <div className="help-steps">
        <div className="step"><span className="step__n">1</span><div><b>Find it</b><p>Search for any place, click one on the map, or grab an object like a blue whale.</p></div></div>
        <div className="step"><span className="step__n">2</span><div><b>Drag it</b><p>Grab the round pin and drop it anywhere. It keeps its real size wherever it goes.</p></div></div>
        <div className="step"><span className="step__n">3</span><div><b>Compare it</b><p>Its page shows how it measures up against your other shapes and everyday things.</p></div></div>
      </div>

      <div className="help-cols">
        <section>
          <h3>Why do shapes grow and shrink?</h3>
          <MercatorExplainer />
        </section>
        <section className="help-keys">
          <h3>Shortcuts</h3>
          <dl>
            <dt><span className="kbd">/</span></dt><dd>Search</dd>
            <dt><span className="kbd">Ctrl</span> <span className="kbd">Z</span></dt><dd>Undo (add <span className="kbd">Shift</span> to redo)</dd>
            <dt><span className="kbd">←</span> <span className="kbd">→</span> <span className="kbd">↑</span> <span className="kbd">↓</span></dt><dd>Nudge a shape (<span className="kbd">Shift</span> for bigger steps)</dd>
            <dt><span className="kbd">[</span> <span className="kbd">]</span></dt><dd>Rotate 15°</dd>
            <dt><span className="kbd">Ctrl</span> <span className="kbd">D</span></dt><dd>Clone</dd>
            <dt><span className="kbd">Delete</span></dt><dd>Remove</dd>
            <dt><span className="kbd">Esc</span></dt><dd>Deselect or close</dd>
            <dt><span className="kbd">?</span></dt><dd>This help</dd>
          </dl>

          <h3 className="help-keys__next">Where do the outlines come from?</h3>
          <p>
            From <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>, a free map of the world made by volunteers.
            Some places are only mapped as a single dot, so there's no outline to borrow. If something's missing, you can add it on openstreetmap.org, or draw it yourself with Create.
          </p>
        </section>
      </div>
    </div>
  );
}

export function FeedbackBody() {
  return (
    <>
      <div className="prose">
        <p style={{ marginTop: 0 }}>Found a bug, have an idea, or spotted something that's off? Tell me what you think.</p>
        <Feedback />
      </div>
    </>
  );
}

/** What each kind of feedback asks for. The ids are what the feedback form has always sent. */
const FEEDBACK_KINDS = {
  "major-bug": { name: "Bug: Something's broken", label: "What went wrong?", placeholder: "Nothing happened when I clicked the share button.", email: "Email (optional, so I can ask a follow-up question)" },
  "feature-request": { name: "Feature: An idea or request", label: "What's your idea?", placeholder: "It would be great if I could...", email: "Email (optional, if you'd like a reply)" },
  "minor-bug": { name: "Issue: Something small is not quite right", label: "What looks off?", placeholder: "Looks like you mispelled this word...", email: "Email (optional, if you'd like a reply)" },
  other: { name: "Misc: Something else", label: "What's on your mind?", placeholder: "Do you have a favorite color?", email: "Email (optional, if you'd like a reply)" },
} as const;
type FeedbackKind = keyof typeof FEEDBACK_KINDS;

function Feedback() {
  const [type, setType] = useState<FeedbackKind>("feature-request");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const kind = FEEDBACK_KINDS[type];
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
      <div className="field">
        <label htmlFor="fbk">What kind of feedback?</label>
        <select id="fbk" className="select" value={type} onChange={(e) => setType(e.target.value as FeedbackKind)}>
          {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => <option key={k} value={k}>{FEEDBACK_KINDS[k].name}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="fb">{kind.label}</label><textarea id="fb" rows={4} className="input" style={{ padding: 10 }} placeholder={kind.placeholder} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
      <div className="field"><label htmlFor="fbe">{kind.email}</label><div className="input"><input id="fbe" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
      <button type="submit" className="btn btn--primary" disabled={!details.trim()}>Send</button>
    </form>
  );
}

export function AboutBody() {
  return (
    <>
      <div className="prose help-cols">
        <section>
        <p style={{ marginTop: 0 }}><b>The Size of Anything</b> lets you pick up any place on Earth and drop it somewhere else, at its true size.</p>
          <h3 style={{ marginTop: 0 }}>Me</h3>
        <p>Hi, I'm Jac! This whole thing started as my capstone at the University of Washington Bothell, after I spent a day wondering how big my local Costco really is. "168,000 square feet" didn't help at all, so instead I spent the next 6 months making a website that could!</p>
        <p>Go put your house in Romania, or steal the Eiffel Tower. The whole world is literally for the taking!</p>
        <div className="btnrow">
          <a className="btn btn--primary" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer"><Heart size={17} /> Buy me a coffee</a>
          <a className="btn" href="https://github.com/JovialOptimist/size-of-anything" target="_blank" rel="noopener noreferrer"><Code size={17} /> GitHub</a>
        </div>
        </section>
        <section>
        <h3 style={{ marginTop: 0 }}>Credits</h3>
        <ul>
          <li>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL).</li>
          <li>Map styles and tiles: <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> and OpenMapTiles. Satellite imagery: Esri, Maxar, Earthstar Geographics.</li>
          <li>Search: <a href="https://nominatim.org" target="_blank" rel="noopener noreferrer">Nominatim</a> and <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon</a> by komoot. "What's here" uses the Overpass API.</li>
          <li>Map rendering: MapLibre GL JS. Icons: Lucide. Fonts: Inter and Bricolage Grotesque.</li>
        </ul>

        <h3>Privacy</h3>
        <p>There are no accounts or tracking, and your shapes, settings and recent searches stay in this browser.</p>
          <p>Do note that what you type into search is sent to the search services above, so don't go typing your passwords into the search box just for fun.</p>
        </section>
      </div>
    </>
  );
}
