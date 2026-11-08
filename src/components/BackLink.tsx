import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/** The "back to ..." link at the top of an inner screen. The chevron mirrors itself in right-to-left languages. */
export function BackLink({ to, children }: { to: "/merchant" | "/wallet"; children: ReactNode }) {
  return (
    <Link to={to} className="touch-action -ms-1 inline-flex min-h-10 items-center gap-0.5 text-sm font-semibold text-primary">
      <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      {children}
    </Link>
  );
}
