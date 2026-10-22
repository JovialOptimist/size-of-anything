/** The shape whose pin the mouse is over. MapView hovers that shape and calls `changed` to redraw. */
export const pinHover: { id: string | null; changed: () => void } = { id: null, changed: () => {} };

export function setPinHover(id: string | null) {
  pinHover.id = id;
  pinHover.changed();
}
