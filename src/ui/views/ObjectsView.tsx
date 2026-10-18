import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { OBJECTS, CATEGORIES, thumbnailPath, type Category, type RefObject } from "../../objects/registry";
import { getMap, getPad } from "../../map/mapCore";
import { addObject } from "../actions";
import { ViewHeader } from "./common";

function viewWidthMeters(): number {
  const m = getMap();
  if (!m) return 1000;
  const c = m.getCanvas();
  const pad = getPad();
  const y = (c.clientHeight - pad.bottom + pad.top) / 2;
  const a = m.unproject([pad.left, y]), b = m.unproject([c.clientWidth - pad.right, y]);
  return a.distanceTo(b);
}

const thumbs = new Map<string, ReturnType<typeof thumbnailPath>>();
function Thumb({ o }: { o: RefObject }) {
  if (!thumbs.has(o.id)) thumbs.set(o.id, thumbnailPath(o.build()));
  const t = thumbs.get(o.id)!;
  return <svg className="thumb" viewBox={t.viewBox} aria-hidden="true"><path d={t.d} /></svg>;
}

function Card({ o }: { o: RefObject }) {
  return (
    <button type="button" className="ocard" onClick={() => addObject(o.id)} title={o.fact}>
      <Thumb o={o} />
      <b>{o.name}</b>
      <small>{o.dims}</small>
    </button>
  );
}

export default function ObjectsView() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "suggested">("suggested");
  const width = useMemo(viewWidthMeters, []);
  const t = q.trim().toLowerCase();
  const suggested = [...OBJECTS].filter((o) => o.span > width * 0.08 && o.span < width * 0.7).sort((a, b) => Math.abs(Math.log(a.span / (width * 0.3))) - Math.abs(Math.log(b.span / (width * 0.3)))).slice(0, 8);
  const FEATURED = ["blue-whale", "soccer-pitch", "titanic", "great-pyramid", "boeing-737", "olympic-pool"];
  const list = t
    ? OBJECTS.filter((o) => `${o.name} ${o.synonyms} ${o.category}`.toLowerCase().includes(t))
    : cat === "suggested"
      ? [...suggested, ...OBJECTS.filter((o) => FEATURED.includes(o.id) && !suggested.includes(o))].slice(0, Math.max(suggested.length, 6))
      : OBJECTS.filter((o) => o.category === cat);

  return (
    <>
      <ViewHeader title="Objects" close />
      <div className="panel__scroll">
        <p style={{ marginTop: 0 }}>Real things at their real size. Drop one next to anything on the map.</p>
        <div className="input" style={{ marginBottom: 12 }}>
          <Search size={17} className="muted" />
          <input aria-label="Search objects" placeholder="Whale, stadium, Titanic…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!t && (
          <div className="chips chips--scroll" role="tablist" aria-label="Categories" style={{ marginBottom: 12 }}>
            <button type="button" role="tab" aria-selected={cat === "suggested"} className={`chip${cat === "suggested" ? " is-on" : ""}`} onClick={() => setCat("suggested")}>Good for this view</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className={`chip${cat === c.id ? " is-on" : ""}`} onClick={() => setCat(c.id)}>{c.label}</button>
            ))}
          </div>
        )}
        {!t && cat === "suggested" && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
            First up: things sized for what you're looking at (about {width >= 1000 ? `${(width / 1000).toFixed(width > 10000 ? 0 : 1)} km` : `${Math.round(width)} m`} across). Zoom in or out for different suggestions.
          </p>
        )}
        {list.length === 0 ? (
          <p className="muted">{t ? `Nothing called “${q}” yet.` : "Nothing in this list fits the current zoom. Try another category."}</p>
        ) : (
          <div className="ogrid">{list.map((o) => <Card key={o.id} o={o} />)}</div>
        )}
      </div>
    </>
  );
}
