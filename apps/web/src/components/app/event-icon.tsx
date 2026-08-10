import { useEffect, useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { cn } from "@/lib/utils";

export function EventIcon({
  src,
  size,
  className,
}: {
  readonly src: string | null;
  readonly size: 16 | 24 | 28 | 32 | 48;
  readonly className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const sizeClass =
    size === 16
      ? "size-4"
      : size === 24
        ? "size-6"
        : size === 28
          ? "size-7"
          : size === 32
            ? "size-8"
            : "size-12";
  return src === null || failed ? (
    <BrandMark className={cn(sizeClass, "rounded-md", className)} />
  ) : (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn(sizeClass, "shrink-0 rounded-md object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
