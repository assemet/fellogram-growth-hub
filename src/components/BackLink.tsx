import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** The "back to ..." link at the top of an inner screen. The arrow mirrors itself in right-to-left languages. */
export function BackLink({ to, children }: { to: "/merchant" | "/wallet"; children: ReactNode }) {
  return (
    <Link to={to} className="touch-action inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-bold text-secondary-foreground shadow-sm transition-colors hover:bg-accent">
      <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
      {children}
    </Link>
  );
}
