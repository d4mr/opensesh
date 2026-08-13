import { DEMO_PERSONAS } from "@opensesh/domain/demo";
import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { switchDemoPersona } from "@/server-fns/auth";

export function UserMenu({
  context,
  user,
}: {
  readonly context: "admin" | "portal";
  readonly user: CurrentUserValue;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const initial = user.email.slice(0, 1).toUpperCase();
  // Persona switching only surfaces inside the demo workspace — the current
  // user has to BE a demo persona to move between them.
  const viewingDemo = DEMO_PERSONAS.some((persona) => persona.email === user.email);

  const logout = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };

  const choosePersona = async (email: (typeof DEMO_PERSONAS)[number]["email"]) => {
    const result = await switchDemoPersona({ data: { email } });
    if (result.ok) {
      window.location.assign(result.data.target);
      return;
    }
    toast.error(result.error.message);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open user menu">
          <Avatar className="size-8">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {viewingDemo ? (
          <>
            <DropdownMenuLabel className="text-xs">Demo personas</DropdownMenuLabel>
            {DEMO_PERSONAS.map((persona) => {
              const current = persona.email === user.email;
              return (
                <DropdownMenuItem
                  key={persona.email}
                  disabled={current}
                  className="items-start py-1.5"
                  onClick={() => void choosePersona(persona.email)}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-xs font-medium">{persona.name}</span>
                    <span className="text-xs text-muted-foreground">{persona.detail}</span>
                  </span>
                  {current ? <CheckIcon className="size-3.5" /> : null}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        ) : null}
        {context === "portal" && (user.roles.admin || user.roles.reviewer || user.roles.member) ? (
          <>
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <ArrowLeftIcon />
                Back to admin
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          {resolvedTheme === "dark" ? "Use light theme" : "Use dark theme"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
