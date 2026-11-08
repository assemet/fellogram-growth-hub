import type { ReactNode } from "react";

/**
 * The one card style for grouped settings (program editor, app settings, store settings): a titled card with an
 * optional description and an optional control (usually a switch) at the end of the title row.
 */
export function SettingsCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)] ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-snug">{title}</h2>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}
