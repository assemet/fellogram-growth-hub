import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Fellogram" },
      { name: "description", content: "What Fellogram collects, why, and how to delete it." },
    ],
  }),
  component: () => <LegalPage kind="privacy" />,
});
