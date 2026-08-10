export function PagePlaceholder({ title }: { readonly title: string }) {
  return (
    <div className="flex w-full flex-col gap-1 p-4 text-sm lg:p-6 sm:flex-row sm:items-baseline sm:gap-3">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">
        This workspace is ready for the next work package.
      </p>
    </div>
  );
}
