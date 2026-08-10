CREATE TYPE "content_approval_status" AS ENUM('approved', 'pending_review', 'rejected');--> statement-breakpoint
CREATE TYPE "dietary_requirement" AS ENUM('none', 'vegetarian', 'vegan', 'gluten_free', 'other');--> statement-breakpoint
CREATE TYPE "email_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "email_type" AS ENUM('confirmation', 'magic_link', 'accepted', 'declined', 'task_reminder', 'calendar_invite', 'custom');--> statement-breakpoint
CREATE TYPE "event_member_role" AS ENUM('admin', 'reviewer');--> statement-breakpoint
CREATE TYPE "file_kind" AS ENUM('request', 'headshot', 'slides');--> statement-breakpoint
CREATE TYPE "form_field_type" AS ENUM('text', 'textarea', 'richtext', 'email', 'phone', 'dropdown', 'checkbox', 'file');--> statement-breakpoint
CREATE TYPE "form_section" AS ENUM('abstract', 'participant');--> statement-breakpoint
CREATE TYPE "form_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'canceled');--> statement-breakpoint
CREATE TYPE "review_decision" AS ENUM('approve', 'maybe', 'deny');--> statement-breakpoint
CREATE TYPE "submission_kind" AS ENUM('abstract', 'session');--> statement-breakpoint
CREATE TYPE "submission_status" AS ENUM('draft', 'pending', 'maybe', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "target_type" AS ENUM('contact', 'submission');--> statement-breakpoint
CREATE TYPE "task_status" AS ENUM('todo', 'done', 'waived');--> statement-breakpoint
CREATE TYPE "tshirt_size" AS ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" "invitation_status" DEFAULT 'pending'::"invitation_status" NOT NULL,
	"inviter_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_members_org_user_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL UNIQUE,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_members" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "event_member_role" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_members_event_user_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"tagline" text,
	"description" text,
	"type" text DEFAULT 'conference' NOT NULL,
	"website_url" text,
	"location" text,
	"timezone" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"theme" text,
	"logo_url" text,
	"background_url" text,
	"default_submission_limit" integer DEFAULT 3 NOT NULL,
	"agenda_published_at" timestamp with time zone,
	"published_agenda" jsonb DEFAULT '[]' NOT NULL,
	"agenda_dirty" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formats" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	CONSTRAINT "formats_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "levels_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "reviewer_tracks" (
	"id" text PRIMARY KEY,
	"event_member_id" text NOT NULL,
	"track_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reviewer_tracks_member_track_unique" UNIQUE("event_member_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"capacity" integer,
	CONSTRAINT "rooms_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tags_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"color" text NOT NULL,
	CONSTRAINT "tracks_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" text PRIMARY KEY,
	"form_id" text NOT NULL,
	"section" "form_section" NOT NULL,
	"label" text NOT NULL,
	"field_type" "form_field_type" NOT NULL,
	"max_chars" integer,
	"required" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"options" jsonb,
	"maps_to" text,
	"condition" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"internal_name" text NOT NULL,
	"external_title" text NOT NULL,
	"kind" "submission_kind" NOT NULL,
	"collect_participants" boolean DEFAULT true NOT NULL,
	"status" "form_status" DEFAULT 'open'::"form_status" NOT NULL,
	"welcome_heading" text NOT NULL,
	"welcome_message" text NOT NULL,
	"show_welcome" boolean DEFAULT true NOT NULL,
	"abstract_section" jsonb NOT NULL,
	"participant_section" jsonb NOT NULL,
	"participant_roles" jsonb NOT NULL,
	"close_date" timestamp with time zone,
	"submission_limit" integer,
	"allow_multiple_drafts" boolean DEFAULT false NOT NULL,
	"success_message" text NOT NULL,
	"auto_redirect_portal" boolean DEFAULT true NOT NULL,
	"confirmation_email_enabled" boolean DEFAULT true NOT NULL,
	"confirmation_email_body" text NOT NULL,
	"admin_alert_user_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"contact_id" text,
	"submission_id" text,
	"type" "email_type" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"ics_attached" boolean DEFAULT false NOT NULL,
	"status" "email_status" NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_log_submission_type_contact_unique" UNIQUE("submission_id","type","contact_id")
);
--> statement-breakpoint
CREATE TABLE "file_comments" (
	"id" text PRIMARY KEY,
	"file_upload_id" text NOT NULL,
	"author_contact_id" text,
	"author_event_member_id" text,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_requests" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"target_type" "target_type" NOT NULL,
	"instructions" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" text PRIMARY KEY,
	"file_request_id" text,
	"kind" "file_kind" NOT NULL,
	"contact_id" text NOT NULL,
	"submission_id" text,
	"speaker_last_read_at" timestamp with time zone,
	"admin_last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" text PRIMARY KEY,
	"file_upload_id" text NOT NULL,
	"storage_key" text NOT NULL CONSTRAINT "file_versions_storage_key_unique" UNIQUE,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploader_contact_id" text,
	"uploader_event_member_id" text,
	"uploader_name" text NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_form_responses" (
	"id" text PRIMARY KEY,
	"form_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"submission_id" text,
	"answers" jsonb NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_forms" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"target_type" "target_type" NOT NULL,
	"sections" jsonb NOT NULL,
	"confirmation_email_enabled" boolean DEFAULT false NOT NULL,
	"confirmation_email_body" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignments" (
	"id" text PRIMARY KEY,
	"task_template_id" text NOT NULL,
	"contact_id" text,
	"submission_id" text,
	"status" "task_status" DEFAULT 'todo'::"task_status" NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_assignments_template_contact_unique" UNIQUE("task_template_id","contact_id"),
	CONSTRAINT "task_assignments_template_submission_unique" UNIQUE("task_template_id","submission_id")
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"scope" "target_type" NOT NULL,
	"portal_form_id" text,
	"file_request_id" text,
	"auto_assign_on_accept" boolean DEFAULT true NOT NULL,
	"due_date" timestamp with time zone,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"title" text,
	"company" text,
	"salutation" text,
	"honorific" text,
	"pronouns" text,
	"gender" text,
	"bio" text,
	"headshot_url" text,
	"headshot_key" text,
	"dietary_requirements" "dietary_requirement" DEFAULT 'none'::"dietary_requirement" NOT NULL,
	"tshirt_size" "tshirt_size",
	"phone" text,
	"linkedin_url" text,
	"twitter_url" text,
	"facebook_url" text,
	"website_url" text,
	"confirmed_at" timestamp with time zone,
	"custom" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "contacts_event_email_unique" UNIQUE("event_id","email")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY,
	"submission_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" "review_decision" NOT NULL,
	"score" integer,
	"comment" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reviews_submission_reviewer_unique" UNIQUE("submission_id","reviewer_id")
);
--> statement-breakpoint
CREATE TABLE "submission_edit_history" (
	"id" text PRIMARY KEY,
	"submission_id" text NOT NULL,
	"author_contact_id" text,
	"author_event_member_id" text,
	"author_name" text NOT NULL,
	"changed_fields" jsonb NOT NULL,
	"previous_values" jsonb NOT NULL,
	"new_values" jsonb NOT NULL,
	"approval_status" "content_approval_status" NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_event_member_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_participants" (
	"id" text PRIMARY KEY,
	"submission_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"role" text DEFAULT 'speaker' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "submission_participants_submission_contact_unique" UNIQUE("submission_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "submission_tags" (
	"id" text PRIMARY KEY,
	"submission_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "submission_tags_submission_tag_unique" UNIQUE("submission_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "submission_tracks" (
	"id" text PRIMARY KEY,
	"submission_id" text NOT NULL,
	"track_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "submission_tracks_submission_track_unique" UNIQUE("submission_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"code" text NOT NULL,
	"kind" "submission_kind" NOT NULL,
	"status" "submission_status" NOT NULL,
	"source_form_id" text,
	"submitter_contact_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"format_id" text,
	"level_id" text,
	"language" text DEFAULT 'en' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"room_id" text,
	"schedule_dirty" boolean DEFAULT false NOT NULL,
	"capacity" integer,
	"ceu_credits" integer,
	"client_session_id" text,
	"notified_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"answers" jsonb NOT NULL,
	"approved_snapshot" jsonb DEFAULT '{}' NOT NULL,
	"content_review_status" "content_approval_status" DEFAULT 'approved'::"content_approval_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "submissions_event_code_unique" UNIQUE("event_id","code")
);
--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_org_idx" ON "organization_invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations" ("email");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");--> statement-breakpoint
CREATE INDEX "event_members_event_idx" ON "event_members" ("event_id");--> statement-breakpoint
CREATE INDEX "formats_event_idx" ON "formats" ("event_id");--> statement-breakpoint
CREATE INDEX "levels_event_idx" ON "levels" ("event_id");--> statement-breakpoint
CREATE INDEX "reviewer_tracks_member_idx" ON "reviewer_tracks" ("event_member_id");--> statement-breakpoint
CREATE INDEX "rooms_event_idx" ON "rooms" ("event_id");--> statement-breakpoint
CREATE INDEX "tags_event_idx" ON "tags" ("event_id");--> statement-breakpoint
CREATE INDEX "tracks_event_idx" ON "tracks" ("event_id");--> statement-breakpoint
CREATE INDEX "form_fields_form_position_idx" ON "form_fields" ("form_id","position");--> statement-breakpoint
CREATE INDEX "forms_event_idx" ON "forms" ("event_id");--> statement-breakpoint
CREATE INDEX "email_log_event_idx" ON "email_log" ("event_id");--> statement-breakpoint
CREATE INDEX "email_log_contact_idx" ON "email_log" ("contact_id");--> statement-breakpoint
CREATE INDEX "email_log_submission_idx" ON "email_log" ("submission_id");--> statement-breakpoint
CREATE INDEX "file_comments_upload_idx" ON "file_comments" ("file_upload_id","created_at");--> statement-breakpoint
CREATE INDEX "file_requests_event_idx" ON "file_requests" ("event_id");--> statement-breakpoint
CREATE INDEX "file_uploads_request_idx" ON "file_uploads" ("file_request_id");--> statement-breakpoint
CREATE INDEX "file_uploads_contact_idx" ON "file_uploads" ("contact_id");--> statement-breakpoint
CREATE INDEX "file_versions_upload_idx" ON "file_versions" ("file_upload_id","uploaded_at");--> statement-breakpoint
CREATE INDEX "portal_form_responses_form_idx" ON "portal_form_responses" ("form_id");--> statement-breakpoint
CREATE INDEX "portal_forms_event_idx" ON "portal_forms" ("event_id");--> statement-breakpoint
CREATE INDEX "task_assignments_contact_idx" ON "task_assignments" ("contact_id");--> statement-breakpoint
CREATE INDEX "task_assignments_submission_idx" ON "task_assignments" ("submission_id");--> statement-breakpoint
CREATE INDEX "task_templates_event_idx" ON "task_templates" ("event_id");--> statement-breakpoint
CREATE INDEX "contacts_event_idx" ON "contacts" ("event_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewer_idx" ON "reviews" ("reviewer_id");--> statement-breakpoint
CREATE INDEX "submission_edit_history_submission_idx" ON "submission_edit_history" ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_participants_contact_idx" ON "submission_participants" ("contact_id");--> statement-breakpoint
CREATE INDEX "submission_tags_tag_idx" ON "submission_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "submission_tracks_track_idx" ON "submission_tracks" ("track_id");--> statement-breakpoint
CREATE INDEX "submissions_event_status_idx" ON "submissions" ("event_id","status");--> statement-breakpoint
CREATE INDEX "submissions_schedule_idx" ON "submissions" ("event_id","room_id","starts_at");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_inviter_id_users_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_organization_id_organizations_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "formats" ADD CONSTRAINT "formats_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviewer_tracks" ADD CONSTRAINT "reviewer_tracks_event_member_id_event_members_id_fkey" FOREIGN KEY ("event_member_id") REFERENCES "event_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviewer_tracks" ADD CONSTRAINT "reviewer_tracks_track_id_tracks_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_file_upload_id_file_uploads_id_fkey" FOREIGN KEY ("file_upload_id") REFERENCES "file_uploads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_author_contact_id_contacts_id_fkey" FOREIGN KEY ("author_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_author_event_member_id_event_members_id_fkey" FOREIGN KEY ("author_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "file_requests" ADD CONSTRAINT "file_requests_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_file_request_id_file_requests_id_fkey" FOREIGN KEY ("file_request_id") REFERENCES "file_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_upload_id_file_uploads_id_fkey" FOREIGN KEY ("file_upload_id") REFERENCES "file_uploads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploader_contact_id_contacts_id_fkey" FOREIGN KEY ("uploader_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploader_event_member_id_event_members_id_fkey" FOREIGN KEY ("uploader_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "portal_form_responses" ADD CONSTRAINT "portal_form_responses_form_id_portal_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "portal_forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portal_form_responses" ADD CONSTRAINT "portal_form_responses_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portal_form_responses" ADD CONSTRAINT "portal_form_responses_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portal_forms" ADD CONSTRAINT "portal_forms_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_template_id_task_templates_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_portal_form_id_portal_forms_id_fkey" FOREIGN KEY ("portal_form_id") REFERENCES "portal_forms"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_file_request_id_file_requests_id_fkey" FOREIGN KEY ("file_request_id") REFERENCES "file_requests"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_event_members_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "event_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_edit_history" ADD CONSTRAINT "submission_edit_history_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_edit_history" ADD CONSTRAINT "submission_edit_history_author_contact_id_contacts_id_fkey" FOREIGN KEY ("author_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "submission_edit_history" ADD CONSTRAINT "submission_edit_history_lGpBq3BATzJH_fkey" FOREIGN KEY ("author_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "submission_edit_history" ADD CONSTRAINT "submission_edit_history_t1uISl1nyA9l_fkey" FOREIGN KEY ("reviewed_by_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "submission_participants" ADD CONSTRAINT "submission_participants_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_participants" ADD CONSTRAINT "submission_participants_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_tags" ADD CONSTRAINT "submission_tags_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_tags" ADD CONSTRAINT "submission_tags_tag_id_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_tracks" ADD CONSTRAINT "submission_tracks_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_tracks" ADD CONSTRAINT "submission_tracks_track_id_tracks_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_source_form_id_forms_id_fkey" FOREIGN KEY ("source_form_id") REFERENCES "forms"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitter_contact_id_contacts_id_fkey" FOREIGN KEY ("submitter_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_format_id_formats_id_fkey" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_level_id_levels_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL;