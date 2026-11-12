import { POSTER_FORMATS, type PosterFormat, type PosterFormatId } from "@/lib/poster";
import { t } from "@/lib/i18n";

const LABEL: Record<PosterFormatId, () => string> = {
  a4: () => "A4",
  a5: () => "A5",
  a6: () => "A6",
  square: () => t("poster.format.square"),
  story: () => t("poster.format.story"),
};

/** Size chips for the poster: three paper sizes to print, two image sizes for social media. */
export function PosterFormatPicker({ value, onChange }: { value: PosterFormat; onChange: (format: PosterFormat) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{t("poster.format.title")}</p>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={t("poster.format.title")}>
        {POSTER_FORMATS.map((format) => (
          <button
            key={format.id}
            type="button"
            role="radio"
            aria-checked={value.id === format.id}
            onClick={() => onChange(format)}
            className={`touch-action h-10 rounded-md border px-1 text-xs font-bold ${value.id === format.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
          >
            {LABEL[format.id]()}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t(`poster.format.${value.id}.hint`)}</p>
    </div>
  );
}
