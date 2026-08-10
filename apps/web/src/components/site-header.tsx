import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import { Link } from "@tanstack/react-router";

import { UserMenu } from "@/components/app/user-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader({
  title,
  user,
}: {
  readonly title: string;
  readonly user: CurrentUserValue;
}) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4 data-vertical:self-auto" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" render={<Link to="/portal" />}>
            View portal
          </Button>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
