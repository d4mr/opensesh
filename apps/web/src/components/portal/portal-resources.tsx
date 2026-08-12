import type { ResourceView } from "@opensesh/domain";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PortalResourceItem } from "@/components/portal/portal-resource-item";
import { Button } from "@/components/ui/button";
import { portalResourcesQuery } from "@/lib/resource-queries";
import { downloadResourceFile } from "@/server-fns/resources";

const download = (filename: string, contentType: string, base64: string) => {
  const anchor = document.createElement("a");
  anchor.href = `data:${contentType};base64,${base64}`;
  anchor.download = filename;
  anchor.click();
};

function Attachment({ resource }: { readonly resource: ResourceView }) {
  const [loading, setLoading] = useState(false);
  if (resource.attachmentKind === "link" && resource.linkUrl !== null)
    return (
      <Button asChild size="sm">
        <a href={resource.linkUrl} target="_blank" rel="noreferrer">
          Open resource <ExternalLinkIcon />
        </a>
      </Button>
    );
  if (resource.attachmentKind === "file" && resource.fileName !== null)
    return (
      <Button
        size="sm"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          const response = await downloadResourceFile({ data: { resourceId: resource.id } });
          setLoading(false);
          if (!response.ok) {
            toast.error(response.error.message);
            return;
          }
          download(response.data.filename, response.data.contentType, response.data.base64);
        }}
      >
        <DownloadIcon /> {loading ? "Preparing…" : `Download ${resource.fileName}`}
      </Button>
    );
  if (resource.attachmentKind === "embed" && resource.embedUrl !== null)
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted/30">
        <iframe
          title={`${resource.title} attachment`}
          src={resource.embedUrl}
          className="size-full border-0"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          // "origin" not "no-referrer": YouTube (and other allowlisted
          // hosts) refuse embeds that arrive with no referer at all
          // (player error 153), and the origin alone leaks nothing beyond
          // which site is embedding.
          referrerPolicy="origin"
          allowFullScreen
        />
      </div>
    );
  return null;
}

export function PortalResources() {
  const result = useSuspenseQuery(portalResourcesQuery);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  const resources = result.data.data;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Event-day guides and materials from the organizing team.
        </p>
      </div>
      {resources.length === 0 ? (
        <div className="py-16 text-center">
          <span className="wizard-pop mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileTextIcon className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold tracking-tight">No resources yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Guides and event-day materials will appear here when they are published.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border divide-y">
          {resources.map((resource) => {
            const open = expanded === resource.id;
            return (
              <PortalResourceItem
                key={resource.id}
                title={resource.title}
                subtitle={resource.subtitle}
                body={resource.body}
                open={open}
                onToggle={() => setExpanded(open ? null : resource.id)}
                attachment={
                  resource.attachmentKind === null ? undefined : <Attachment resource={resource} />
                }
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
