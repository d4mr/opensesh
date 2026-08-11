import { agendaEndpoints } from "./routes/agenda";
import { crmEndpoints } from "./routes/crm";
import { eventEndpoints } from "./routes/events";
import { integrationEndpoints } from "./routes/integrations";
import { reviewEndpoints } from "./routes/reviews";
import { speakerEndpoints } from "./routes/speakers";
import { submissionEndpoints } from "./routes/submissions";
import { widgetEndpoints } from "./routes/widgets";
import type { ApiEndpoint } from "./types";

export const apiEndpoints: ReadonlyArray<ApiEndpoint> = [
  ...eventEndpoints,
  ...submissionEndpoints,
  ...speakerEndpoints,
  ...reviewEndpoints,
  ...agendaEndpoints,
  ...crmEndpoints,
  ...widgetEndpoints,
  ...integrationEndpoints,
];
