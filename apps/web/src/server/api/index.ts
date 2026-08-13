import { agendaEndpoints } from "./routes/agenda";
import { crmEndpoints } from "./routes/crm";
import { evaluationEndpoints } from "./routes/evaluation";
import { eventEndpoints } from "./routes/events";
import { integrationEndpoints } from "./routes/integrations";
import { reviewEndpoints } from "./routes/reviews";
import { resourceEndpoints } from "./routes/resources";
import { sessionEndpoints } from "./routes/sessions";
import { speakerEndpoints } from "./routes/speakers";
import { submissionEndpoints } from "./routes/submissions";
import { widgetEndpoints } from "./routes/widgets";
import type { ApiEndpoint } from "./types";

export const apiEndpoints: ReadonlyArray<ApiEndpoint> = [
  ...eventEndpoints,
  ...submissionEndpoints,
  ...sessionEndpoints,
  ...speakerEndpoints,
  ...reviewEndpoints,
  ...evaluationEndpoints,
  ...resourceEndpoints,
  ...agendaEndpoints,
  ...crmEndpoints,
  ...widgetEndpoints,
  ...integrationEndpoints,
];
