export function PagePlaceholder({ title }: { readonly title: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This workspace is ready for the next work package.
      </p>
    </div>
  );
}
