// The demo workspace: a public sandbox anyone can enter from the landing
// page. Its personas live on demo.opensesh.io — a domain we control that the
// mail layer never delivers to — and its data is reset from seed on a cron.
// The eval workspace holds only what the SessionBoard Eval Kit cannot create
// itself: password accounts. Everything else the evaluator builds.

export const DEMO_ORG_ID = "org_ai_engineer";
export const EVAL_ORG_ID = "org_devflow";

export const DEMO_EVENT_SLUG = "ai-engineer-nyc-2026";

export const DEMO_PASSWORD = "demo-pass-2027";

export const DEMO_PERSONA_EMAILS = [
  "dana@demo.opensesh.io",
  "rey@demo.opensesh.io",
  "maya@demo.opensesh.io",
  "lina@demo.opensesh.io",
  "jamal@demo.opensesh.io",
] as const;
export type DemoPersonaEmail = (typeof DEMO_PERSONA_EMAILS)[number];

export const DEMO_PERSONAS: ReadonlyArray<{
  readonly email: DemoPersonaEmail;
  readonly name: string;
  readonly detail: string;
  readonly target: string;
}> = [
  { email: "dana@demo.opensesh.io", name: "Dana", detail: "Admin", target: "/admin" },
  { email: "rey@demo.opensesh.io", name: "Rey", detail: "Reviewer", target: "/admin/evaluation" },
  {
    email: "maya@demo.opensesh.io",
    name: "Maya",
    detail: "Speaker · tasks complete",
    target: "/portal",
  },
  {
    email: "lina@demo.opensesh.io",
    name: "Lina",
    detail: "Speaker · tasks pending",
    target: "/portal",
  },
  {
    email: "jamal@demo.opensesh.io",
    name: "Jamal",
    detail: "Speaker · bio missing",
    target: "/portal",
  },
];

// Domains that must never receive real mail: RFC 2606 reserved names the
// eval fixtures use, and the demo personas' own domain. Sends to them are
// recorded in the email log but never handed to a transport — a hard bounce
// from a fixture address would damage sender reputation.
const NEVER_DELIVER_DOMAINS =
  /(^|\.)(example\.(com|org|net)|demo\.opensesh\.io)$|\.(test|invalid|localhost|example)$/i;

export const deliverableRecipient = (email: string) => {
  const at = email.lastIndexOf("@");
  return at !== -1 && !NEVER_DELIVER_DOMAINS.test(email.slice(at + 1));
};
