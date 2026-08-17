import { LoaderCircleIcon, LockKeyholeIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

// A route's server call answered with a typed failure. A 401 means the
// session behind the page is gone (it expired, or the user signed out in
// another tab) — bounce through /login with a return path so sign-in lands
// back here, instead of stranding the user on error text.
export function RouteError({
  error,
  fullScreen = false,
}: {
  readonly error: { readonly status: number; readonly message: string };
  readonly fullScreen?: boolean;
}) {
  const signedOut = error.status === 401;
  useEffect(() => {
    if (!signedOut) return;
    const here = window.location.pathname + window.location.search;
    window.location.assign(`/login?error=session&redirect=${encodeURIComponent(here)}`);
  }, [signedOut]);

  const Wrapper = fullScreen ? "main" : "div";
  return (
    <Wrapper
      className={cn(
        "flex w-full items-center justify-center p-6",
        fullScreen ? "min-h-svh bg-muted/30" : "min-h-64 flex-1",
      )}
    >
      {signedOut ? (
        <Empty className="border-0 py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="rounded-full text-muted-foreground">
              <LoaderCircleIcon className="animate-spin" />
            </EmptyMedia>
            <EmptyTitle className="text-base">You were signed out</EmptyTitle>
            <EmptyDescription className="text-xs leading-relaxed">
              Taking you to sign-in — you&rsquo;ll land right back on this page.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline" size="sm">
              <a href="/login?error=session">Sign in now</a>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <FailureState error={error} />
      )}
    </Wrapper>
  );
}

function FailureState({
  error,
}: {
  readonly error: { readonly status: number; readonly message: string };
}) {
  const Icon =
    error.status === 403 ? LockKeyholeIcon : error.status === 404 ? SearchXIcon : TriangleAlertIcon;
  const title =
    error.status === 403
      ? "You don't have access"
      : error.status === 404
        ? "Not found"
        : "Something went wrong";
  return (
    <Empty className="border-0 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="rounded-full text-muted-foreground">
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription className="text-xs leading-relaxed">{error.message}</EmptyDescription>
      </EmptyHeader>
      {error.status >= 500 ? (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
