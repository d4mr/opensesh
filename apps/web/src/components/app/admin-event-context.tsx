import type { Event } from "@opensesh/domain";
import { createContext, useContext } from "react";

export interface AdminEventContextValue {
  readonly event: Event;
  readonly events: ReadonlyArray<Event>;
  readonly selectEvent: (eventId: string) => void;
  readonly eventCreated: (eventId: string) => Promise<void>;
}

export const AdminEventContext = createContext<AdminEventContextValue | null>(null);

export const useAdminEvent = () => useContext(AdminEventContext);
