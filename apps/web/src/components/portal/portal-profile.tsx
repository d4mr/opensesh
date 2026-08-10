import type { PortalProfileUpdateRequest } from "@opensesh/domain";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CameraIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { FileThread } from "@/components/portal/file-thread";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dataUrlForVersion, fileAsBase64 } from "@/lib/files";
import { speakerPortalQuery } from "@/lib/portal-queries";
import { getSpeakerPortal, updatePortalProfile, uploadPortalFile } from "@/server-fns/portal";

type ProfileUpdate = typeof PortalProfileUpdateRequest.Type;
type SpeakerData = Extract<
  Awaited<ReturnType<typeof getSpeakerPortal>>,
  { readonly ok: true }
>["data"];

export function PortalProfile() {
  const portal = useSuspenseQuery(speakerPortalQuery);
  return portal.data.ok ? (
    <PortalProfileContent data={portal.data.data} />
  ) : (
    <p className="p-6">{portal.data.error.message}</p>
  );
}

function PortalProfileContent({ data }: { readonly data: SpeakerData }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const [profile, setProfile] = useState(() => ({
    firstName: data.contact.firstName,
    lastName: data.contact.lastName,
    salutation: data.contact.salutation ?? "",
    honorific: data.contact.honorific ?? "",
    pronouns: data.contact.pronouns ?? "",
    gender: data.contact.gender ?? "",
    bio: data.contact.bio ?? "",
    linkedinUrl: data.contact.linkedinUrl ?? "",
    twitterUrl: data.contact.twitterUrl ?? "",
    facebookUrl: data.contact.facebookUrl ?? "",
    websiteUrl: data.contact.websiteUrl ?? "",
    dietaryRequirements: data.contact.dietaryRequirements,
    tshirtSize: data.contact.tshirtSize ?? "",
  }));
  const headshot = data.files.find((item) => item.upload.kind === "headshot");
  const versions = data.versions
    .map((item) => item.version)
    .filter((version) => version.fileUploadId === headshot?.upload.id);
  const newestHeadshot = [...versions].sort(
    (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
  )[0];
  const storedImage = useQuery({
    queryKey: ["file-image", newestHeadshot?.id],
    queryFn: () => dataUrlForVersion(newestHeadshot!.id),
    enabled: newestHeadshot !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const saveMutation = useMutation({
    mutationFn: (input: ProfileUpdate) => updatePortalProfile({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
      await queryClient.invalidateQueries({ queryKey: ["speaker-portal"] });
    },
  });
  const uploadMutation = useMutation({
    mutationFn: async (file: File) =>
      uploadPortalFile({
        data: {
          assignmentId: null,
          fileRequestId: null,
          requirementId: null,
          submissionId: null,
          kind: "headshot",
          filename: file.name,
          contentType: file.type,
          size: file.size,
          base64: await fileAsBase64(file),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Headshot saved as a new version");
      await queryClient.invalidateQueries({ queryKey: ["speaker-portal"] });
    },
  });
  const update = <Key extends keyof typeof profile>(key: Key, value: (typeof profile)[Key]) =>
    setProfile((current) => ({ ...current, [key]: value }));
  const save = (input: ProfileUpdate) => saveMutation.mutate(input);
  const avatarSrc = preview ?? storedImage.data ?? data.contact.headshotUrl ?? undefined;

  useEffect(() => {
    if (preview === null) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-4 flex items-center gap-3">
        <Avatar className="size-14">
          <AvatarImage src={avatarSrc} alt="" />
          <AvatarFallback>{`${profile.firstName.slice(0, 1)}${profile.lastName.slice(0, 1)}`}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-lg font-semibold">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="text-xs text-muted-foreground">{data.contact.email}</p>
        </div>
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {saveMutation.isPending ? "Saving…" : saved ? "Saved" : ""}
        </span>
      </div>
      {data.contact.profileReviewStatus !== "pending_review" ? null : (
        <p className="mb-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Some of your changes are waiting for organizer approval — the last approved version of
          your profile stays public until then.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm">General</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Biography</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {profile.bio.length}/5000
                </span>
              </div>
              <RichTextEditor
                value={profile.bio}
                onChange={(value) => update("bio", value.slice(0, 5000))}
                onBlur={() => save({ bio: profile.bio || null })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ProfileInput
                label="First name"
                value={profile.firstName}
                onChange={(value) => update("firstName", value)}
                onBlur={() => save({ firstName: profile.firstName })}
              />
              <ProfileInput
                label="Last name"
                value={profile.lastName}
                onChange={(value) => update("lastName", value)}
                onBlur={() => save({ lastName: profile.lastName })}
              />
              <ProfileInput
                label="Salutation"
                value={profile.salutation}
                onChange={(value) => update("salutation", value)}
                onBlur={() => save({ salutation: profile.salutation || null })}
              />
              <ProfileInput
                label="Honorific"
                value={profile.honorific}
                onChange={(value) => update("honorific", value)}
                onBlur={() => save({ honorific: profile.honorific || null })}
              />
              <ProfileInput
                label="Pronouns"
                value={profile.pronouns}
                onChange={(value) => update("pronouns", value)}
                onBlur={() => save({ pronouns: profile.pronouns || null })}
              />
              <ProfileInput
                label="Gender"
                value={profile.gender}
                onChange={(value) => update("gender", value)}
                onBlur={() => save({ gender: profile.gender || null })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Dietary requirements</Label>
                <Select
                  value={profile.dietaryRequirements}
                  onValueChange={(value) => {
                    const dietary =
                      value === "vegetarian" ||
                      value === "vegan" ||
                      value === "gluten_free" ||
                      value === "other"
                        ? value
                        : "none";
                    update("dietaryRequirements", dietary);
                    save({ dietaryRequirements: dietary });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ["none", "None"],
                      ["vegetarian", "Vegetarian"],
                      ["vegan", "Vegan"],
                      ["gluten_free", "Gluten-free"],
                      ["other", "Other"],
                    ].map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>T-shirt size</Label>
                <Select
                  value={profile.tshirtSize}
                  onValueChange={(value) => {
                    const size =
                      value === "XS" ||
                      value === "S" ||
                      value === "M" ||
                      value === "L" ||
                      value === "XL" ||
                      value === "XXL"
                        ? value
                        : null;
                    update("tshirtSize", size ?? "");
                    save({ tshirtSize: size });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid content-start gap-3">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Headshot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 py-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-xs font-medium text-muted-foreground">
                <CameraIcon className="size-4" /> Replace headshot
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file === undefined) return;
                    setPreview(URL.createObjectURL(file));
                    uploadMutation.mutate(file);
                  }}
                />
              </label>
              {headshot === undefined ? null : (
                <FileThread
                  upload={headshot.upload}
                  versions={versions}
                  comments={data.comments
                    .map((item) => item.comment)
                    .filter((comment) => comment.fileUploadId === headshot.upload.id)}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">My links</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 py-4">
              {(["linkedinUrl", "twitterUrl", "facebookUrl", "websiteUrl"] as const).map((key) => (
                <ProfileInput
                  key={key}
                  label={
                    {
                      linkedinUrl: "LinkedIn URL",
                      twitterUrl: "X (Twitter) URL",
                      facebookUrl: "Facebook URL",
                      websiteUrl: "Website",
                    }[key]
                  }
                  value={profile[key]}
                  onChange={(value) => update(key, value)}
                  onBlur={() => save({ [key]: profile[key] || null })}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function ProfileInput({
  label,
  value,
  onChange,
  onBlur,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
}) {
  const id = `profile-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
