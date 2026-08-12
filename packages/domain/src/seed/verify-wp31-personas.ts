import { Effect, Layer } from "effect";

import {
  getCurrentUser,
  makeCurrentUserLiveWith,
  requireEventAccess,
  type SessionIdentity,
} from "../server/current-user";
import { Db, makeDatabase } from "../server/db";
import { Events, ReviewDesk, makeRepositoriesLiveWith } from "../server/repos";
import { run } from "../server/runtime";

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const dbLive = Layer.succeed(Db, { database: makeDatabase(connectionString) });
const aie = "evt_aie_nyc_2026";
const devflow = "evt_devflow_2027";

const as = (identity: SessionIdentity) =>
  Layer.mergeAll(
    makeRepositoriesLiveWith(dbLive),
    makeCurrentUserLiveWith(dbLive, Effect.succeed(identity)),
  );

const dana: SessionIdentity = {
  userId: "usr_dana",
  email: "demo@opensesh.io",
  name: "Dana Organizer",
};
const jordan: SessionIdentity = {
  userId: "usr_jordan",
  email: "jordan.organizer@sbek-test.example.com",
  name: "Jordan Alvarez",
};
const rey: SessionIdentity = {
  userId: "usr_rey",
  email: "reviewer@opensesh.io",
  name: "Rey Reviewer",
};
const maya: SessionIdentity = {
  userId: "usr_maya",
  email: "maya.chen@retrievallabs.ai",
  name: "Maya Chen",
};

const outcome = <A, R>(label: string, effect: Effect.Effect<A, unknown, R>) =>
  effect.pipe(
    Effect.map((value) => ({ label, result: "allowed" as const, value })),
    Effect.catch((error) =>
      Effect.succeed({
        label,
        result: "denied" as const,
        value: (error as { readonly _tag?: string })._tag ?? String(error),
      }),
    ),
  );

const main = async () => {
  const checks: Array<{ label: string; pass: boolean; detail: string }> = [];
  const record = (label: string, pass: boolean, detail: string) =>
    checks.push({ label, pass, detail });

  // Dana: org owner, ZERO devflow event_members row.
  {
    const program = Effect.gen(function* () {
      const admin = yield* outcome("dana devflow admin", requireEventAccess(devflow, "admin"));
      const desk = yield* ReviewDesk;
      const list = yield* desk.list(devflow);
      const detailTarget = list.submissions[0];
      const detail =
        detailTarget === undefined ? null : yield* desk.detail(devflow, detailTarget.id);
      const events = yield* Events;
      const admins = yield* events.listAdmins(devflow);
      const user = yield* getCurrentUser;
      return { admin, listCount: list.submissions.length, detail, admins, user };
    });
    const result = await run(program, as(dana));
    if (!result.ok) {
      record("dana devflow", false, result.error.message);
    } else {
      record(
        "dana devflow admin access",
        result.data.admin.result === "allowed",
        JSON.stringify(result.data.admin.value),
      );
      record(
        "dana devflow desk list non-empty",
        result.data.listCount > 0,
        `${result.data.listCount} submissions`,
      );
      record(
        "dana devflow desk detail",
        result.data.detail !== null,
        result.data.detail?.submission.code ?? "none",
      );
      record(
        "dana in devflow listAdmins",
        result.data.admins.some((a) => a.id === "usr_dana"),
        result.data.admins.map((a) => `${a.id}:${a.name}`).join(", "),
      );
      record(
        "jordan (event-scoped) also in devflow listAdmins",
        result.data.admins.some((a) => a.id === "usr_jordan"),
        "",
      );
      record(
        "dana orgRole owner",
        result.data.user.orgRole === "owner",
        String(result.data.user.orgRole),
      );
    }
  }

  // Jordan: org member + devflow event admin.
  {
    const program = Effect.gen(function* () {
      const devflowAdmin = yield* outcome(
        "jordan devflow admin",
        requireEventAccess(devflow, "admin"),
      );
      const aieAdmin = yield* outcome("jordan aie admin", requireEventAccess(aie, "admin"));
      const aieStaff = yield* outcome("jordan aie staff", requireEventAccess(aie, "staff"));
      const user = yield* getCurrentUser;
      return { devflowAdmin, aieAdmin, aieStaff, user };
    });
    const result = await run(program, as(jordan));
    if (!result.ok) {
      record("jordan", false, result.error.message);
    } else {
      record("jordan devflow admin allowed", result.data.devflowAdmin.result === "allowed", "");
      record(
        "jordan aie admin DENIED",
        result.data.aieAdmin.result === "denied" && result.data.aieAdmin.value === "Forbidden",
        JSON.stringify(result.data.aieAdmin.value) ?? "",
      );
      record(
        "jordan aie staff allowed (org member)",
        result.data.aieStaff.result === "allowed",
        "",
      );
      record(
        "jordan orgRole member",
        result.data.user.orgRole === "member",
        String(result.data.user.orgRole),
      );
    }
  }

  // Rey: reviewer overlay on aie only.
  {
    const program = Effect.gen(function* () {
      const reviewer = yield* outcome("rey aie reviewer", requireEventAccess(aie, "reviewer"));
      const adminDenied = yield* outcome("rey aie admin", requireEventAccess(aie, "admin"));
      const desk = yield* ReviewDesk;
      const queue = yield* desk.evaluationQueue({ userId: "usr_rey", isAdmin: false }, aie);
      const trackNames = new Set(
        queue.items.flatMap((item) => item.submission.tracks.map((track) => track.name)),
      );
      return { reviewer, adminDenied, total: queue.total, trackNames: [...trackNames] };
    });
    const result = await run(program, as(rey));
    if (!result.ok) {
      record("rey", false, result.error.message);
    } else {
      record("rey aie reviewer allowed", result.data.reviewer.result === "allowed", "");
      record(
        "rey aie admin DENIED",
        result.data.adminDenied.result === "denied" &&
          result.data.adminDenied.value === "Forbidden",
        JSON.stringify(result.data.adminDenied.value) ?? "",
      );
      record(
        "rey queue track-scoped",
        result.data.total > 0 &&
          result.data.trackNames.every(
            (name) => name === "Agents" || name === "Evals & Observability",
          ),
        `${result.data.total} items in tracks: ${result.data.trackNames.join(", ")}`,
      );
    }
  }

  // Maya: contact-only speaker — portal identity intact, no event access.
  {
    const program = Effect.gen(function* () {
      const user = yield* getCurrentUser;
      const denied = yield* outcome("maya aie staff", requireEventAccess(aie, "staff"));
      return { user, denied };
    });
    const result = await run(program, as(maya));
    if (!result.ok) {
      record("maya", false, result.error.message);
    } else {
      record(
        "maya contact-only portal identity",
        result.data.user.roles.contactId !== undefined && result.data.user.orgRole === null,
        `contactId=${result.data.user.roles.contactId ?? "none"}`,
      );
      record(
        "maya staff access DENIED",
        result.data.denied.result === "denied",
        JSON.stringify(result.data.denied.value) ?? "",
      );
    }
  }

  console.table(
    checks.map(({ label, pass, detail }) => ({ label, status: pass ? "ok" : "FAIL", detail })),
  );
  if (checks.some((check) => !check.pass)) {
    process.exitCode = 1;
  } else {
    console.log("WP31 persona verification passed.");
  }
};

await main();
process.exit(process.exitCode ?? 0);
