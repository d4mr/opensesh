import {
  validateBlockPlacement,
  type AgendaAdminData,
  type AgendaBlock,
  type AgendaBlockKind,
  type AgendaBlockSaveRequest,
} from "@opensesh/domain";
import { useEffect, useState } from "react";

import { TimeSelect } from "@/components/forms/datetime-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateKeyFor, eventDateKeys, formatDay, minutesFor, zonedDateTimeIso } from "./date-utils";

const kinds: ReadonlyArray<{ readonly value: AgendaBlockKind; readonly label: string }> = [
  { value: "break", label: "Break" },
  { value: "meal", label: "Meal" },
  { value: "registration", label: "Registration" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
];

const durations = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];

// The editor covers create (block === null) and edit; `initialDay` seeds a new
// block on the day the organizer is looking at.
export function BlockEditor({
  agenda,
  block,
  initialDay,
  open,
  onOpenChange,
  save,
  remove,
}: {
  readonly agenda: AgendaAdminData;
  readonly block: AgendaBlock | null;
  readonly initialDay: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly save: (input: Omit<AgendaBlockSaveRequest, "eventId">) => Promise<boolean>;
  readonly remove: (id: string) => Promise<boolean>;
}) {
  const timezone = agenda.event.timezone;
  const days = eventDateKeys(agenda.event.startsAt, agenda.event.endsAt, timezone);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<AgendaBlockKind>("break");
  const [roomId, setRoomId] = useState("all");
  const [day, setDay] = useState(initialDay);
  const [minutes, setMinutes] = useState(12 * 60);
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState<string | null>(null);

  // Reset per open so a reopened dialog never shows the previous block.
  useEffect(() => {
    if (!open) return;
    setTitle(block?.title ?? "");
    setKind(block?.kind ?? "break");
    setRoomId(block?.roomId ?? "all");
    setDay(block === null ? initialDay : dateKeyFor(block.startsAt, timezone));
    setMinutes(block === null ? 12 * 60 : minutesFor(block.startsAt, timezone));
    setDuration(
      block === null
        ? 60
        : Math.round((Date.parse(block.endsAt) - Date.parse(block.startsAt)) / 60_000),
    );
    setError(null);
  }, [open, block, initialDay, timezone]);

  const submit = async () => {
    if (title.trim() === "") {
      setError("Name this block");
      return;
    }
    const startsAt = zonedDateTimeIso(day, minutes, timezone);
    const input = {
      id: block?.id ?? null,
      title: title.trim(),
      kind,
      roomId: roomId === "all" ? null : roomId,
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + duration * 60_000).toISOString(),
    };
    const validation = validateBlockPlacement(input, {
      timezone,
      startsAt: agenda.event.startsAt,
      endsAt: agenda.event.endsAt,
      roomIds: agenda.rooms.map((room) => room.id),
    });
    if (validation !== null) {
      setError(validation);
      return;
    }
    if (await save(input)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{block === null ? "Add agenda block" : "Edit agenda block"}</DialogTitle>
          <DialogDescription>
            Registration, breaks, lunch, and socials share the grid with sessions; auto-schedule
            never places a session over one.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="grid grid-cols-3 items-center gap-3">
            <Label htmlFor="block-title" className="text-xs">
              Title
            </Label>
            <Input
              id="block-title"
              className="col-span-2 h-8"
              placeholder="Lunch"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <Label htmlFor="block-kind" className="text-xs">
              Kind
            </Label>
            <Select
              value={kind}
              onValueChange={(value) => value !== null && setKind(value as AgendaBlockKind)}
            >
              <SelectTrigger id="block-kind" size="sm" className="col-span-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <Label htmlFor="block-room" className="text-xs">
              Room
            </Label>
            <Select value={roomId} onValueChange={(value) => value !== null && setRoomId(value)}>
              <SelectTrigger id="block-room" size="sm" className="col-span-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rooms</SelectItem>
                {agenda.rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <Label htmlFor="block-day" className="text-xs">
              Day
            </Label>
            <Select value={day} onValueChange={(value) => value !== null && setDay(value)}>
              <SelectTrigger id="block-day" size="sm" className="col-span-2 w-full">
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
            <Label htmlFor="block-time" className="text-xs">
              Start
            </Label>
            <TimeSelect
              id="block-time"
              value={minutes}
              onChange={setMinutes}
              className="col-span-2 h-8"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <Label htmlFor="block-duration" className="text-xs">
              Duration
            </Label>
            <Select
              value={String(duration)}
              onValueChange={(value) => value !== null && setDuration(Number(value))}
            >
              <SelectTrigger id="block-duration" size="sm" className="col-span-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...durations, duration]))
                  .sort((first, second) => first - second)
                  .map((choice) => (
                    <SelectItem key={choice} value={String(choice)}>
                      {choice} minutes
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error === null ? null : <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter className="sm:justify-between">
          {block === null ? (
            <span />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void remove(block.id).then((removed) => removed && onOpenChange(false));
              }}
            >
              Delete block
            </Button>
          )}
          <Button size="sm" onClick={() => void submit()}>
            {block === null ? "Add block" : "Save block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
