/**
 * What a friend sees after opening an invite link. The rule: if the store is known, land on that store, never on the
 * generic wallet. The invitation also survives a failed request: it is only discarded once the server has answered.
 */
export type ReferralStatus = "pending" | "self" | "already_member" | "disabled" | "invalid";
export type ReferralAnswer = { status: ReferralStatus; storeId: string | null };
export type Landing = { to: "wallet"; storeId: string | null } | { to: "join"; storeId: string };

export function referralLanding(answer: ReferralAnswer): Landing {
  const storeId = answer.storeId;
  if (!storeId) return { to: "wallet", storeId: null };
  // Invitations were switched off after the link was shared: the friend can still join the store normally.
  if (answer.status === "disabled") return { to: "join", storeId };
  // Joined just now, or was already a customer, or opened their own link: their card for this store.
  return { to: "wallet", storeId };
}

/**
 * Asks the server to accept the invitation, retrying when the request itself fails (cold start, dropped connection).
 * Returns null only when every attempt failed, so the caller keeps the invitation and tries again later.
 */
export async function acceptWithRetry(
  call: () => Promise<ReferralAnswer>,
  wait: (ms: number) => Promise<void>,
  attempts = 3,
): Promise<ReferralAnswer | null> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await call();
    } catch (error) {
      // A malformed or unknown code will never work: no point retrying.
      if (String((error as Error)?.message ?? "").includes("REFERRAL_INVALID")) return { status: "invalid", storeId: null };
      if (i < attempts - 1) await wait(1200 * (i + 1));
    }
  }
  return null;
}
