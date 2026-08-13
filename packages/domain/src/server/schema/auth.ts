import { Schema } from "effect";

import { DEMO_PERSONA_EMAILS } from "../../demo";

export const MagicLinkRequest = Schema.Struct({
  email: Schema.String,
  name: Schema.optionalKey(Schema.String),
  callbackUrl: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^\//))),
});
export type MagicLinkRequest = typeof MagicLinkRequest.Type;

export const DemoPersonaEmail = Schema.Literals(DEMO_PERSONA_EMAILS);
export type DemoPersonaEmail = typeof DemoPersonaEmail.Type;

export const DemoPersonaRequest = Schema.Struct({ email: DemoPersonaEmail });
export type DemoPersonaRequest = typeof DemoPersonaRequest.Type;
