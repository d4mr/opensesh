import type { CurrentUserValue } from "@opensesh/domain/server/current-user";

export const eventAccessFor = (user: CurrentUserValue, eventId: string) => {
  const memberRole = user.events.find((event) => event.id === eventId)?.memberRole ?? null;
  return {
    admin: user.orgRole === "owner" || user.orgRole === "admin" || memberRole === "admin",
    reviewer: memberRole === "reviewer",
  };
};
