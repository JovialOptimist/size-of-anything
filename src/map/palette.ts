/** Ten fixed shape colors. L tone for light basemaps, D tone for dark basemaps and satellite. */
export const PALETTE: { name: string; L: string; D: string }[] = [
  { name: "Blue", L: "#245fd4", D: "#6a9cfb" },
  { name: "Orange", L: "#ec7c0e", D: "#ffba81" },
  { name: "Teal", L: "#009488", D: "#4cd7c8" },
  { name: "Magenta", L: "#b1006f", D: "#ef58a5" },
  { name: "Violet", L: "#9674e1", D: "#c4afff" },
  { name: "Green", L: "#187e36", D: "#48c063" },
  { name: "Red", L: "#d73431", D: "#e95048" },
  { name: "Gold", L: "#a97f00", D: "#ffe565" },
  { name: "Sky", L: "#37a4d5", D: "#a9e0fe" },
  { name: "Brown", L: "#734621", D: "#d2a883" },
];

export const shapeColor = (slot: number, darkMap: boolean) => {
  const p = PALETTE[((slot % 10) + 10) % 10];
  return darkMap ? p.D : p.L;
};
