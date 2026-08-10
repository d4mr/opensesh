import { Schema } from "effect";

export const MagicLinkRequest = Schema.Struct({
  email: Schema.String,
  callbackUrl: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^\//))),
});
export type MagicLinkRequest = typeof MagicLinkRequest.Type;

export const DemoPersonaEmail = Schema.Literals([
  "demo@opensesh.io",
  "reviewer@opensesh.io",
  "maya.chen@retrievallabs.ai",
  "lina.haddad@checkpoint.health",
  "jamal.reed@agentdesk.co",
]);
export type DemoPersonaEmail = typeof DemoPersonaEmail.Type;

export const DemoPersonaRequest = Schema.Struct({ email: DemoPersonaEmail });
export type DemoPersonaRequest = typeof DemoPersonaRequest.Type;
