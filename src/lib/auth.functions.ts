import { createServerFn } from "@tanstack/react-start";
import { createHmac, createHash } from "crypto";

/**
 * Telegram Mini App sign-in.
 *
 * Security model:
 * - The browser sends the raw `initData` string only. Nothing in it is trusted
 *   until the HMAC signature is validated here with the bot token.
 * - The Telegram user id is the single source of identity; the account, profile
 *   and session are all created server-side with privileged access.
 * - No secret ever reaches the browser: only a normal user session is returned.
 *
 * Preview fallback: while TELEGRAM_BOT_TOKEN is not configured, a fixed preview
 * identity is used so the flow can be reviewed outside Telegram.
 */

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24;

function verifyInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed !== hash) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_INIT_DATA_AGE_SECONDS) return null;

  const rawUser = params.get("user");
  if (!rawUser) return null;
  const user = JSON.parse(rawUser) as TelegramUser;
  return typeof user.id === "number" ? user : null;
}

function accountFor(telegramUserId: number, serviceKey: string) {
  const email = `tg-${telegramUserId}@telegram.fellogram.app`;
  const password = createHash("sha256")
    .update(`fellogram:telegram:${telegramUserId}:${serviceKey}`)
    .digest("hex");
  return { email, password };
}

export const telegramSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: { initData?: string }) => ({ initData: String(data?.initData ?? "") }))
  .handler(async ({ data }) => {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

    let tgUser: TelegramUser | null = null;
    let previewMode = false;

    if (botToken) {
      tgUser = data.initData ? verifyInitData(data.initData, botToken) : null;
      if (!tgUser) throw new Error("INVALID_TELEGRAM_INIT_DATA");
    } else {
      previewMode = true;
      tgUser = { id: 100000001, first_name: "Preview", username: "preview_user" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { email, password } = accountFor(tgUser.id, serviceKey);

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    let userId = existingProfile?.id ?? null;

    if (!userId) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { telegram_user_id: tgUser.id },
      });
      if (created.error && !created.error.message.toLowerCase().includes("already")) {
        throw new Error(created.error.message);
      }
      userId = created.data?.user?.id ?? null;
    }

    // Keep credentials deterministic even for accounts created earlier.
    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      await supabaseAdmin.from("profiles").upsert(
        {
          id: userId,
          telegram_user_id: tgUser.id,
          username: tgUser.username ?? null,
          first_name: tgUser.first_name ?? null,
          last_name: tgUser.last_name ?? null,
          avatar_url: tgUser.photo_url ?? null,
        },
        { onConflict: "id" },
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const authClient = createClient(process.env["SUPABASE_URL"]!, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (publishableKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${publishableKey}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", publishableKey);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const signIn = await authClient.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) throw new Error(signIn.error?.message ?? "SIGN_IN_FAILED");

    return {
      previewMode,
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
    };
  });
