# Sessionboard Clone — Data Model

SQL-flavored (SQLite/D1-ready). Conventions: every table has `id` (uuid or autoincrement), `created_at`, `updated_at`; all program entities are event-scoped via `event_id`. `jsonb` = JSON column.

## Design decisions (grounded in the research)

1. **One `submissions` table for abstracts AND sessions** (`kind` column). Sessionboard shares a ~39-field catalog between them and models acceptance as an abstract *graduating* into a session. We implement that graduation as a deliberate same-row shortcut instead of a preserved abstract + linked session row: **accepting flips the row to `kind='session'`** (it keeps its code, answers, reviews, and history), and **leaving accepted un-graduates it** — declining via re-decision or moving back to pending/maybe/waitlisted reverts `kind` to `'abstract'` for form-origin rows (`source_form_id` is not null). Manually created sessions (`source_form_id` null) are born `kind='session'` and never revert. Consequence: `kind='session'` ⇔ "belongs on the Sessions desk", and the **agenda pool = accepted submissions**; there is no separate abstract row to keep in sync.
2. **Statuses**: `draft → pending → maybe → accepted | declined | withdrawn`. This maps swyx's minimum (unreviewed/approve/maybe/deny) onto Sessionboard's lifecycle (Pending / Accept Queue≈maybe / Accepted / Decline Queue / Declined / Withdrawn / Draft) without the queue ceremony. `notified_at` records when the decision email went out.
3. **Custom form answers**: fixed columns for the core catalog fields (title, description, format, track, level…) + `answers jsonb` keyed by field id for everything else. Avoids EAV joins, keeps lists fast.
4. **Contacts vs users**: one `contacts` table for humans (speakers, submitters); `users` only for admin/reviewer logins. Speakers authenticate via magic link tied to contact email — no passwords.
5. **Reviews are flat** (no plans/rounds): one row per reviewer × submission. Routing is derived: reviewer's queue = pending submissions whose tracks intersect the reviewer's tracks.

## Entity relationship overview

```
Event 1─* Form 1─* FormField
Event 1─* Track / Tag / Room / Format / Level (library)
Event 1─* Submission *─* Track, *─* Tag
Submission *─* Contact (via SubmissionParticipant, role + order)
Submission 1─* Review (per reviewer)   User *─* Track (ReviewerTrack)
Event 1─* TaskTemplate ─1? PortalForm | FileRequest
Event 1─* SessionFileRequirement; Submission 1─* FileUpload
TaskTemplate 1─* TaskAssignment *─1 (Contact | Submission)
PortalForm 1─* PortalFormResponse; FileRequest 1─* FileUpload
Submission 1─1? ScheduleSlot (starts_at, ends_at, room)   ← denormalized onto submissions
Event 1─* EmailLog; Event 1─* Embed
```

## Tables

### users — admin/reviewer logins
| column | type | notes |
|---|---|---|
| email | text unique | |
| name | text | |
| password_hash / magic-link only | | implementation choice |

### events
| column | type | notes |
|---|---|---|
| name | text NOT NULL | |
| slug | text unique | public URLs `/submit/{slug}/…`, `/e/{slug}/agenda` |
| type | text | 'conference' default |
| website_url, location | text | |
| timezone | text | IANA, drives all display + ICS |
| starts_at, ends_at | datetime | |
| theme | text ≤1000 | |
| logo_url, background_url | text | |
| default_submission_limit | int default 3 | per-user cap when form has none |

### event_members
| column | type | notes |
|---|---|---|
| event_id → events | | |
| user_id → users | | |
| role | enum: admin, reviewer | |

### reviewer_tracks — category routing
`event_member_id → event_members`, `track_id → tracks`. Reviewer sees pending submissions in these tracks.

### Library (all: event_id, name, position; track adds color)
`tracks (color)`, `tags`, `formats` (Keynote, Featured Keynote, Workshop…), `levels`, `rooms (capacity?)`.

### forms — submission forms (CFP)
| column | type | notes |
|---|---|---|
| event_id | fk | |
| internal_name | text ≤255 | admin-facing |
| external_title | text ≤255 | public H1 |
| kind | enum: abstract, session | what it collects |
| collect_participants | bool default true | |
| status | enum: open, closed | derived from close_date too |
| welcome_heading | text ≤15 | public step label |
| welcome_message | richtext | + show_welcome bool |
| abstract_section | jsonb | {title, heading≤15, instructions} |
| participant_section | jsonb | {title, heading≤15, instructions} |
| participant_roles | jsonb | [{role:'speaker', enabled, min:1, max}] |
| close_date | datetime null | closes new + edits; shown publicly |
| submission_limit | int null | overrides event default |
| allow_multiple_drafts | bool default false | |
| success_message | richtext | must render on confirmation page |
| auto_redirect_portal | bool default true | after 10s |
| confirmation_email_enabled | bool default true | |
| confirmation_email_body | richtext | templated |
| admin_alert_user_ids | jsonb | nice-to-have |

### form_fields
| column | type | notes |
|---|---|---|
| form_id | fk | |
| section | enum: abstract, participant | |
| label | text | |
| field_type | enum: text, richtext, email, phone, dropdown, checkbox, file | |
| max_chars | int | 255 text / 5000 richtext defaults |
| required | bool | |
| locked | bool | system fields: Title; First/Last Name; Email |
| position | int | drag order |
| options | jsonb null | dropdown choices, or `{bind:'track'\|'tags'\|'format'\|'level'}` |
| maps_to | text null | core column on submission/contact (e.g. 'title', 'bio') |
| condition | jsonb null | `{field_id, op:'eq'\|'in', value}` — basic conditional logic |

