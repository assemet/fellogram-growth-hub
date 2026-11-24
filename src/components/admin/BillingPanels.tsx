import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SettingsCard } from "@/components/SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminActivatePlan,
  adminCancelPlan,
  adminGrantTrialToExisting,
  adminReferrals,
  adminRefundStars,
  adminReviewReferral,
  adminSetWebhook,
  adminStarsPayments,
  adminWebhookInfo,
  adminSavePlan,
  adminSaveSettings,
  type AdminBilling,
  type AdminReferral,
  type AdminSubscription,
} from "@/lib/admin.functions";
import { PLAN_FEATURES, PRICE_GROUPS, type Plan, type PlatformSettings, type PriceGroup } from "@/lib/billing";

/** Platform owner only, so deliberately not translated (like the rest of /admin). */
const day = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });
const selectClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

function errorText(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? error);
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <Input type="number" inputMode="decimal" step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))} className="mt-1 h-11 text-foreground" dir="ltr" />
    </label>
  );
}

function PlanEditor({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const save = useServerFn(adminSavePlan);
  const [draft, setDraft] = useState<Plan>(plan);
  const mutation = useMutation({ mutationFn: (p: Plan) => save({ data: p }), onSuccess: onSaved });
  const toggleFeature = (key: Plan["features"][number]) =>
    setDraft((d) => ({ ...d, features: d.features.includes(key) ? d.features.filter((f) => f !== key) : [...d.features, key] }));

  return (
    <details className="rounded-lg border border-border bg-background p-3">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-semibold">
        <span>
          {plan.name} <span dir="ltr" className="text-xs font-normal text-muted-foreground">({plan.code})</span>
          {!plan.active && <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-xs">مخفية</span>}
        </span>
        <span dir="ltr" className="text-xs font-normal text-muted-foreground">${plan.prices.A} / ${plan.prices.B} / ${plan.prices.C}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <label className="block text-xs text-muted-foreground">
          الاسم
          <Input value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 h-11 text-foreground" />
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PRICE_GROUPS.map((g: PriceGroup) => (
            <NumberField key={g} label={`سعر ${g} ($)`} step={0.5} value={draft.prices[g]} onChange={(v) => setDraft({ ...draft, prices: { ...draft.prices, [g]: v } })} />
          ))}
        </div>
        <NumberField label="عدد الكاشيريين" value={draft.maxCashiers} onChange={(v) => setDraft({ ...draft, maxCashiers: v })} />
        <fieldset className="space-y-1">
          <legend className="text-xs text-muted-foreground">الميزات</legend>
          {PLAN_FEATURES.map((f) => (
            <label key={f.key} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={draft.features.includes(f.key)} onChange={() => toggleFeature(f.key)} />
              {f.label}
            </label>
          ))}
        </fieldset>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          ظاهرة (غير المخفية)
        </label>
        {mutation.isError && <p role="alert" className="text-sm text-destructive">تعذّر الحفظ: {errorText(mutation.error)}</p>}
        {mutation.isSuccess && <p className="text-sm text-muted-foreground">تم الحفظ.</p>}
        <Button type="button" disabled={mutation.isPending} className="h-11 w-full" onClick={() => mutation.mutate(draft)}>
          حفظ الباقة
        </Button>
      </div>
    </details>
  );
}

export function PlansCard({ billing, onSaved }: { billing: AdminBilling; onSaved: () => void }) {
  return (
    <SettingsCard title="الباقات والأسعار" description="الأسعار بالدولار شهرياً لكل مجموعة تجريب (A/B/C). لا شيء مقفل في التطبيق بعد؛ هذه البيانات فقط.">
      {billing.plans.map((plan) => (
        <PlanEditor key={`${plan.code}-${plan.sort}-${plan.name}-${JSON.stringify(plan.prices)}-${plan.maxCashiers}-${plan.features.join()}-${plan.active}`} plan={plan} onSaved={onSaved} />
      ))}
    </SettingsCard>
  );
}

export function SettingsPanel({ settings, plans, onSaved }: { settings: PlatformSettings; plans: Plan[]; onSaved: () => void }) {
  const save = useServerFn(adminSaveSettings);
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const mutation = useMutation({ mutationFn: (s: PlatformSettings) => save({ data: s }), onSuccess: onSaved });
  const set = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <SettingsCard title="التجربة والإحالة" description="القيم تُقرأ من قاعدة البيانات، وتغييرها لا يحتاج نسخة جديدة.">
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-5" checked={draft.enforceLimits} onChange={(e) => set("enforceLimits", e.target.checked)} />
          تفعيل حدود الباقات
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          مغلق: كل المحلات تستعمل كل الميزات كما اليوم. مفتوح: المحل بلا اشتراك يُعامل كباقة مجانية ويفقد الميزات المقفلة، والمحل المشترك يحصل على ميزات باقته فقط. فعّله بعد أن تفعّل باقات المحلات التي تريد إبقاء ميزاتها.
        </p>
      </div>
      <div className="space-y-2 rounded-lg border border-border p-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-5" checked={draft.trialEnabled} onChange={(e) => set("trialEnabled", e.target.checked)} />
          التجربة التلقائية للمحلات الجديدة
        </label>
        <label className="block text-xs text-muted-foreground">
          باقة التجربة (ميزاتها يحصل عليها المحل أثناء التجربة)
          <select className={`${selectClass} mt-1 text-foreground`} value={draft.trialPlan} onChange={(e) => set("trialPlan", e.target.value)}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="أيام التجربة" value={draft.trialDays} onChange={(v) => set("trialDays", v)} />
        <NumberField label="أيام التمديد" value={draft.trialExtendDays} onChange={(v) => set("trialExtendDays", v)} />
        <NumberField label="أختام لاستحقاق التمديد" value={draft.trialExtendMinStamps} onChange={(v) => set("trialExtendMinStamps", v)} />
        <NumberField label="أشهر مكافأة الإحالة" value={draft.referralRewardMonths} onChange={(v) => set("referralRewardMonths", v)} />
        <NumberField label="سقف الأشهر المجانية" value={draft.referralCapMonths} onChange={(v) => set("referralCapMonths", v)} />
        <NumberField label="أيام تأخير المكافأة" value={draft.referralReleaseDays} onChange={(v) => set("referralReleaseDays", v)} />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" checked={draft.referralEnabled} onChange={(e) => set("referralEnabled", e.target.checked)} />
        الإحالة مفعّلة
      </label>
      <div className="space-y-2 rounded-lg border border-border p-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-5" checked={draft.starsEnabled} onChange={(e) => set("starsEnabled", e.target.checked)} />
          الدفع بنجوم تيليجرام مفعّل
        </label>
        <NumberField label="عدد النجوم لكل 1 دولار من السعر" value={draft.starsPerUsd} onChange={(v) => set("starsPerUsd", v)} />
        <p className="text-xs text-muted-foreground">فعّله بعد تسجيل الـ webhook واختبار دفعة صغيرة. السعر بالنجوم = سعر الباقة × الأشهر × هذا الرقم.</p>
      </div>
      <label className="block text-xs text-muted-foreground">
        مجموعة تجريب الأسعار الحالية
        <select className={`${selectClass} mt-1 text-foreground`} value={draft.pricingGroup} onChange={(e) => set("pricingGroup", e.target.value as PriceGroup)}>
          {PRICE_GROUPS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>
      {mutation.isError && <p role="alert" className="text-sm text-destructive">تعذّر الحفظ: {errorText(mutation.error)}</p>}
      {mutation.isSuccess && <p className="text-sm text-muted-foreground">تم الحفظ.</p>}
      <Button type="button" disabled={mutation.isPending} className="h-11 w-full" onClick={() => mutation.mutate(draft)}>
        حفظ الإعدادات
      </Button>
    </SettingsCard>
  );
}

/** Inside a store row: shows the current plan and lets the owner activate, extend, gift or end one. */
export function StorePlan({ storeId, billing, current }: { storeId: string; billing: AdminBilling; current: AdminSubscription | undefined }) {
  const queryClient = useQueryClient();
  const activate = useServerFn(adminActivatePlan);
  const cancel = useServerFn(adminCancelPlan);
  const firstPlan = billing.plans.find((p) => p.code !== "free")?.code ?? billing.plans[0]?.code ?? "";
  const [planCode, setPlanCode] = useState(firstPlan);
  const [months, setMonths] = useState(1);
  const [source, setSource] = useState<"manual" | "gift">("manual");
  const [note, setNote] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
  const give = useMutation({ mutationFn: () => activate({ data: { storeId, planCode, months, source, note } }), onSuccess: () => { setNote(""); void refresh(); } });
  const end = useMutation({ mutationFn: () => cancel({ data: { storeId } }), onSuccess: () => void refresh() });
  const planName = (code: string) => billing.plans.find((p) => p.code === code)?.name ?? code;

  return (
    <details className="mt-2 rounded-md border border-border p-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold">
        {current ? `الباقة: ${planName(current.planCode)} حتى ${day.format(new Date(current.endsAt))}` : "الباقة: مجانية (لا اشتراك)"}
      </summary>
      <div className="mt-2 space-y-2">
        {current && (
          <p className="text-xs text-muted-foreground">
            المصدر: {current.source}
            {current.note ? ` · ${current.note}` : ""}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <select className={selectClass} value={planCode} onChange={(e) => setPlanCode(e.target.value)} aria-label="الباقة">
            {billing.plans.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
          <select className={selectClass} value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="عدد الأشهر">
            {[1, 2, 3, 6, 12, 24].map((m) => (
              <option key={m} value={m}>{m} شهر</option>
            ))}
          </select>
        </div>
        <select className={selectClass} value={source} onChange={(e) => setSource(e.target.value as "manual" | "gift")} aria-label="المصدر">
          <option value="manual">تحصيل يدوي (مدفوع)</option>
          <option value="gift">هدية مجانية</option>
        </select>
        <Input value={note} maxLength={200} placeholder="ملاحظة، مثل رقم الحوالة" onChange={(e) => setNote(e.target.value)} className="h-11" />
        {(give.isError || end.isError) && <p role="alert" className="text-sm text-destructive">تعذّر التنفيذ: {errorText(give.error ?? end.error)}</p>}
        <div className="flex gap-2">
          <Button type="button" disabled={give.isPending || !planCode} className="h-11 flex-1" onClick={() => give.mutate()}>
            {current && current.planCode === planCode ? "تمديد" : "تفعيل"}
          </Button>
          {current && (
            <Button type="button" variant="outline" disabled={end.isPending} className="h-11" onClick={() => end.mutate()}>
              إنهاء الباقة
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}

/** One-time button: the stores that exist today get the same trial a new store gets. */
export function ExistingTrialCard({ settings }: { settings: PlatformSettings }) {
  const grant = useServerFn(adminGrantTrialToExisting);
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({ mutationFn: () => grant(), onSuccess: () => setConfirming(false) });
  return (
    <SettingsCard title="تجربة للمحلات القائمة" description={`تمنح كل محل لم تُفعَّل له أي باقة من قبل تجربة ${settings.trialDays} يومًا بباقة ${settings.trialPlan} تبدأ الآن. المحلات التي سبق أن أخذت أي باقة لا تتأثر، فلا تتكرر التجربة.`}>
      {mutation.isSuccess && <p className="text-sm text-muted-foreground">مُنحت التجربة لـ {mutation.data.granted} محل، وتُرك {mutation.data.skipped}.</p>}
      {mutation.isError && <p role="alert" className="text-sm text-destructive">تعذّر التنفيذ: {errorText(mutation.error)}</p>}
      <Button type="button" variant={confirming ? "destructive" : "outline"} disabled={mutation.isPending} className="h-11 w-full" onClick={() => (confirming ? mutation.mutate() : setConfirming(true))}>
        {confirming ? "اضغط مرة أخرى للتأكيد" : "منح التجربة للمحلات القائمة"}
      </Button>
    </SettingsCard>
  );
}

const FLAG_LABELS: Record<string, string> = { same_name: "اسم متشابه", same_phone: "نفس الهاتف", same_address: "نفس العنوان" };
const STATUS_LABELS: Record<AdminReferral["status"], string> = { pending: "قيد الانتظار", review: "تحتاج مراجعة", rewarded: "تمت المكافأة", rejected: "مرفوضة" };

/** Store-to-store referrals; the ones that look like duplicates wait here for the owner's decision. */
export function ReferralsCard() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminReferrals);
  const review = useServerFn(adminReviewReferral);
  const query = useQuery({ queryKey: ["admin-referrals"], queryFn: () => load(), retry: false });
  const decide = useMutation({
    mutationFn: (input: { id: string; decision: "approve" | "reject" }) => review({ data: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-referrals"] }),
  });
  const list = query.data ?? [];
  return (
    <SettingsCard title="إحالات المحلات" description="الإحالة التي تتشابه فيها المحلات (الاسم أو الهاتف أو العنوان) لا تُكافأ حتى تقرر أنت.">
      {query.isError && <p role="alert" className="text-sm text-destructive">{errorText(query.error)}</p>}
      {decide.isError && <p role="alert" className="text-sm text-destructive">تعذّر التنفيذ: {errorText(decide.error)}</p>}
      {query.isSuccess && list.length === 0 && <p className="text-sm text-muted-foreground">لا توجد إحالات بعد.</p>}
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-background p-3 text-sm">
            <p className="font-semibold">
              {r.referrerName} ← {r.referredName}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {STATUS_LABELS[r.status]} · {day.format(new Date(r.createdAt))}
              {r.paidAt ? ` · دفع ${day.format(new Date(r.paidAt))}` : " · لم يدفع بعد"}
              {r.status === "rewarded" ? ` · أشهر المُحيل: ${r.rewardMonths}` : ""}
            </p>
            {r.flags.length > 0 && <p className="mt-1 text-xs font-semibold text-destructive">{r.flags.map((f) => FLAG_LABELS[f] ?? f).join("، ")}</p>}
            {r.status === "review" && (
              <div className="mt-2 flex gap-2">
                <Button type="button" className="h-11 flex-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: "approve" })}>
                  قبول
                </Button>
                <Button type="button" variant="outline" className="h-11 flex-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: "reject" })}>
                  رفض
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

const STARS_STATUS: Record<string, string> = { paid: "مدفوع", refunded: "مُسترد", failed: "فشل (راجعه يدويًا)" };

/** Webhook registration (one button) and the latest Stars payments, each with a refund button. */
export function StarsCard() {
  const queryClient = useQueryClient();
  const loadInfo = useServerFn(adminWebhookInfo);
  const setHook = useServerFn(adminSetWebhook);
  const loadPayments = useServerFn(adminStarsPayments);
  const refund = useServerFn(adminRefundStars);
  const info = useQuery({ queryKey: ["admin-webhook"], queryFn: () => loadInfo(), retry: false });
  const payments = useQuery({ queryKey: ["admin-stars"], queryFn: () => loadPayments(), retry: false });
  const register = useMutation({ mutationFn: () => setHook({ data: { origin: window.location.origin } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-webhook"] }) });
  const giveBack = useMutation({
    mutationFn: (id: string) => refund({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-stars"] }),
  });
  return (
    <SettingsCard title="الدفع بالنجوم" description="يحتاج متغير TELEGRAM_WEBHOOK_SECRET في Vercel (حروف وأرقام و _ و - فقط، 16 حرفًا أو أكثر).">
      {info.isError && <p role="alert" className="text-sm text-destructive">{errorText(info.error)}</p>}
      {info.data && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>السر مضبوط: {info.data.secretSet ? "نعم" : "لا — أضفه في Vercel ثم أعد النشر"}</p>
          <p className="break-all">العنوان الحالي: {info.data.url || "غير مسجّل"}</p>
          <p>معلّق: {info.data.pending}{info.data.lastError ? ` · آخر خطأ: ${info.data.lastError}` : ""}</p>
        </div>
      )}
      {register.isError && <p role="alert" className="text-sm text-destructive">تعذّر التسجيل: {errorText(register.error)}</p>}
      {register.isSuccess && <p className="text-sm text-muted-foreground">تم تسجيل الـ webhook.</p>}
      <Button type="button" variant="outline" className="h-11 w-full" disabled={register.isPending} onClick={() => register.mutate()}>
        تسجيل الـ webhook على هذا الموقع
      </Button>
      {giveBack.isError && <p role="alert" className="text-sm text-destructive">تعذّر الاسترداد: {errorText(giveBack.error)}</p>}
      {payments.isSuccess && (payments.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">لا توجد مدفوعات بعد.</p>}
      <ul className="space-y-2">
        {(payments.data ?? []).map((p) => (
          <li key={p.id} className="rounded-lg border border-border bg-background p-3 text-sm">
            <p className="font-semibold">{p.storeName} · {p.planCode} · {p.months} شهر · {p.stars} ⭐</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {STARS_STATUS[p.status] ?? p.status} · {day.format(new Date(p.paidAt ?? p.createdAt))}
              {p.note ? ` · ${p.note}` : ""}
            </p>
            {p.status === "paid" && (
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-11 w-full"
                disabled={giveBack.isPending}
                onClick={() => {
                  if (window.confirm("استرداد النجوم للمشتري وإنهاء الباقة التي اشتراها؟")) giveBack.mutate(p.id);
                }}
              >
                استرداد
              </Button>
            )}
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
