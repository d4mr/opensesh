import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DashboardStats {
  readonly submissions: number;
  readonly pending: number;
  readonly accepted: number;
  readonly speakers: number;
}

export function SectionCards({ stats }: { readonly stats: DashboardStats }) {
  const cards = [
    {
      label: "Total submissions",
      value: stats.submissions,
      badge: "All formats",
      detail: "Abstracts and sessions in this event",
    },
    {
      label: "Pending review",
      value: stats.pending,
      badge: "Pending",
      detail: "Ready for evaluator decisions",
    },
    {
      label: "Accepted sessions",
      value: stats.accepted,
      badge: "Accepted",
      detail: "Confirmed in the working program",
    },
    {
      label: "Speakers",
      value: stats.speakers,
      badge: "Contacts",
      detail: "People attached to this event",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">{card.badge}</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">{card.detail}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
