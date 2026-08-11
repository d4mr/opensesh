export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const paragraph = (value: string) =>
  `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(value)}</p>`;

const link = (label: string, url: string) =>
  `<a href="${escapeHtml(url)}" style="color:#176b4d;text-decoration:underline;text-underline-offset:2px">${escapeHtml(label)}</a>`;

const layout = (
  eventName: string,
  logoUrl: string | null | undefined,
  content: string,
) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f6f7f4;color:#1b211d;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7f4"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe3dd;border-radius:10px;overflow:hidden">
<tr><td style="border-top:3px solid #176b4d;padding:20px 24px 16px;font-size:16px;font-weight:700;letter-spacing:-0.01em">${logoUrl === null || logoUrl === undefined ? "" : `<img src="${escapeHtml(logoUrl)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;margin:0 0 12px;border-radius:8px;object-fit:cover">`}${escapeHtml(eventName)}</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:14px">${content}</td></tr>
<tr><td style="border-top:1px solid #e5e7e2;padding:14px 24px;color:#68706a;font-size:12px">opensesh — ${escapeHtml(eventName)}</td></tr>
</table></td></tr></table></body></html>`;

export const confirmation = (input: {
  readonly eventName: string;
  readonly name: string;
  readonly submissionTitle: string;
  readonly portalUrl: string;
  readonly customBody?: string;
  readonly logoUrl?: string | null;
}): RenderedEmail => {
  const subject = `We received “${input.submissionTitle}”`;
  const body =
    input.customBody?.trim() ||
    `Thanks, ${input.name}. Your submission “${input.submissionTitle}” is in the review queue.`;
  const text = `${body}\n\nView your submission: ${input.portalUrl}`;
  return {
    subject,
    text,
    html: layout(
      input.eventName,
      input.logoUrl,
      `${paragraph(body)}${paragraph("You can review its status in the speaker portal.")}<p style="margin:0">${link("View submission", input.portalUrl)}</p>`,
    ),
  };
};

export const magicLink = (input: {
  readonly eventName: string;
  readonly url: string;
  readonly logoUrl?: string | null;
}): RenderedEmail => {
  const subject = `Sign in to ${input.eventName}`;
  return {
    subject,
    text: `Use this secure link to sign in to ${input.eventName}: ${input.url}`,
    html: layout(
      input.eventName,
      input.logoUrl,
      `${paragraph(`Use this secure link to sign in to ${input.eventName}.`)}<p style="margin:0">${link(`Sign in to ${input.eventName}`, input.url)}</p>`,
    ),
  };
};

export const organizationInvitation = (input: {
  readonly organizationName: string;
  readonly inviterName: string;
  readonly role: string;
  readonly url: string;
}): RenderedEmail => {
  const role = input.role === "admin" ? "an administrator" : "a member";
  const subject = `Join ${input.organizationName} on opensesh`;
  return {
    subject,
    text: `${input.inviterName} invited you to join ${input.organizationName} as ${role}. Accept the invitation: ${input.url}`,
    html: layout(
      input.organizationName,
      undefined,
      `${paragraph(`${input.inviterName} invited you to join ${input.organizationName} as ${role}.`)}<p style="margin:0">${link("Accept invitation", input.url)}</p>`,
    ),
  };
};

const decision = (input: {
  readonly accepted: boolean;
  readonly eventName: string;
  readonly speakerName: string;
  readonly submissionTitle: string;
  readonly feedback: string;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
}): RenderedEmail => {
  const subject = input.accepted
    ? `You're speaking at ${input.eventName}`
    : `An update on your ${input.eventName} submission`;
  const introduction = input.accepted
    ? `We are delighted to accept “${input.submissionTitle}.” Your onboarding tasks are ready in the speaker portal.`
    : `Thank you for the thoughtful proposal “${input.submissionTitle}.” We are not able to include it in this year's program.`;
  const feedback = input.feedback.trim();
  const feedbackText =
    feedback.length === 0 ? "" : `\n\nFeedback from the review team:\n${feedback}`;
  const feedbackHtml =
    feedback.length === 0
      ? ""
      : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;border:1px solid #dfe3dd;border-radius:8px"><tr><td style="padding:14px"><strong>Feedback from the review team</strong><p style="margin:8px 0 0;white-space:pre-wrap;line-height:1.6">${escapeHtml(feedback)}</p></td></tr></table>`;
  return {
    subject,
    text: `Hi ${input.speakerName},\n\n${introduction}${feedbackText}\n\nSpeaker portal: ${input.portalUrl}\n\nThe OpenSesh program team`,
    html: layout(
      input.eventName,
      input.logoUrl,
      `${paragraph(`Hi ${input.speakerName},`)}${paragraph(introduction)}${feedbackHtml}<p style="margin:0 0 20px">${link("Open speaker portal", input.portalUrl)}</p>${paragraph("The OpenSesh program team")}`,
    ),
  };
};

export const accepted = (input: Omit<Parameters<typeof decision>[0], "accepted">) =>
  decision({ ...input, accepted: true });

export const declined = (input: Omit<Parameters<typeof decision>[0], "accepted">) =>
  decision({ ...input, accepted: false });

export const taskReminder = (input: {
  readonly eventName: string;
  readonly speakerName: string;
  readonly tasks: ReadonlyArray<string>;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
}): RenderedEmail => {
  const subject = `${input.tasks.length} outstanding ${input.tasks.length === 1 ? "task" : "tasks"} for ${input.eventName}`;
  const listText = input.tasks.map((task) => `- ${task}`).join("\n");
  const listHtml = input.tasks
    .map((task) => `<li style="margin:0 0 6px">${escapeHtml(task)}</li>`)
    .join("");
  return {
    subject,
    text: `Hi ${input.speakerName},\n\nA quick reminder that these speaker tasks are outstanding:\n${listText}\n\nComplete your tasks: ${input.portalUrl}`,
    html: layout(
      input.eventName,
      input.logoUrl,
      `${paragraph(`Hi ${input.speakerName},`)}${paragraph("A quick reminder that these speaker tasks are outstanding:")}<ul style="margin:0 0 20px;padding-left:20px;line-height:1.5">${listHtml}</ul><p style="margin:0">${link("Complete your tasks", input.portalUrl)}</p>`,
    ),
  };
};

export const calendarInvite = (input: {
  readonly eventName: string;
  readonly speakerName: string;
  readonly sessionTitle: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly room: string;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
}): RenderedEmail => {
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: input.timezone,
  }).format(input.startsAt);
  const end = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: input.timezone,
  }).format(input.endsAt);
  const time = `${date}–${end} (${input.timezone})`;
  return {
    subject: `Calendar invite: ${input.sessionTitle}`,
    text: `Hi ${input.speakerName},\n\nYour session is scheduled.\n\n${input.sessionTitle}\n${time}\n${input.room}\n\nAdd the attached invitation to your calendar. Session details: ${input.portalUrl}`,
    html: layout(
      input.eventName,
      input.logoUrl,
      `${paragraph(`Hi ${input.speakerName},`)}${paragraph("Your session is scheduled.")}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;border:1px solid #dfe3dd;border-radius:8px"><tr><td style="padding:14px"><strong>${escapeHtml(input.sessionTitle)}</strong><div style="margin-top:8px;color:#68706a;line-height:1.6">${escapeHtml(time)}<br>${escapeHtml(input.room)}</div></td></tr></table>${paragraph("Add the attached invitation to your calendar.")}<p style="margin:0">${link("View session details", input.portalUrl)}</p>`,
    ),
  };
};
