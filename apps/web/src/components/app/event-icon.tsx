import { useEffect, useRef, useState } from "react";

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
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // An SSR-rendered image can error before hydration attaches onError —
    // detect that terminal state here or the broken glyph sticks.
    const element = imageRef.current;
    setFailed(element !== null && element.complete && element.naturalWidth === 0);
  }, [src]);
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
      ref={imageRef}
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn(sizeClass, "shrink-0 rounded-md object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
