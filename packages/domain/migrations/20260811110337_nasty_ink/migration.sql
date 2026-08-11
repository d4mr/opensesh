CREATE TYPE "agenda_draft_status" AS ENUM('draft', 'generated', 'committed', 'discarded');--> statement-breakpoint
CREATE TYPE "campaign_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "content_approval_status" AS ENUM('approved', 'pending_review', 'rejected');--> statement-breakpoint
CREATE TYPE "crm_semantic_status" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "dietary_requirement" AS ENUM('none', 'vegetarian', 'vegan', 'gluten_free', 'other');--> statement-breakpoint
CREATE TYPE "email_campaign_status" AS ENUM('draft', 'sending', 'sent');--> statement-breakpoint
CREATE TYPE "email_status" AS ENUM('queued', 'demo', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "email_type" AS ENUM('confirmation', 'magic_link', 'accepted', 'declined', 'task_reminder', 'calendar_invite', 'custom');--> statement-breakpoint
CREATE TYPE "embed_view" AS ENUM('sessions', 'speakers', 'speaker_gallery', 'agenda', 'itinerary');--> statement-breakpoint
CREATE TYPE "event_member_role" AS ENUM('admin', 'reviewer');--> statement-breakpoint
CREATE TYPE "file_kind" AS ENUM('request', 'headshot', 'slides');--> statement-breakpoint
CREATE TYPE "form_field_type" AS ENUM('text', 'textarea', 'richtext', 'email', 'phone', 'dropdown', 'checkbox', 'file', 'datetime');--> statement-breakpoint
CREATE TYPE "form_section" AS ENUM('abstract', 'participant');--> statement-breakpoint
CREATE TYPE "form_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'canceled');--> statement-breakpoint
CREATE TYPE "review_assignment_status" AS ENUM('pending', 'completed', 'recused');--> statement-breakpoint
CREATE TYPE "review_criterion_type" AS ENUM('numeric', 'dropdown', 'text');--> statement-breakpoint
CREATE TYPE "review_decision" AS ENUM('approve', 'maybe', 'deny');--> statement-breakpoint
CREATE TYPE "review_round_status" AS ENUM('draft', 'open', 'closed');--> statement-breakpoint
CREATE TYPE "speaker_workflow_status" AS ENUM('invited', 'onboarding', 'confirmed', 'ready', 'declined');--> statement-breakpoint
CREATE TYPE "submission_kind" AS ENUM('abstract', 'session');--> statement-breakpoint
CREATE TYPE "submission_status" AS ENUM('draft', 'pending', 'maybe', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "target_type" AS ENUM('contact', 'submission');--> statement-breakpoint
CREATE TYPE "task_status" AS ENUM('todo', 'done', 'waived');--> statement-breakpoint
CREATE TYPE "tshirt_size" AS ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL');--> statement-breakpoint
CREATE TABLE "agenda_drafts" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "agenda_draft_status" DEFAULT 'draft'::"agenda_draft_status" NOT NULL,
	"criteria" jsonb NOT NULL,
	"proposal" jsonb DEFAULT '{"placements":[]}' NOT NULL,
	"generated_at" timestamp with time zone,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "embeds" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"view" "embed_view" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"options" jsonb DEFAULT '{}' NOT NULL,
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
	"logo_key" text,
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
CREATE TABLE "crm_pipeline_cards" (
	"id" text PRIMARY KEY,
	"organization_contact_id" text NOT NULL CONSTRAINT "crm_pipeline_cards_contact_unique" UNIQUE,
	"stage_id" text NOT NULL,
	"owner_event_member_id" text,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_pipeline_stages" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"semantic_status" "crm_semantic_status" NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_pipeline_stages_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "crm_segments" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"filter" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_segments_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "crm_stage_history" (
	"id" text PRIMARY KEY,
	"card_id" text NOT NULL,
	"from_stage_id" text,
	"to_stage_id" text NOT NULL,
	"actor_event_member_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_contact_events" (
	"id" text PRIMARY KEY,
	"organization_contact_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"event_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_contact_events_org_contact_event_unique" UNIQUE("organization_contact_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "organization_contact_notes" (
	"id" text PRIMARY KEY,
	"organization_contact_id" text NOT NULL,
	"body" text NOT NULL,
	"author_event_member_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_contact_tags" (
	"id" text PRIMARY KEY,
	"organization_contact_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_contact_tags_contact_tag_unique" UNIQUE("organization_contact_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "organization_contacts" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"title" text,
	"company" text,
	"bio" text,
	"linkedin_url" text,
	"twitter_url" text,
	"facebook_url" text,
	"website_url" text,
	"headshot_url" text,
	"custom" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_contacts_org_email_unique" UNIQUE("organization_id","email")
);
--> statement-breakpoint
CREATE TABLE "organization_tags" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_tags_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "email_campaign_recipients" (
	"id" text PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"contact_id" text,
	"recipient_name" text NOT NULL,
	"recipient_email" text NOT NULL,
	"resolved_subject" text NOT NULL,
	"resolved_body" text NOT NULL,
	"delivery_status" "campaign_delivery_status" DEFAULT 'pending'::"campaign_delivery_status" NOT NULL,
	"email_log_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_campaign_recipients_campaign_email_unique" UNIQUE("campaign_id","recipient_email")
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"template_id" text,
	"subject_snapshot" text NOT NULL,
	"body_snapshot" text NOT NULL,
	"recipient_filter" jsonb DEFAULT '{}' NOT NULL,
	"status" "email_campaign_status" DEFAULT 'draft'::"email_campaign_status" NOT NULL,
	"created_by_event_member_id" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"merge_fields" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_templates_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "reminder_rules" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"scope" "target_type" NOT NULL,
	"task_type" text NOT NULL,
	"days_before_due" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reminder_rules_event_scope_type_unique" UNIQUE("event_id","scope","task_type")
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
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"html_body" text NOT NULL,
	"ics_attached" boolean DEFAULT false NOT NULL,
	"ics_content" text,
	"ics_sequence" integer,
	"status" "email_status" NOT NULL,
	"provider" text,
	"provider_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
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
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" text PRIMARY KEY,
	"file_request_id" text,
	"requirement_id" text,
	"kind" "file_kind" NOT NULL,
	"contact_id" text NOT NULL,
	"submission_id" text,
	"speaker_last_read_at" timestamp with time zone,
	"admin_last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "file_uploads_submission_requirement_unique" UNIQUE("submission_id","requirement_id")
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
CREATE TABLE "session_file_requirements" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_at" timestamp with time zone,
	"accept_types" text,
	"max_size_mb" integer,
	"position" integer NOT NULL,
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
CREATE TABLE "ai_review_results" (
	"id" text PRIMARY KEY,
	"round_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"score" double precision NOT NULL,
	"reasoning" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"overridden_score" double precision,
	"override_reason" text,
	"overridden_by_event_member_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"overridden_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_review_results_round_submission_unique" UNIQUE("round_id","submission_id")
);
--> statement-breakpoint
CREATE TABLE "review_answers" (
	"id" text PRIMARY KEY,
	"assignment_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"numeric_value" double precision,
	"text_value" text,
	"option_value" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_answers_assignment_criterion_unique" UNIQUE("assignment_id","criterion_id")
);
--> statement-breakpoint
CREATE TABLE "review_assignments" (
	"id" text PRIMARY KEY,
	"round_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"event_member_id" text NOT NULL,
	"status" "review_assignment_status" DEFAULT 'pending'::"review_assignment_status" NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"recused_at" timestamp with time zone,
	"recusal_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_assignments_round_submission_member_unique" UNIQUE("round_id","submission_id","event_member_id")
);
--> statement-breakpoint
CREATE TABLE "review_criteria" (
	"id" text PRIMARY KEY,
	"round_id" text NOT NULL,
	"label" text NOT NULL,
	"type" "review_criterion_type" NOT NULL,
	"min" double precision,
	"max" double precision,
	"options" jsonb DEFAULT '[]' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_criteria_round_label_unique" UNIQUE("round_id","label")
);
--> statement-breakpoint
CREATE TABLE "review_round_members" (
	"id" text PRIMARY KEY,
	"round_id" text NOT NULL,
	"event_member_id" text NOT NULL,
	"assignment_cap" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_round_members_round_member_unique" UNIQUE("round_id","event_member_id")
);
--> statement-breakpoint
CREATE TABLE "review_rounds" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"blind" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"status" "review_round_status" DEFAULT 'draft'::"review_round_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_rounds_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "contact_edit_history" (
	"id" text PRIMARY KEY,
	"contact_id" text NOT NULL,
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
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY,
	"event_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"participation" text DEFAULT 'speaker' NOT NULL,
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
	"approved_profile" jsonb DEFAULT '{}' NOT NULL,
	"profile_review_status" "content_approval_status" DEFAULT 'approved'::"content_approval_status" NOT NULL,
	"workflow_status" "speaker_workflow_status" DEFAULT 'invited'::"speaker_workflow_status" NOT NULL,
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
	"ics_sequence" integer DEFAULT 0 NOT NULL,
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
CREATE INDEX "agenda_drafts_event_created_idx" ON "agenda_drafts" ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_org_idx" ON "organization_invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations" ("email");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");--> statement-breakpoint
CREATE INDEX "embeds_event_idx" ON "embeds" ("event_id");--> statement-breakpoint
CREATE INDEX "event_members_event_idx" ON "event_members" ("event_id");--> statement-breakpoint
CREATE INDEX "formats_event_idx" ON "formats" ("event_id");--> statement-breakpoint
CREATE INDEX "levels_event_idx" ON "levels" ("event_id");--> statement-breakpoint
CREATE INDEX "reviewer_tracks_member_idx" ON "reviewer_tracks" ("event_member_id");--> statement-breakpoint
CREATE INDEX "rooms_event_idx" ON "rooms" ("event_id");--> statement-breakpoint
CREATE INDEX "tags_event_idx" ON "tags" ("event_id");--> statement-breakpoint
CREATE INDEX "tracks_event_idx" ON "tracks" ("event_id");--> statement-breakpoint
CREATE INDEX "crm_pipeline_cards_stage_idx" ON "crm_pipeline_cards" ("stage_id");--> statement-breakpoint
CREATE INDEX "crm_pipeline_stages_org_position_idx" ON "crm_pipeline_stages" ("organization_id","position");--> statement-breakpoint
CREATE INDEX "crm_stage_history_card_idx" ON "crm_stage_history" ("card_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_contact_events_event_idx" ON "organization_contact_events" ("event_id");--> statement-breakpoint
CREATE INDEX "organization_contact_notes_contact_idx" ON "organization_contact_notes" ("organization_contact_id");--> statement-breakpoint
CREATE INDEX "organization_contact_tags_tag_idx" ON "organization_contact_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "organization_contacts_org_name_idx" ON "organization_contacts" ("organization_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "email_campaign_recipients_contact_idx" ON "email_campaign_recipients" ("contact_id");--> statement-breakpoint
CREATE INDEX "email_campaigns_event_idx" ON "email_campaigns" ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "email_templates_event_idx" ON "email_templates" ("event_id");--> statement-breakpoint
CREATE INDEX "reminder_rules_event_idx" ON "reminder_rules" ("event_id");--> statement-breakpoint
CREATE INDEX "form_fields_form_position_idx" ON "form_fields" ("form_id","position");--> statement-breakpoint
CREATE INDEX "forms_event_idx" ON "forms" ("event_id");--> statement-breakpoint
CREATE INDEX "email_log_event_idx" ON "email_log" ("event_id");--> statement-breakpoint
CREATE INDEX "email_log_contact_idx" ON "email_log" ("contact_id");--> statement-breakpoint
CREATE INDEX "email_log_submission_idx" ON "email_log" ("submission_id");--> statement-breakpoint
CREATE INDEX "file_comments_upload_idx" ON "file_comments" ("file_upload_id","created_at");--> statement-breakpoint
CREATE INDEX "file_requests_event_idx" ON "file_requests" ("event_id");--> statement-breakpoint
CREATE INDEX "file_uploads_request_idx" ON "file_uploads" ("file_request_id");--> statement-breakpoint
CREATE INDEX "file_uploads_requirement_idx" ON "file_uploads" ("requirement_id");--> statement-breakpoint
CREATE INDEX "file_uploads_contact_idx" ON "file_uploads" ("contact_id");--> statement-breakpoint
CREATE INDEX "file_versions_upload_idx" ON "file_versions" ("file_upload_id","uploaded_at");--> statement-breakpoint
CREATE INDEX "portal_form_responses_form_idx" ON "portal_form_responses" ("form_id");--> statement-breakpoint
CREATE INDEX "portal_forms_event_idx" ON "portal_forms" ("event_id");--> statement-breakpoint
CREATE INDEX "session_file_requirements_event_idx" ON "session_file_requirements" ("event_id","position");--> statement-breakpoint
CREATE INDEX "task_assignments_contact_idx" ON "task_assignments" ("contact_id");--> statement-breakpoint
CREATE INDEX "task_assignments_submission_idx" ON "task_assignments" ("submission_id");--> statement-breakpoint
CREATE INDEX "task_templates_event_idx" ON "task_templates" ("event_id");--> statement-breakpoint
CREATE INDEX "ai_review_results_submission_idx" ON "ai_review_results" ("submission_id");--> statement-breakpoint
CREATE INDEX "review_answers_criterion_idx" ON "review_answers" ("criterion_id");--> statement-breakpoint
CREATE INDEX "review_assignments_round_member_idx" ON "review_assignments" ("round_id","event_member_id");--> statement-breakpoint
CREATE INDEX "review_assignments_submission_idx" ON "review_assignments" ("submission_id");--> statement-breakpoint
CREATE INDEX "review_criteria_round_position_idx" ON "review_criteria" ("round_id","position");--> statement-breakpoint
CREATE INDEX "review_round_members_member_idx" ON "review_round_members" ("event_member_id");--> statement-breakpoint
CREATE INDEX "review_rounds_event_position_idx" ON "review_rounds" ("event_id","position");--> statement-breakpoint
CREATE INDEX "contact_edit_history_contact_idx" ON "contact_edit_history" ("contact_id");--> statement-breakpoint
CREATE INDEX "contacts_event_idx" ON "contacts" ("event_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewer_idx" ON "reviews" ("reviewer_id");--> statement-breakpoint
CREATE INDEX "submission_edit_history_submission_idx" ON "submission_edit_history" ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_participants_contact_idx" ON "submission_participants" ("contact_id");--> statement-breakpoint
CREATE INDEX "submission_tags_tag_idx" ON "submission_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "submission_tracks_track_idx" ON "submission_tracks" ("track_id");--> statement-breakpoint
CREATE INDEX "submissions_event_status_idx" ON "submissions" ("event_id","status");--> statement-breakpoint
CREATE INDEX "submissions_schedule_idx" ON "submissions" ("event_id","room_id","starts_at");--> statement-breakpoint
ALTER TABLE "agenda_drafts" ADD CONSTRAINT "agenda_drafts_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_inviter_id_users_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_organization_id_organizations_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "embeds" ADD CONSTRAINT "embeds_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
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
ALTER TABLE "crm_pipeline_cards" ADD CONSTRAINT "crm_pipeline_cards_XDwCH3rMNOIK_fkey" FOREIGN KEY ("organization_contact_id") REFERENCES "organization_contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crm_pipeline_cards" ADD CONSTRAINT "crm_pipeline_cards_stage_id_crm_pipeline_stages_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "crm_pipeline_stages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crm_pipeline_cards" ADD CONSTRAINT "crm_pipeline_cards_owner_event_member_id_event_members_id_fkey" FOREIGN KEY ("owner_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crm_segments" ADD CONSTRAINT "crm_segments_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_card_id_crm_pipeline_cards_id_fkey" FOREIGN KEY ("card_id") REFERENCES "crm_pipeline_cards"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_from_stage_id_crm_pipeline_stages_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "crm_pipeline_stages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_to_stage_id_crm_pipeline_stages_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "crm_pipeline_stages"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_actor_event_member_id_event_members_id_fkey" FOREIGN KEY ("actor_event_member_id") REFERENCES "event_members"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "organization_contact_events" ADD CONSTRAINT "organization_contact_events_7PwM5Eg6a5P9_fkey" FOREIGN KEY ("organization_contact_id") REFERENCES "organization_contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_contact_events" ADD CONSTRAINT "organization_contact_events_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_contact_events" ADD CONSTRAINT "organization_contact_events_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_contact_notes" ADD CONSTRAINT "organization_contact_notes_syNebiMxxRiH_fkey" FOREIGN KEY ("organization_contact_id") REFERENCES "organization_contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_contact_notes" ADD CONSTRAINT "organization_contact_notes_QWSWRCfWzd19_fkey" FOREIGN KEY ("author_event_member_id") REFERENCES "event_members"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "organization_contact_tags" ADD CONSTRAINT "organization_contact_tags_IrwvbPq77IO9_fkey" FOREIGN KEY ("organization_contact_id") REFERENCES "organization_contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_contact_tags" ADD CONSTRAINT "organization_contact_tags_tag_id_organization_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "organization_tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_contacts" ADD CONSTRAINT "organization_contacts_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_tags" ADD CONSTRAINT "organization_tags_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_campaign_id_email_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_email_log_id_email_log_id_fkey" FOREIGN KEY ("email_log_id") REFERENCES "email_log"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_template_id_email_templates_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_QqF6HxTldSMQ_fkey" FOREIGN KEY ("created_by_event_member_id") REFERENCES "event_members"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
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
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_requirement_id_session_file_requirements_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "session_file_requirements"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_upload_id_file_uploads_id_fkey" FOREIGN KEY ("file_upload_id") REFERENCES "file_uploads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploader_contact_id_contacts_id_fkey" FOREIGN KEY ("uploader_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploader_event_member_id_event_members_id_fkey" FOREIGN KEY ("uploader_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "portal_form_responses" ADD CONSTRAINT "portal_form_responses_form_id_portal_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "portal_forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portal_form_responses" ADD CONSTRAINT "portal_form_responses_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portal_form_responses" ADD CONSTRAINT "portal_form_responses_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portal_forms" ADD CONSTRAINT "portal_forms_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_file_requirements" ADD CONSTRAINT "session_file_requirements_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_template_id_task_templates_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_portal_form_id_portal_forms_id_fkey" FOREIGN KEY ("portal_form_id") REFERENCES "portal_forms"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_file_request_id_file_requests_id_fkey" FOREIGN KEY ("file_request_id") REFERENCES "file_requests"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ai_review_results" ADD CONSTRAINT "ai_review_results_round_id_review_rounds_id_fkey" FOREIGN KEY ("round_id") REFERENCES "review_rounds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_review_results" ADD CONSTRAINT "ai_review_results_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_review_results" ADD CONSTRAINT "ai_review_results_qBcxiMmli4Eo_fkey" FOREIGN KEY ("overridden_by_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_assignment_id_review_assignments_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "review_assignments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_criterion_id_review_criteria_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "review_criteria"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_round_id_review_rounds_id_fkey" FOREIGN KEY ("round_id") REFERENCES "review_rounds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_event_member_id_event_members_id_fkey" FOREIGN KEY ("event_member_id") REFERENCES "event_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_criteria" ADD CONSTRAINT "review_criteria_round_id_review_rounds_id_fkey" FOREIGN KEY ("round_id") REFERENCES "review_rounds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_round_members" ADD CONSTRAINT "review_round_members_round_id_review_rounds_id_fkey" FOREIGN KEY ("round_id") REFERENCES "review_rounds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_round_members" ADD CONSTRAINT "review_round_members_event_member_id_event_members_id_fkey" FOREIGN KEY ("event_member_id") REFERENCES "event_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_rounds" ADD CONSTRAINT "review_rounds_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_edit_history" ADD CONSTRAINT "contact_edit_history_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_edit_history" ADD CONSTRAINT "contact_edit_history_author_contact_id_contacts_id_fkey" FOREIGN KEY ("author_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "contact_edit_history" ADD CONSTRAINT "contact_edit_history_3CH3nLe2GftD_fkey" FOREIGN KEY ("author_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "contact_edit_history" ADD CONSTRAINT "contact_edit_history_D6OFLegOounl_fkey" FOREIGN KEY ("reviewed_by_event_member_id") REFERENCES "event_members"("id") ON DELETE SET NULL;--> statement-breakpoint
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