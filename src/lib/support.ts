/**
 * Where "Email us" goes. Set VITE_SUPPORT_EMAIL in the hosting environment variables; when it is empty the contact
 * card is simply not shown, so the address never has to live in the code.
 */
export const SUPPORT_EMAIL = String(import.meta.env["VITE_SUPPORT_EMAIL"] ?? "").trim();

export type SupportDetails = {
  subject: string;
  intro: string;
  locale: string;
  role: "customer" | "cashier" | "owner";
  userId?: string | null | undefined;
  storeId?: string | null | undefined;
};

/** A ready-to-send email: the person writes above the line, the details under it help us find their account. */
export function supportMailto(email: string, details: SupportDetails): string {
  const lines = [
    "",
    "",
    details.intro,
    "----------",
    "App: Fellogram",
    `Language: ${details.locale}`,
    `Role: ${details.role}`,
    ...(details.userId ? [`User: ${details.userId}`] : []),
    ...(details.storeId ? [`Store: ${details.storeId}`] : []),
  ];
  return `mailto:${email}?subject=${encodeURIComponent(details.subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
