import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { activeEventIdFromCookieHeader } from "@/lib/active-event";

export const getActiveEventIdCookie = createServerFn().handler(async () =>
  activeEventIdFromCookieHeader(getRequest().headers.get("cookie")),
);
