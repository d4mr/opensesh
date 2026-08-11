import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fileAsBase64 } from "@/lib/files";
import { speakerPortalQuery } from "@/lib/portal-queries";
import { cn } from "@/lib/utils";
import { uploadPortalFile } from "@/server-fns/portal";

export function SessionFileUploadAction({
  requirement,
  submissionId,
  uploaded,
  className,
}: {
  readonly requirement: {
    readonly id: string;
    readonly acceptTypes: string | null;
  };
  readonly submissionId: string;
  readonly uploaded: boolean;
  readonly className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string>();
  const mutation = useMutation({
    mutationFn: async (file: File) =>
      uploadPortalFile({
        data: {
          assignmentId: null,
          fileRequestId: null,
          requirementId: requirement.id,
          submissionId,
          kind: "slides",
          filename: file.name,
          contentType: file.type,
          size: file.size,
          base64: await fileAsBase64(file),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setUploadError(result.error.message);
        return;
      }
      setUploadError(undefined);
      toast.success(uploaded ? "New version uploaded" : "File uploaded");
      await queryClient.invalidateQueries({ queryKey: speakerPortalQuery.queryKey });
    },
  });

  return (
    <div className={cn("grid shrink-0 justify-items-end gap-1", className)}>
      <input
        ref={input}
        type="file"
        accept={requirement.acceptTypes ?? undefined}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            setUploadError(undefined);
            mutation.mutate(file);
          }
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        variant={uploaded ? "outline" : "default"}
        className="pressable"
        disabled={mutation.isPending}
        onClick={() => input.current?.click()}
      >
        <UploadIcon />
        {mutation.isPending ? "Uploading…" : uploaded ? "Replace" : "Upload"}
      </Button>
      {uploadError === undefined ? null : (
        <p className="max-w-60 text-right text-xs text-destructive" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}
