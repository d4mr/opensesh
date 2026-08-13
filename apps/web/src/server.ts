import handler from "@tanstack/react-start/server-entry";

import {
  runDemoReset,
  runMailQueueBatch,
  runMailSweep,
  runScheduledTaskReminders,
} from "@/server/runtime";
import type { MailQueueMessage } from "@/server/mail-queue";

// Documents must revalidate on every load: without this, browsers
// heuristically cache the HTML shell and keep referencing deleted asset
// hashes after a deploy. Hashed assets keep their immutable caching.
export default {
  async fetch(request) {
    const response = await handler.fetch(request);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html") && !response.headers.has("cache-control")) {
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-cache");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  },
  async scheduled(controller, env) {
    if (controller.cron === "*/15 * * * *") {
      const result = await runDemoReset(env);
      console.log(JSON.stringify({ event: "demo_reset_completed", ...result }));
    } else {
      const result = await runScheduledTaskReminders(env, new Date(controller.scheduledTime));
      console.log(JSON.stringify({ event: "task_reminders_completed", ...result }));
    }
    const sweep = await runMailSweep(env, new Date(controller.scheduledTime));
    console.log(JSON.stringify({ event: "mail_sweep_completed", ...sweep }));
  },
  async queue(batch, env) {
    await runMailQueueBatch(env, batch);
  },
} satisfies ExportedHandler<Cloudflare.Env, MailQueueMessage>;
