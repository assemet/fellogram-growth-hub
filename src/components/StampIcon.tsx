import {
  Apple, Award, Bath, Bike, BookOpen, Brush, Cake, Camera, Candy, Car, Cat, Coffee, Cookie, Crown, CupSoda, Croissant,
  Dog, Drumstick, Droplets, Dumbbell, Fish, Flame, Flower2, Fuel, Gem, Gift, GlassWater, Glasses, Heart, HeartPulse,
  IceCreamCone, Leaf, Milk, Music, PawPrint, Pill, Pizza, Salad, Sandwich, Scissors, ShoppingBag, Shirt, Smile, Soup,
  Sparkles, Stamp, Star, Stethoscope, Store, Tag, Ticket, TreePine, Utensils, Watch, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

import { STAMP_LOGO_ID, type StampIconId } from "@/lib/stamp-icons";

const stampIconComponents: Record<StampIconId, LucideIcon> = {
  stamp: Stamp, star: Star, crown: Crown, award: Award, zap: Zap, flame: Flame, music: Music, book: BookOpen, camera: Camera, ticket: Ticket,
  coffee: Coffee, croissant: Croissant, pizza: Pizza, sandwich: Sandwich, "ice-cream": IceCreamCone, cake: Cake, cookie: Cookie, food: Utensils,
  soup: Soup, salad: Salad, drumstick: Drumstick, fish: Fish, "glass-water": GlassWater, milk: Milk, "cup-soda": CupSoda, candy: Candy, apple: Apple,
  scissors: Scissors, sparkles: Sparkles, heart: Heart, flower: Flower2, droplets: Droplets, bath: Bath, smile: Smile, brush: Brush,
  gift: Gift, "shopping-bag": ShoppingBag, shirt: Shirt, gem: Gem, tag: Tag, store: Store, glasses: Glasses, watch: Watch,
  car: Car, wrench: Wrench, fuel: Fuel, bike: Bike,
  "paw-print": PawPrint, dog: Dog, cat: Cat, leaf: Leaf, tree: TreePine,
  dumbbell: Dumbbell, pill: Pill, stethoscope: Stethoscope, "heart-pulse": HeartPulse,
};

/**
 * One stamp glyph. `name="logo"` shows the store's own logo (needs `logoUrl`);
 * unknown ids and a missing logo fall back to the default stamp.
 */
export function StampIcon({
  name = "stamp",
  className,
  logoUrl,
  dim = false,
}: {
  name?: string | null | undefined;
  className?: string;
  logoUrl?: string | null;
  /** Empty-slot look for the logo variant (grayscale + faded). */
  dim?: boolean;
}) {
  if (name === STAMP_LOGO_ID && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${className ?? ""} rounded-full object-cover ${dim ? "opacity-40 grayscale" : ""}`}
      />
    );
  }
  const Icon = stampIconComponents[name as StampIconId] ?? Stamp;
  return <Icon className={className} />;
}
