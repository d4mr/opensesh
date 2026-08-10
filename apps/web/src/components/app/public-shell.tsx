import { Outlet } from "@tanstack/react-router";

export function PublicShell({ eventName }: { readonly eventName: string }) {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-center px-4 text-center text-sm font-semibold">
          {eventName}
        </div>
      </header>
      <Outlet />
    </div>
  );
}
