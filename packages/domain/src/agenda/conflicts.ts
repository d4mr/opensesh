import type { AgendaConflict, AgendaSession } from "../server/schema/agenda";

const overlaps = (left: AgendaSession, right: AgendaSession) => {
  if (
    left.startsAt === null ||
    left.endsAt === null ||
    right.startsAt === null ||
    right.endsAt === null
  ) {
    return false;
  }
  return (
    Date.parse(left.startsAt) < Date.parse(right.endsAt) &&
    Date.parse(left.endsAt) > Date.parse(right.startsAt)
  );
};

const overlapWindow = (left: AgendaSession, right: AgendaSession) => ({
  startsAt: new Date(
    Math.max(Date.parse(left.startsAt ?? ""), Date.parse(right.startsAt ?? "")),
  ).toISOString(),
  endsAt: new Date(
    Math.min(Date.parse(left.endsAt ?? ""), Date.parse(right.endsAt ?? "")),
  ).toISOString(),
});

export const detectAgendaConflicts = (
  sessions: ReadonlyArray<AgendaSession>,
): ReadonlyArray<AgendaConflict> => {
  const scheduled = sessions.filter(
    (session) => session.roomId !== null && session.startsAt !== null && session.endsAt !== null,
  );
  const conflicts: Array<AgendaConflict> = [];

  for (let leftIndex = 0; leftIndex < scheduled.length; leftIndex += 1) {
    const left = scheduled[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < scheduled.length; rightIndex += 1) {
      const right = scheduled[rightIndex];
      if (right === undefined || !overlaps(left, right)) continue;
      const [first, second] = left.id < right.id ? [left, right] : [right, left];
      const window = overlapWindow(left, right);

      if (left.roomId === right.roomId) {
        conflicts.push({
          id: `room:${first.id}:${second.id}`,
          kind: "room",
          sessionIds: [first.id, second.id],
          roomId: left.roomId,
          speaker: null,
          ...window,
        });
      }

      const rightSpeakers = new Map(right.speakers.map((speaker) => [speaker.id, speaker]));
      for (const speaker of left.speakers) {
        const shared = rightSpeakers.get(speaker.id);
        if (shared === undefined) continue;
        conflicts.push({
          id: `speaker:${speaker.id}:${first.id}:${second.id}`,
          kind: "speaker",
          sessionIds: [first.id, second.id],
          roomId: null,
          speaker: shared,
          ...window,
        });
      }
    }
  }

  return conflicts.sort((left, right) =>
    left.startsAt === right.startsAt
      ? left.id.localeCompare(right.id)
      : left.startsAt.localeCompare(right.startsAt),
  );
};
