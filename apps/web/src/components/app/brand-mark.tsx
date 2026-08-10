import { useState } from "react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { readonly className?: string }) {
  const [lightFailed, setLightFailed] = useState(false);
  const [darkFailed, setDarkFailed] = useState(false);

  return (
    <span aria-hidden="true" className={cn("relative block size-8 shrink-0", className)}>
      {lightFailed ? (
        <span className="absolute inset-0 grid place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground dark:hidden">
          OS
        </span>
      ) : (
        <img
          alt=""
          className="absolute inset-0 size-full object-contain dark:hidden"
          src="/brand/logo.svg"
          onError={() => setLightFailed(true)}
        />
      )}
      {darkFailed ? (
        <span className="absolute inset-0 hidden place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground dark:grid">
          OS
        </span>
      ) : (
        <img
          alt=""
          className="absolute inset-0 hidden size-full object-contain dark:block"
          src="/brand/logo-dark.svg"
          onError={() => setDarkFailed(true)}
        />
      )}
    </span>
  );
}
