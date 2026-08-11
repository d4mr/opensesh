import {
  type AgendaAdminData,
  type AgendaSession,
  type ScheduleChange,
  validateScheduleChange,
} from "@opensesh/domain";
import { CalendarClockIcon } from "lucide-react";
import { useState } from "react";

import { TimeSelect } from "@/components/forms/datetime-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dateKeyFor,
  eventDateKeys,
  formatDay,
  formatTime,
  minutesFor,
  zonedDateTimeIso,
} from "./date-utils";

const durations = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180];

export function ScheduleEditor({
  agenda,
  session,
  save,
}: {
  readonly agenda: AgendaAdminData;
  readonly session: AgendaSession;
  readonly save: (change: ScheduleChange) => Promise<boolean>;
}) {
  const timezone = agenda.event.timezone;
  const days = eventDateKeys(agenda.event.startsAt, agenda.event.endsAt, timezone);
  const initialDay =
    session.startsAt === null ? (days[0] ?? "") : dateKeyFor(session.startsAt, timezone);
  const initialMinutes =
    session.startsAt === null ? 9 * 60 : minutesFor(session.startsAt, timezone);
  const initialDuration =
    session.startsAt === null || session.endsAt === null
      ? session.durationMinutes
      : Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000);
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState(session.roomId ?? agenda.rooms[0]?.id ?? "");
  const [day, setDay] = useState(initialDay);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [duration, setDuration] = useState(initialDuration);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setRoomId(session.roomId ?? agenda.rooms[0]?.id ?? "");
    setDay(session.startsAt === null ? (days[0] ?? "") : dateKeyFor(session.startsAt, timezone));
    setMinutes(session.startsAt === null ? 9 * 60 : minutesFor(session.startsAt, timezone));
    setDuration(
      session.startsAt === null || session.endsAt === null
        ? session.durationMinutes
        : Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000),
    );
    setError(null);
  };

  const submit = async () => {
    const startsAt = zonedDateTimeIso(day, minutes, timezone);
    const endsAt = new Date(Date.parse(startsAt) + duration * 60_000).toISOString();
    const change = {
      eventId: agenda.event.id,
      submissionId: session.id,
      roomId: roomId || null,
      startsAt,
      endsAt,
    };
    const validation = validateScheduleChange(change, {
      timezone,
      startsAt: agenda.event.startsAt,
      endsAt: agenda.event.endsAt,
      roomIds: agenda.rooms.map((room) => room.id),
    });
    if (validation !== null) {
      setError(validation);
      return;
    }
    if (await save(change)) setOpen(false);
  };

  const remove = async () => {
    if (
      await save({
        eventId: agenda.event.id,
        submissionId: session.id,
        roomId: null,
        startsAt: null,
        endsAt: null,
      })
    ) {
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="pressable h-7 justify-start text-xs">
          <CalendarClockIcon />
          {session.startsAt === null
            ? "Schedule"
            : `${formatDay(dateKeyFor(session.startsAt, timezone))}, ${formatTime(session.startsAt, timezone)}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="grid gap-3">
          {/* min-w-0 so the truncated title cannot inflate the popover's grid column */}
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm leading-none font-medium">Schedule session</h4>
            <p className="truncate text-xs text-muted-foreground">{session.title}</p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-3">
              <Label htmlFor={`room-${session.id}`} className="text-xs">
                Room
              </Label>
              <Select value={roomId} onValueChange={(value) => value !== null && setRoomId(value)}>
                <SelectTrigger id={`room-${session.id}`} size="sm" className="col-span-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agenda.rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 items-center gap-3">
              <Label htmlFor={`day-${session.id}`} className="text-xs">
                Day
              </Label>
              <Select value={day} onValueChange={(value) => value !== null && setDay(value)}>
                <SelectTrigger id={`day-${session.id}`} size="sm" className="col-span-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((item) => (
                    <SelectItem key={item} value={item}>
                      {formatDay(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 items-center gap-3">
              <Label htmlFor={`time-${session.id}`} className="text-xs">
                Start
              </Label>
              <TimeSelect
                id={`time-${session.id}`}
                value={minutes}
                onChange={setMinutes}
                className="col-span-2 h-8"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-3">
              <Label htmlFor={`duration-${session.id}`} className="text-xs">
                Duration
              </Label>
              <Select
                value={String(duration)}
                onValueChange={(value) => value !== null && setDuration(Number(value))}
              >
                <SelectTrigger
                  id={`duration-${session.id}`}
                  size="sm"
                  className="col-span-2 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error === null ? null : <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between border-t pt-3">
            {session.startsAt === null ? (
              <span />
            ) : (
              <Button variant="ghost" size="sm" onClick={() => void remove()}>
                Remove
              </Button>
            )}
            <Button size="sm" onClick={() => void submit()}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
