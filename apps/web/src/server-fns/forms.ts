import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { Forbidden, InvalidInput } from "@opensesh/domain/server/errors";
import { Events, Forms, ReadModels } from "@opensesh/domain/server/repos";
import { FormIdRequest, FormSaveRequest } from "@opensesh/domain/server/schema/forms";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer, runSessionServer } from "@/server/runtime";

const EventIdRequest = Schema.Struct({ eventId: Schema.String });

const requireManagedEvent = Effect.fn("requireManagedFormEvent")(function* (eventId: string) {
  const events = yield* Events;
  const user = yield* getCurrentUser;
  const event = yield* events.get(eventId);
  if (event.organizationId !== user.orgId) {
    return yield* Effect.fail(new Forbidden({ message: "You cannot manage this event" }));
  }
  return event;
});

export const getFormSummaries = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(EventIdRequest))
  .handler(async ({ data }) =>
    runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const reads = yield* ReadModels;
        return yield* reads.formSummariesForAdmin(session, eventSlug, data.eventId);
      }),
    ),
  );

export const createForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(EventIdRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const forms = yield* Forms;
        yield* requireManagedEvent(data.eventId);
        const form = yield* forms.create({
          eventId: data.eventId,
          internalName: "Untitled submission form",
          externalTitle: "Submit your session",
          kind: "session",
          collectParticipants: true,
          status: "open",
          welcomeHeading: "Welcome",
          welcomeMessage: "<p>Tell us what you would like to share.</p>",
          showWelcome: true,
          abstractSection: {
            title: "Your session",
            heading: "Submission",
            instructions: "Tell us about your proposed session.",
          },
          participantSection: {
            title: "Who is speaking?",
            heading: "Participant",
            instructions: "Add each speaker for this session.",
          },
          participantRoles: [{ role: "speaker", enabled: true, min: 1, max: 3 }],
          closeDate: null,
          submissionLimit: null,
          allowMultipleDrafts: false,
          successMessage: "<p>Thank you. Your submission has been received.</p>",
          autoRedirectPortal: false,
          confirmationEmailEnabled: true,
          confirmationEmailBody:
            "<p>Hi {{name}}, we received {{title}}. Manage it at {{portal_link}}.</p>",
          adminAlertUserIds: [],
        });
        yield* forms.replaceFields(form.id, [
          {
            section: "abstract",
            label: "Title",
            fieldType: "text",
            maxChars: 255,
            required: true,
            locked: true,
            position: 1,
            options: null,
            mapsTo: "title",
            condition: null,
          },
          {
            section: "participant",
            label: "First Name",
            fieldType: "text",
            maxChars: 255,
            required: true,
            locked: true,
            position: 1,
            options: null,
            mapsTo: "first_name",
            condition: null,
          },
          {
            section: "participant",
            label: "Last Name",
            fieldType: "text",
            maxChars: 255,
            required: true,
            locked: true,
            position: 2,
            options: null,
            mapsTo: "last_name",
            condition: null,
          },
          {
            section: "participant",
            label: "Email",
            fieldType: "email",
            maxChars: 255,
            required: true,
            locked: true,
            position: 3,
            options: null,
            mapsTo: "email",
            condition: null,
          },
        ]);
        return form;
      }),
      { require: "admin" },
    ),
  );

export const getFormEditor = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(FormIdRequest))
  .handler(async ({ data }) =>
    runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const reads = yield* ReadModels;
        const { form, fields, library, admins } = yield* reads.formEditorForAdmin(
          session,
          eventSlug,
          data.eventId,
          data.formId,
        );
        return { form, fields, library, admins };
      }),
    ),
  );

export const saveForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FormSaveRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const forms = yield* Forms;
        yield* requireManagedEvent(data.eventId);
        yield* forms.getByEvent(data.eventId, data.formId);
        const title = data.fields.find(
          (field) => field.section === "abstract" && field.locked && field.mapsTo === "title",
        );
        if (title === undefined || !title.required) {
          return yield* Effect.fail(
            new InvalidInput({ message: "The locked Title field is required" }),
          );
        }
        const form = yield* forms.update(data.formId, data.form);
        const fields = yield* forms.replaceFields(data.formId, data.fields);
        return { form, fields };
      }),
      { require: "admin" },
    ),
  );

export const duplicateForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FormIdRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const forms = yield* Forms;
        yield* requireManagedEvent(data.eventId);
        yield* forms.getByEvent(data.eventId, data.formId);
        return yield* forms.duplicate(data.formId);
      }),
      { require: "admin" },
    ),
  );

export const deleteForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FormIdRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const forms = yield* Forms;
        yield* requireManagedEvent(data.eventId);
        yield* forms.getByEvent(data.eventId, data.formId);
        return yield* forms.delete(data.formId);
      }),
      { require: "admin" },
    ),
  );
