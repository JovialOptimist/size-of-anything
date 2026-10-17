/** Click handler used by modes (pick on map, draw points). Returns true when it handled the click. */
export const mapClickHandler: { current: ((lngLat: [number, number]) => boolean) | null } = { current: null };
