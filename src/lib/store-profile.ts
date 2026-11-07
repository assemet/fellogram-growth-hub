import { throwIfError, type Db } from "@/lib/db";
import { CONTACT_COLUMNS, CONTACT_FIELDS, type ContactValues } from "@/lib/store-contact";

const isMissingColumn = (error: { code?: string } | null) => error?.code === "42703" || error?.code === "PGRST204";

/**
 * Saves the store's name, description and contact details. A database that has not run the contact migration
 * yet still saves name and description as long as no contact detail is being set.
 */
export async function writeStoreProfile(
  db: Db,
  storeId: string,
  profile: { name: string; description: string | null; contact: ContactValues | null },
): Promise<void> {
  const base = { name: profile.name, description: profile.description };
  if (!profile.contact) {
    throwIfError((await db.from("stores").update(base).eq("id", storeId)).error, "STORE_UPDATE_FAILED");
    return;
  }
  const contactColumns = Object.fromEntries(CONTACT_FIELDS.map((field) => [CONTACT_COLUMNS[field], profile.contact![field]]));
  let { error } = await db.from("stores").update({ ...base, ...contactColumns }).eq("id", storeId);
  if (isMissingColumn(error)) {
    if (CONTACT_FIELDS.some((field) => profile.contact![field])) throw new Error("DB_MIGRATION_REQUIRED");
    ({ error } = await db.from("stores").update(base).eq("id", storeId));
  }
  throwIfError(error, "STORE_UPDATE_FAILED");
}
