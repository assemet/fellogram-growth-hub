import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import type { PlanFeature } from "@/lib/billing";
import { getMyPlan, type MyPlan } from "@/lib/plans.functions";

/** The store's plan. While it loads, or when limits are not switched on, nothing is reported as locked. */
export function useMyPlan() {
  const { state } = useFellogramAuth();
  const load = useServerFn(getMyPlan);
  const query = useQuery({ queryKey: ["my-plan"], queryFn: () => load(), enabled: state === "ready", staleTime: 60_000 });
  return { plan: query.data, isLoading: query.isLoading };
}

export function isLocked(plan: MyPlan | undefined, feature: PlanFeature): boolean {
  return Boolean(plan && plan.enforced && !plan.features.includes(feature));
}
