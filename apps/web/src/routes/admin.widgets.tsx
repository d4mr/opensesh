import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WidgetBuilder } from "@/components/admin/widget-builder";
export const Route = createFileRoute("/admin/widgets")({
  validateSearch: (search: Record<string, unknown>) => ({
    widget: typeof search.widget === "string" ? search.widget : undefined,
  }),
  component: WidgetsPage,
});
function WidgetsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { widget } = Route.useSearch();
  return (
    <WidgetBuilder
      selectedId={widget}
      select={(id) => void navigate({ search: { widget: id }, replace: true })}
    />
  );
}
