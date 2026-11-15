import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terms of Use — Fellogram" },
      { name: "description", content: "The rules for using Fellogram." },
    ],
  }),
  component: () => <LegalPage kind="terms" />,
});
