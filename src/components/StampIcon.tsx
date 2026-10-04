import { Coffee, Gift, Scissors, Stamp, Star, Utensils } from "lucide-react";

export const stampIconOptions = ["coffee", "stamp", "scissors", "food", "gift", "star"] as const;
export type StampIconName = (typeof stampIconOptions)[number];

const icons = {
  coffee: Coffee,
  stamp: Stamp,
  scissors: Scissors,
  food: Utensils,
  gift: Gift,
  star: Star,
};

export function StampIcon({ name = "stamp", className }: { name?: string | null; className?: string }) {
  const Icon = icons[name as StampIconName] ?? Stamp;
  return <Icon className={className} />;
}