import type { DemoPersonaEmail } from "@opensesh/domain/server/schema/auth";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { KeyRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { qk } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDemoMode, switchDemoPersona } from "@/server-fns/auth";

const personas = [
  { email: "demo@opensesh.io", name: "Dana", detail: "Admin" },
  { email: "reviewer@opensesh.io", name: "Rey", detail: "Reviewer" },
  { email: "maya.chen@retrievallabs.ai", name: "Maya", detail: "Speaker · tasks complete" },
  { email: "lina.haddad@checkpoint.health", name: "Lina", detail: "Speaker · tasks pending" },
  { email: "jamal.reed@agentdesk.co", name: "Jamal", detail: "Speaker · bio missing" },
] satisfies ReadonlyArray<{
  readonly email: DemoPersonaEmail;
  readonly name: string;
  readonly detail: string;
}>;

export function DemoRoleSwitcher() {
  // Embeds render inside customers' sites — demo chrome must never ship there.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const embedded = pathname.startsWith("/embed");
  const demoMode = useQuery({
    queryKey: qk.viewer.demoMode,
    queryFn: () => getDemoMode(),
    enabled: !embedded,
  });
  const [switching, setSwitching] = useState(false);
  // The demo-mode query streams into the cache during SSR, so gating on it
  // directly would make the first client render diverge from the server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (embedded || !mounted || demoMode.data !== true) {
    return null;
  }

  const choose = async (email: DemoPersonaEmail) => {
    setSwitching(true);
    const result = await switchDemoPersona({ data: { email } });
    if (result.ok) {
      window.location.assign(result.data.target);
      return;
    }
    toast.error(result.error.message);
    setSwitching(false);
  };

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="shadow-lg" disabled={switching}>
            <KeyRoundIcon />
            Demo roles
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-60">
          <DropdownMenuLabel className="text-xs">Instant sign-in</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {personas.map((persona) => (
            <DropdownMenuItem
              key={persona.email}
              className="items-start py-1.5 text-xs"
              onClick={() => void choose(persona.email)}
            >
              <span className="flex flex-col">
                <span className="text-xs font-medium">{persona.name}</span>
                <span className="text-xs text-muted-foreground">{persona.detail}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
