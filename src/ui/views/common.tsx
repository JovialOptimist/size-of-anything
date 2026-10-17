import { ArrowLeft, Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { useUI } from "../../state/ui";
import { useShapes, shapeArea, type Shape } from "../../state/shapes";
import { useSettings } from "../../state/settings";
import { useSwatch } from "../hooks";
import { formatArea } from "../../geo/format";
import { ShapeIcon } from "../icons";
import { revealShape } from "../actions";

export function ViewHeader({ title, onBack, right }: { title: ReactNode; onBack?: () => void; right?: ReactNode }) {
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

export function MenuButton() {
  return (
    <button type="button" className="iconbtn" aria-label="Open menu" onClick={() => useUI.getState().set({ menuOpen: true })}>
      <Menu size={20} />
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
      <span className="row__main"><b>{s.name}</b><small>{[s.type, s.locality].filter(Boolean).join(" · ")}</small></span>
      <span className="row__end">{formatArea(shapeArea(s), units)}</span>
    </button>
  );
}
