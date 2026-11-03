import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMyContext } from "@/lib/store.functions";

/** Who the signed-in person is (profile, store they own, store they work at). Shared cache key with the wallet. */
export function useMyContext(enabled = true) {
  const loadContext = useServerFn(getMyContext);
  return useQuery({ queryKey: ["my-context"], queryFn: () => loadContext(), enabled });
}
