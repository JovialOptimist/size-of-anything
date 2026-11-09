import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { useUI } from "../../state/ui";
import { useShapes, shapeArea, type Shape } from "../../state/shapes";
import { useSettings } from "../../state/settings";
import { useWaterOutline, useSwatch, type WaterOutline } from "../hooks";
import { formatArea, formatAreaSecondary } from "../../geo/format";
import type { Outline } from "../../geo/services";
import { Literal } from "../Literal";
import { ShapeIcon } from "../icons";
import { revealShape } from "../actions";
import OutlinePreview from "../OutlinePreview";

/** A place's area before it's on the map, with the water setting applied. */
export function OutlineArea({ o }: { o: Outline }) {
  const units = useSettings((s) => s.units);
  const w = useWaterOutline(o);
  return <Literal>{formatArea(w?.area ?? 0, units)}</Literal>;
}

const REMOVED = { sea: "Sea removed.", lakes: "Lakes removed.", "sea and lakes": "Sea and lakes removed." };

/**
 * Says what water a preview has taken out, or how much it still has, so people know the outline
 * can change. Nothing while measuring, and nothing for places with no water.
 */
export function WaterCaption({ w }: { w: WaterOutline | undefined }) {
  const units = useSettings((s) => s.units);
  if (w?.removed) {
    return <span key="removed" className="muted water__note">{REMOVED[w.removed]} As mapped:<Literal>{` ${formatArea(w.asMapped, units)}`}</Literal></span>;
  }
  if (w?.waterIn) {
    return <span key="in" className="muted water__note">Includes<Literal>{` ${formatArea(w.waterIn, units)} `}</Literal>of water</span>;
  }
  return null;
}

/** A place opened in search: its outline, area and water caption. */
export function PlacePreview({ o }: { o: Outline }) {
  const units = useSettings((s) => s.units);
  const w = useWaterOutline(o);
  if (!w) return null;
  return (
    <>
      <OutlinePreview geometry={w.geometry} original={w.original} height={120} />
      <div className="result__area">
        <Literal>{formatArea(w.area, units)}</Literal>
        <small><Literal>{formatAreaSecondary(w.area, units)}</Literal></small>
      </div>
      <WaterCaption w={w} />
    </>
  );
}

/** A page title with a back arrow, or (`close`) a title with an X on the right that goes home, like a shape's page. */
export function ViewHeader({ title, onBack, right, close = false }: { title: ReactNode; onBack?: () => void; right?: ReactNode; close?: boolean }) {
  if (close) {
    return (
      <header className="ph ph--close">
        <h2 className="ph__title">{title}</h2>
        {right}
        <CloseButton onClick={onBack ?? (() => useUI.getState().home())} />
      </header>
    );
  }
  return (
    <header className="ph">
      <button type="button" className="iconbtn" onClick={onBack ?? (() => useUI.getState().back())} aria-label="Back">
        <ArrowLeft size={20} />
      </button>
      <h2 className="ph__title">{title}</h2>
      {right}
    </header>
  );
}

export function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="iconbtn" onClick={onClick} aria-label={label}>
      <X size={20} />
    </button>
  );
}

export function ShapeRow({ s, onClick }: { s: Shape; onClick?: () => void }) {
  const units = useSettings((st) => st.units);
  const swatch = useSwatch();
  const selected = useShapes((st) => st.selectedId === s.id);
  return (
    <button
      type="button"
      className="row"
      aria-selected={selected}
      onClick={onClick ?? (() => {
        useShapes.getState().select(s.id);
        useUI.getState().go({ name: "detail", id: s.id });
        revealShape(s.id);
      })}
      style={{ ["--c" as string]: swatch(s.slot) }}
    >
      <span className="row__ico row__ico--c"><ShapeIcon icon={s.icon} size={17} /></span>
      <span className="row__main"><b translate="no">{s.name}</b><small>{[s.type, s.locality].filter(Boolean).join(" · ")}</small></span>
      <span className="row__end"><Literal>{formatArea(shapeArea(s), units)}</Literal></span>
    </button>
  );
}
