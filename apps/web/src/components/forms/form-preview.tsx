import type {
  FormAnswers,
  FormFieldDefinition,
  FormFieldReplacement,
  FormSection,
  FormSectionSettings,
} from "@opensesh/domain";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { FormRenderer, type FormRendererLibrary } from "@/components/forms/form-renderer";
import { RichText } from "@/components/forms/rich-text";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// The slice of the editor's local form values the preview needs. Structural,
// so the editor can pass its whole values object without ceremony.
export interface FormPreviewValues {
  readonly externalTitle: string;
  readonly showWelcome: boolean;
  readonly welcomeMessage: string;
  readonly collectParticipants: boolean;
  readonly abstractSection: FormSectionSettings;
  readonly participantSection: FormSectionSettings;
  readonly closeDate: string;
  readonly submissionLimit: number | null;
}

type Pane = "welcome" | "questions" | "speakers";

// The renderer wants saved FormFieldDefinitions; the editor holds unsaved
// FormFieldReplacements. Same fallback id as the builder, so conditions keep
// pointing at the right source field before anything is persisted.
const toDefinitions = (
  fields: ReadonlyArray<FormFieldReplacement>,
  section: FormSection,
): ReadonlyArray<FormFieldDefinition> =>
  fields
    .filter((field) => field.section === section)
    .map((field) => ({
      id: field.id ?? `${field.section}-${field.position}`,
      label: field.label,
      fieldType: field.fieldType,
      maxChars: field.maxChars,
      required: field.required,
      locked: field.locked,
      position: field.position,
      options: field.options,
      mapsTo: field.mapsTo,
      condition: field.condition,
    }));

function PaneSwitch({
  panes,
  active,
  onChange,
}: {
  readonly panes: ReadonlyArray<{ readonly id: Pane; readonly label: string }>;
  readonly active: Pane;
  readonly onChange: (pane: Pane) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0 });
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const measure = () => {
      const target = container.querySelector<HTMLElement>(`[data-pane="${active}"]`);
      if (target !== null)
        setPill({
          left: target.offsetLeft,
          top: target.offsetTop,
          width: target.offsetWidth,
          height: target.offsetHeight,
        });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [active, panes.length]);
  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 rounded-md border bg-background transition-[transform,width] duration-200 [transition-timing-function:var(--ease-out)]"
        style={{
          transform: `translate(${pill.left}px, ${pill.top}px)`,
          width: pill.width,
          height: pill.height,
        }}
      />
      {panes.map((pane) => (
        <button
          key={pane.id}
          type="button"
          data-pane={pane.id}
          aria-pressed={pane.id === active}
          className={cn(
            "relative z-10 h-6 rounded-md px-2.5 text-xs font-medium transition-colors duration-200 [transition-timing-function:var(--ease-out)]",
            pane.id === active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(pane.id)}
        >
          {pane.label}
        </button>
      ))}
    </div>
  );
}

function PreviewBody({
  values,
  fields,
  library,
  timezone,
  eventLimit,
}: {
  readonly values: FormPreviewValues;
  readonly fields: ReadonlyArray<FormFieldReplacement>;
  readonly library: FormRendererLibrary;
  readonly timezone: string;
  readonly eventLimit: number;
}) {
  const [pane, setPane] = useState<Pane>("welcome");
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [speakerAnswers, setSpeakerAnswers] = useState<FormAnswers>({});
  const abstractFields = toDefinitions(fields, "abstract");
  const participantFields = toDefinitions(fields, "participant");
  const panes: ReadonlyArray<{ readonly id: Pane; readonly label: string }> = [
    { id: "welcome", label: "Welcome" },
    { id: "questions", label: "Questions" },
    ...(values.collectParticipants ? [{ id: "speakers", label: "Speakers" } as const] : []),
  ];
  const closeDate = values.closeDate.length === 0 ? null : new Date(values.closeDate);
  const closeLabel =
    closeDate === null || Number.isNaN(closeDate.getTime())
      ? null
      : new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: timezone,
          timeZoneName: "short",
        }).format(closeDate);
  const limit = values.submissionLimit ?? eventLimit;
  const heading =
    pane === "welcome"
      ? values.externalTitle
      : pane === "questions"
        ? values.abstractSection.heading
        : values.participantSection.heading;
  const subtitle =
    pane === "questions"
      ? values.abstractSection.instructions
      : pane === "speakers"
        ? values.participantSection.instructions
        : null;
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b pr-2 pl-4">
        <SheetTitle className="text-sm font-medium">Preview</SheetTitle>
        <SheetDescription className="sr-only">
          Live preview of the public submission form. Interactions here are not saved.
        </SheetDescription>
        <div className="ml-auto flex items-center gap-1.5">
          <PaneSwitch panes={panes} active={pane} onChange={setPane} />
          <SheetClose asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="pressable text-muted-foreground"
              aria-label="Close preview"
            >
              <XIcon />
            </Button>
          </SheetClose>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-8 sm:px-8">
          <div key={pane} className="wizard-step">
            <header className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
              {subtitle === null || subtitle.length === 0 ? null : (
                <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </header>
            {pane === "welcome" ? (
              <div>
                {values.showWelcome ? (
                  <RichText
                    markdown={values.welcomeMessage}
                    className="text-sm text-muted-foreground"
                  />
                ) : null}
                <p className="mt-4 text-xs text-muted-foreground">
                  {closeLabel === null
                    ? "Submissions are open."
                    : `Submissions close ${closeLabel}.`}
                  {limit > 0 ? ` Up to ${limit} submissions per person.` : ""}
                </p>
                <div className="mt-6 flex justify-end border-t pt-4">
                  <Button className="pressable" onClick={() => setPane("questions")}>
                    Continue <ArrowRightIcon />
                  </Button>
                </div>
              </div>
            ) : pane === "questions" ? (
              <FormRenderer
                className="wizard-fields"
                fields={abstractFields}
                timezone={timezone}
                library={library}
                answers={answers}
                onAnswersChange={setAnswers}
                continueLabel={values.collectParticipants ? "Continue" : "Submit"}
                onContinue={() => {
                  if (values.collectParticipants) setPane("speakers");
                }}
                onBack={() => setPane("welcome")}
              />
            ) : (
              <FormRenderer
                className="wizard-fields"
                fields={participantFields}
                timezone={timezone}
                library={library}
                answers={speakerAnswers}
                onAnswersChange={setSpeakerAnswers}
                continueLabel="Review"
                onContinue={() => undefined}
                onBack={() => setPane("questions")}
              />
            )}
          </div>
        </div>
      </div>
      <footer className="shrink-0 border-t px-4 py-2">
        <p className="text-[11px] text-muted-foreground">
          Rendered from your unsaved changes — nothing you type here is submitted.
        </p>
      </footer>
    </>
  );
}

export function FormPreviewSheet({
  open,
  onOpenChange,
  values,
  fields,
  library,
  timezone,
  eventLimit,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly values: FormPreviewValues;
  readonly fields: ReadonlyArray<FormFieldReplacement>;
  readonly library: FormRendererLibrary;
  readonly timezone: string;
  readonly eventLimit: number;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl" showCloseButton={false}>
        <PreviewBody
          values={values}
          fields={fields}
          library={library}
          timezone={timezone}
          eventLimit={eventLimit}
        />
      </SheetContent>
    </Sheet>
  );
}
