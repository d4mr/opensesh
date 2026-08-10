import type { DemoPersonaEmail } from "@opensesh/domain/server/schema/auth";
import { useQuery } from "@tanstack/react-query";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";

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
  const demoMode = useQuery({ queryKey: ["demo-mode"], queryFn: () => getDemoMode() });
  const [switching, setSwitching] = useState(false);

  if (demoMode.data !== true) {
    return null;
  }

  const choose = async (email: DemoPersonaEmail) => {
    setSwitching(true);
    const result = await switchDemoPersona({ data: { email } });
    if (result.ok) {
      window.location.assign(result.data.target);
      return;
    }
    setSwitching(false);
  };

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="pressable shadow-lg" disabled={switching}>
            <KeyRoundIcon />
            Demo roles
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-64">
          <DropdownMenuLabel>Instant sign-in</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {personas.map((persona) => (
            <DropdownMenuItem
              key={persona.email}
              className="pressable items-start"
              onSelect={() => void choose(persona.email)}
            >
              <span className="flex flex-col">
                <span className="font-medium">{persona.name}</span>
                <span className="text-xs text-muted-foreground">{persona.detail}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
