CREATE TABLE `accounts` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_members` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_event_members_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `event_members_event_user_unique` UNIQUE(`event_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`type` text DEFAULT 'conference' NOT NULL,
	`website_url` text,
	`location` text,
	`timezone` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`theme` text,
	`logo_url` text,
	`background_url` text,
	`default_submission_limit` integer DEFAULT 3 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `formats` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_formats_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `formats_event_name_unique` UNIQUE(`event_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `levels` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_levels_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `levels_event_name_unique` UNIQUE(`event_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `reviewer_tracks` (
	`id` text PRIMARY KEY,
	`event_member_id` text NOT NULL,
	`track_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_reviewer_tracks_event_member_id_event_members_id_fk` FOREIGN KEY (`event_member_id`) REFERENCES `event_members`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_reviewer_tracks_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE,
	CONSTRAINT `reviewer_tracks_member_track_unique` UNIQUE(`event_member_id`,`track_id`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`capacity` integer,
	CONSTRAINT `fk_rooms_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `rooms_event_name_unique` UNIQUE(`event_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_tags_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `tags_event_name_unique` UNIQUE(`event_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`color` text NOT NULL,
	CONSTRAINT `fk_tracks_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `tracks_event_name_unique` UNIQUE(`event_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `form_fields` (
	`id` text PRIMARY KEY,
	`form_id` text NOT NULL,
	`section` text NOT NULL,
	`label` text NOT NULL,
	`field_type` text NOT NULL,
	`max_chars` integer,
	`required` integer DEFAULT false NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`options` text,
	`maps_to` text,
	`condition` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_form_fields_form_id_forms_id_fk` FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `forms` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`internal_name` text NOT NULL,
	`external_title` text NOT NULL,
	`kind` text NOT NULL,
	`collect_participants` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`welcome_heading` text NOT NULL,
	`welcome_message` text NOT NULL,
	`show_welcome` integer DEFAULT true NOT NULL,
	`abstract_section` text NOT NULL,
	`participant_section` text NOT NULL,
	`participant_roles` text NOT NULL,
	`close_date` integer,
	`submission_limit` integer,
	`allow_multiple_drafts` integer DEFAULT false NOT NULL,
	`success_message` text NOT NULL,
	`auto_redirect_portal` integer DEFAULT true NOT NULL,
	`confirmation_email_enabled` integer DEFAULT true NOT NULL,
	`confirmation_email_body` text NOT NULL,
	`admin_alert_user_ids` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_forms_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `email_log` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`contact_id` text,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`ics_attached` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_email_log_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_email_log_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `file_requests` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`target_type` text NOT NULL,
	`instructions` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_file_requests_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `file_uploads` (
	`id` text PRIMARY KEY,
	`file_request_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`submission_id` text,
	`filename` text NOT NULL,
	`url` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_file_uploads_file_request_id_file_requests_id_fk` FOREIGN KEY (`file_request_id`) REFERENCES `file_requests`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_file_uploads_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_file_uploads_submission_id_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `portal_form_responses` (
	`id` text PRIMARY KEY,
	`form_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`submission_id` text,
	`answers` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_portal_form_responses_form_id_portal_forms_id_fk` FOREIGN KEY (`form_id`) REFERENCES `portal_forms`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_portal_form_responses_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_portal_form_responses_submission_id_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `portal_forms` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`target_type` text NOT NULL,
	`sections` text NOT NULL,
	`confirmation_email_enabled` integer DEFAULT false NOT NULL,
	`confirmation_email_body` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_portal_forms_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `task_assignments` (
	`id` text PRIMARY KEY,
	`task_template_id` text NOT NULL,
	`contact_id` text,
	`submission_id` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_task_assignments_task_template_id_task_templates_id_fk` FOREIGN KEY (`task_template_id`) REFERENCES `task_templates`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_task_assignments_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_task_assignments_submission_id_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `task_templates` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text NOT NULL,
	`scope` text NOT NULL,
	`portal_form_id` text,
	`file_request_id` text,
	`auto_assign_on_accept` integer DEFAULT true NOT NULL,
	`due_date` integer,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_task_templates_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_task_templates_portal_form_id_portal_forms_id_fk` FOREIGN KEY (`portal_form_id`) REFERENCES `portal_forms`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_task_templates_file_request_id_file_requests_id_fk` FOREIGN KEY (`file_request_id`) REFERENCES `file_requests`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`title` text,
	`company` text,
	`salutation` text,
	`honorific` text,
	`pronouns` text,
	`gender` text,
	`bio` text,
	`headshot_url` text,
	`phone` text,
	`linkedin_url` text,
	`twitter_url` text,
	`facebook_url` text,
	`website_url` text,
	`custom` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_contacts_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `contacts_event_email_unique` UNIQUE(`event_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY,
	`submission_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`decision` text NOT NULL,
	`score` integer,
	`comment` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_reviews_submission_id_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_reviews_reviewer_id_event_members_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `event_members`(`id`) ON DELETE CASCADE,
	CONSTRAINT `reviews_submission_reviewer_unique` UNIQUE(`submission_id`,`reviewer_id`)
);
--> statement-breakpoint
CREATE TABLE `submission_participants` (
	`id` text PRIMARY KEY,
	`submission_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`role` text DEFAULT 'speaker' NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_submission_participants_submission_id_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_submission_participants_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE,
	CONSTRAINT `submission_participants_submission_contact_unique` UNIQUE(`submission_id`,`contact_id`)
);
--> statement-breakpoint
CREATE TABLE `submission_tags` (
	`id` text PRIMARY KEY,
	`submission_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_submission_tags_submission_id_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_submission_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
	CONSTRAINT `submission_tags_submission_tag_unique` UNIQUE(`submission_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `submission_tracks` (
	`id` text PRIMARY KEY,
	`submission_id` text NOT NULL,
	`track_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_submission_tracks_submission_id_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_submission_tracks_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE,
	CONSTRAINT `submission_tracks_submission_track_unique` UNIQUE(`submission_id`,`track_id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`source_form_id` text,
	`submitter_contact_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`format_id` text,
	`level_id` text,
	`language` text DEFAULT 'en' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`room_id` text,
	`capacity` integer,
	`ceu_credits` integer,
	`client_session_id` text,
	`notified_at` integer,
	`submitted_at` integer,
	`answers` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_submissions_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_submissions_source_form_id_forms_id_fk` FOREIGN KEY (`source_form_id`) REFERENCES `forms`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_submissions_submitter_contact_id_contacts_id_fk` FOREIGN KEY (`submitter_contact_id`) REFERENCES `contacts`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_submissions_format_id_formats_id_fk` FOREIGN KEY (`format_id`) REFERENCES `formats`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_submissions_level_id_levels_id_fk` FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_submissions_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL,
	CONSTRAINT `submissions_event_code_unique` UNIQUE(`event_id`,`code`)
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `event_members_event_idx` ON `event_members` (`event_id`);--> statement-breakpoint
CREATE INDEX `formats_event_idx` ON `formats` (`event_id`);--> statement-breakpoint
CREATE INDEX `levels_event_idx` ON `levels` (`event_id`);--> statement-breakpoint
CREATE INDEX `reviewer_tracks_member_idx` ON `reviewer_tracks` (`event_member_id`);--> statement-breakpoint
CREATE INDEX `rooms_event_idx` ON `rooms` (`event_id`);--> statement-breakpoint
CREATE INDEX `tags_event_idx` ON `tags` (`event_id`);--> statement-breakpoint
CREATE INDEX `tracks_event_idx` ON `tracks` (`event_id`);--> statement-breakpoint
CREATE INDEX `form_fields_form_position_idx` ON `form_fields` (`form_id`,`position`);--> statement-breakpoint
CREATE INDEX `forms_event_idx` ON `forms` (`event_id`);--> statement-breakpoint
CREATE INDEX `email_log_event_idx` ON `email_log` (`event_id`);--> statement-breakpoint
CREATE INDEX `email_log_contact_idx` ON `email_log` (`contact_id`);--> statement-breakpoint
CREATE INDEX `file_requests_event_idx` ON `file_requests` (`event_id`);--> statement-breakpoint
CREATE INDEX `file_uploads_request_idx` ON `file_uploads` (`file_request_id`);--> statement-breakpoint
CREATE INDEX `portal_form_responses_form_idx` ON `portal_form_responses` (`form_id`);--> statement-breakpoint
CREATE INDEX `portal_forms_event_idx` ON `portal_forms` (`event_id`);--> statement-breakpoint
CREATE INDEX `task_assignments_contact_idx` ON `task_assignments` (`contact_id`);--> statement-breakpoint
CREATE INDEX `task_assignments_submission_idx` ON `task_assignments` (`submission_id`);--> statement-breakpoint
CREATE INDEX `task_templates_event_idx` ON `task_templates` (`event_id`);--> statement-breakpoint
CREATE INDEX `contacts_event_idx` ON `contacts` (`event_id`);--> statement-breakpoint
CREATE INDEX `reviews_reviewer_idx` ON `reviews` (`reviewer_id`);--> statement-breakpoint
CREATE INDEX `submission_participants_contact_idx` ON `submission_participants` (`contact_id`);--> statement-breakpoint
CREATE INDEX `submission_tags_tag_idx` ON `submission_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `submission_tracks_track_idx` ON `submission_tracks` (`track_id`);--> statement-breakpoint
CREATE INDEX `submissions_event_status_idx` ON `submissions` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `submissions_schedule_idx` ON `submissions` (`event_id`,`room_id`,`starts_at`);