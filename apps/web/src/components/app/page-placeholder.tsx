export function PagePlaceholder({
  title,
  action,
}: {
  readonly title: string;
  readonly action?: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 p-4 text-sm lg:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          This workspace is ready for the next work package.
        </p>
      </div>
      {action}
    </div>
  );
}
