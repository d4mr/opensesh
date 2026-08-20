import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { InvalidInput } from "@opensesh/domain/server/errors";
import { Forms, ReadModels } from "@opensesh/domain/server/repos";
import { FormIdRequest, FormSaveRequest } from "@opensesh/domain/server/schema/forms";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

const EventIdRequest = Schema.Struct({ eventId: Schema.String });

export const getFormSummaries = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(EventIdRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const reads = yield* ReadModels;
        return yield* reads.formSummariesForAdmin(data.eventId);
      }),
      { require: "staff" },
    ),
  );

export const createForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(EventIdRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const forms = yield* Forms;
        yield* requireEventAccess(data.eventId, "admin");
        const form = yield* forms.create({
          eventId: data.eventId,
          internalName: "Untitled submission form",
          externalTitle: "Submit your session",
          collectParticipants: true,
          status: "open",
          welcomeHeading: "Welcome",
          welcomeMessage: "Tell us what you would like to share.",
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
          participantRoles: [
            { role: "Primary speaker", enabled: true, min: 1, max: 1 },
            { role: "Co-presenter", enabled: true, min: 0, max: 3 },
          ],
          closeDate: null,
          submissionLimit: null,
          allowMultipleDrafts: false,
          successMessage: "Thank you. Your submission has been received.",
          autoRedirectPortal: false,
          confirmationEmailEnabled: true,
          confirmationEmailBody:
            "Hi {{name}}, we received {{title}}. Manage it at {{portal_link}}.",
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
            section: "abstract",
            label: "Description",
            fieldType: "richtext",
            maxChars: 5000,
            required: true,
            locked: false,
            position: 2,
            options: null,
            mapsTo: "description",
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
          {
            section: "participant",
            label: "Biography",
            fieldType: "richtext",
            maxChars: 2000,
            required: false,
            locked: false,
            position: 4,
            options: null,
            mapsTo: "bio",
            condition: null,
          },
        ]);
        return form;
      }),
      { require: "staff" },
    ),
  );

export const getFormEditor = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(FormIdRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const reads = yield* ReadModels;
        const { form, fields, library, admins, submissionCount } = yield* reads.formEditorForAdmin(
          data.eventId,
          data.formId,
        );
        return { form, fields, library, admins, submissionCount };
      }),
      { require: "staff" },
    ),
  );

export const saveForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FormSaveRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const title = data.fields.find(
          (field) => field.section === "abstract" && field.locked && field.mapsTo === "title",
        );
        if (title === undefined || !title.required) {
          return yield* Effect.fail(
            new InvalidInput({ message: "The locked Title field is required" }),
          );
        }
        const [, existing] = yield* Effect.all(
          [requireEventAccess(data.eventId, "admin"), forms.getByEvent(data.eventId, data.formId)],
          { concurrency: 2 },
        );
        const status = data.form.status ?? existing.status;
        const collectParticipants = data.form.collectParticipants ?? existing.collectParticipants;
        const participantRoles = data.form.participantRoles ?? existing.participantRoles;
        const needsParticipant = participantRoles.some((role) => role.enabled && role.min > 0);
        const hasParticipantEmail = data.fields.some(
          (field) => field.section === "participant" && field.mapsTo === "email",
        );
        if (status === "open" && collectParticipants && needsParticipant && !hasParticipantEmail) {
          return yield* Effect.fail(
            new InvalidInput({
              message:
                "Participant collection needs an email question — add it in the Speakers step",
            }),
          );
        }
        return yield* forms.saveWithFields(data.formId, data.form, data.fields);
      }),
      { require: "staff" },
    ),
  );

export const duplicateForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FormIdRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const forms = yield* Forms;
        yield* requireEventAccess(data.eventId, "admin");
        yield* forms.getByEvent(data.eventId, data.formId);
        return yield* forms.duplicate(data.formId);
      }),
      { require: "staff" },
    ),
  );

export const deleteForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FormIdRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const forms = yield* Forms;
        yield* requireEventAccess(data.eventId, "admin");
        yield* forms.getByEvent(data.eventId, data.formId);
        return yield* forms.delete(data.formId);
      }),
      { require: "staff" },
    ),
  );
