declare module "polylabel" {
  export default function polylabel(polygon: number[][][], precision?: number, debug?: boolean): [number, number] & { distance: number };
}
