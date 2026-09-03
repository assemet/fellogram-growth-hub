import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { createStore } from "@/lib/store.functions";

export const Route = createFileRoute("/merchant/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create your store — Fellogram" },
      { name: "description", content: "Set up your store and stamp-based loyalty program in under a minute." },
      { property: "og:title", content: "Create your store — Fellogram" },
      { property: "og:description", content: "Launch a Telegram loyalty program for your business." },
    ],
  }),
  component: NewStore;
});

function NewStore() {
  return null;
}