### contacts — speakers & submitters (portal identities)
| column | type | notes |
|---|---|---|
| event_id | fk | scoped per event (simplest; cross-event later) |
| email | text, unique per event | |
| first_name, last_name | text | |
| salutation, honorific, pronouns, gender | text | |
| bio | richtext ≤5000 | |
| headshot_url | text | completeness check: bio+headshot |
| phone | text | |
| linkedin_url, twitter_url, facebook_url, website_url | text | |
| custom | jsonb | answers to custom participant fields |

### submissions — abstracts and sessions
| column | type | notes |
|---|---|---|
| event_id | fk | |
| code | text | human id `SESS-n`, sequential per event |
| kind | enum: abstract, session | see design decision 1 |
| status | enum: draft, pending, maybe, accepted, declined, withdrawn | |
| source_form_id | fk forms null | null = "Manual" |
| submitter_contact_id | fk contacts | |
| title | text ≤255 NOT NULL | |
| description | richtext ≤5000 | |
| format_id, level_id | fk null | |
| language | text default 'en' | |
| starts_at, ends_at | datetime null | **schedule slot** |
| room_id | fk rooms null | scheduled when starts_at+room set |
| capacity, ceu_credits | int null | parity fields |
| client_session_id | text null | external id |
| notified_at | datetime null | decision email sent |
| answers | jsonb | custom field answers keyed by form_field id |

Junctions: `submission_tracks`, `submission_tags`.

### submission_participants
| column | type | notes |
|---|---|---|
| submission_id, contact_id | fks | |
| role | text default 'speaker' | from form participant_roles |
| position | int | display order |

### reviews
| column | type | notes |
|---|---|---|
| submission_id | fk | |
| reviewer_id | fk event_members | |
| decision | enum: approve, maybe, deny | swyx's minimum workflow |
| score | int 1–5 null | |
| comment | text null | can be attached to decision email |
| unique(submission_id, reviewer_id) | | |

### task_templates — admin-defined onboarding tasks
| column | type | notes |
|---|---|---|
| event_id | fk | |
| title | text | seed: "Hotel Stay Requirements", "Flight Reimbursement" |
| instructions | richtext | |
| scope | enum: contact, submission | drives "My Tasks" vs "Submission Tasks" |
| portal_form_id | fk null | task completed by filling this form |
| file_request_id | fk null | or by uploading a file |
| auto_assign_on_accept | bool default true | **clarification #4** |
| due_date | datetime null | |
| position | int | |

### task_assignments
| column | type | notes |
|---|---|---|
| task_template_id | fk | |
| contact_id | fk null | for contact-scoped |
| submission_id | fk null | for submission-scoped |
| status | enum: todo, done | manual check-off |
| completed_at | datetime null | |

### portal_forms (speaker-facing forms, e.g. hotel/flight)
| column | type | notes |
|---|---|---|
| event_id, name (internal), title (public) | | |
| target_type | enum: contact, submission | |
| sections | jsonb | [{title, instructions, fields:[{label,type,required,options}]}] |
| confirmation_email_enabled, confirmation_email_body | | |

`portal_form_responses`: form_id, contact_id, submission_id?, answers jsonb, submitted_at.

### file_requests / file_uploads
`file_requests`: event_id, title, target_type, instructions. Task-linked uploads keep their request association.

`session_file_requirements`: event_id, title, description, due_at?, accept_types?, max_size_mb?, position. These define the assets expected from every accepted session.

`file_uploads`: file_request_id?, requirement_id?, kind, contact_id, submission_id?, read timestamps. A session asset has `submission_id` + `requirement_id` + `kind='slides'`, unique per submission and requirement. `file_versions` carries each stored version; `file_comments` is the shared organizer/speaker thread.

### email_log
| column | type | notes |
|---|---|---|
| event_id, contact_id | fks | |
| type | enum: confirmation, magic_link, accepted, declined, task_reminder, calendar_invite, custom | |
| subject, body | text | |
| ics_attached | bool | calendar invites |
| status | enum: queued, sent, failed | provider = Resend/CF Email |
| sent_at | datetime | |

### embeds
| column | type | notes |
|---|---|---|
| event_id, name | | |
| view | enum: agenda, session_list, schedule_itinerary, speaker_list, speaker_gallery | |
| enabled | bool | |
| options | jsonb | style/filter/field options |

Public routes serve these views directly (`/e/{slug}/agenda` etc.) + `<iframe>`/script snippet via "Get Code".

### auth for portal
`magic_link_tokens`: contact_id, token hash, expires_at, used_at. Session cookie after redemption. Admin users: separate session auth.

## Derived views (no tables needed)

- **Reviewer queue**: pending submissions ∩ reviewer's tracks, minus already-reviewed.
- **Conflicts**: scheduled submissions overlapping in (a) same room, (b) same speaker (via submission_participants).
- **Speaker readiness dashboard**: accepted speakers × open task_assignments + missing bio/headshot.
- **Agenda pool**: status='accepted' AND starts_at IS NULL.

## Key state machine

```
draft ──submit──▶ pending ──review──▶ maybe ──▶ accepted ──▶ (agenda: schedule slot)
                     │                            │  side-effects on accept:
                     └────────▶ declined          │  • confirm speaker contacts
 (submitter may withdraw at any pre-decision      │  • auto-assign task templates
  point → withdrawn)                              │  • send acceptance email → notified_at
                                                  └  (decline → decline email → notified_at)
```
