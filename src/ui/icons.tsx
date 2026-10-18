import {
  Globe, Map, Building2, House, Trees, TreePine, Waves, Mountain, TreePalm, Building, School, GraduationCap, Hospital,
  Church, Landmark, Castle, Trophy, Goal, Droplets, Flag, PawPrint, FerrisWheel, Plane, TrainFront, SquareParking,
  ShoppingBag, Store, Coffee, Utensils, Hotel, Factory, Tractor, Tent, Cross, Briefcase, Fence, MapPin, Shapes, PenLine,
  Ship, Rocket, Fish, Bus, Ruler, Dumbbell, type LucideIcon,
} from "lucide-react";
import type { IconKey } from "../geo/categories";

const ICONS: Record<IconKey, LucideIcon> = {
  globe: Globe, map: Map, city: Building2, village: House, park: Trees, forest: TreePine, water: Waves, mountain: Mountain,
  island: TreePalm, beach: TreePalm, building: Building, house: House, school: School, university: GraduationCap,
  hospital: Hospital, church: Church, museum: Landmark, castle: Castle, landmark: Landmark, stadium: Trophy, pitch: Goal,
  pool: Droplets, golf: Flag, zoo: PawPrint, theme: FerrisWheel, airport: Plane, rail: TrainFront, parking: SquareParking,
  shop: ShoppingBag, mall: Store, cafe: Coffee, food: Utensils, hotel: Hotel, factory: Factory, farm: Tractor, camp: Tent,
  cemetery: Cross, office: Briefcase, bridge: Fence, pin: MapPin, object: Shapes, drawn: PenLine, ship: Ship, plane: Plane,
  animal: Fish, vehicle: Bus, space: Rocket, units: Ruler, sports: Dumbbell,
};

export function ShapeIcon({ icon, size = 16, ...rest }: { icon: IconKey; size?: number; className?: string; strokeWidth?: number }) {
  const C = ICONS[icon] || MapPin;
  return <C size={size} aria-hidden="true" {...rest} />;
}
