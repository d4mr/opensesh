DELETE FROM verifications;
DELETE FROM accounts;
DELETE FROM sessions;
DELETE FROM email_log;
DELETE FROM file_uploads;
DELETE FROM task_assignments;
DELETE FROM portal_form_responses;
DELETE FROM reviews;
DELETE FROM submission_participants;
DELETE FROM submission_tags;
DELETE FROM submission_tracks;
DELETE FROM submissions;
DELETE FROM form_fields;
DELETE FROM task_templates;
DELETE FROM file_requests;
DELETE FROM portal_forms;
DELETE FROM contacts;
DELETE FROM reviewer_tracks;
DELETE FROM event_members;
DELETE FROM forms;
DELETE FROM rooms;
DELETE FROM levels;
DELETE FROM formats;
DELETE FROM tags;
DELETE FROM tracks;
DELETE FROM users;
DELETE FROM events;

INSERT INTO events (
  id, name, slug, type, website_url, location, timezone, starts_at, ends_at, theme,
  logo_url, background_url, default_submission_limit, created_at, updated_at
) VALUES (
  'evt_aie_nyc_2026', 'AI.Engineer Sandbox — NYC 2026', 'ai-engineer-nyc-2026',
  'conference', 'https://www.ai.engineer/', 'Brooklyn Navy Yard, New York, NY',
  'America/New_York', 1791810000000, 1792011600000,
  'The production AI engineering conference: practical systems, candid failure stories, and the people shipping them.',
  'https://opensesh.io/demo/aie-logo.svg', 'https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=1800&q=80',
  3, 1785585600000, 1785585600000
);

INSERT INTO users (id, email, name, email_verified, image, created_at, updated_at) VALUES
  ('usr_dana', 'demo@opensesh.io', 'Dana Organizer', 1, NULL, 1785585600000, 1785585600000),
  ('usr_rey', 'reviewer@opensesh.io', 'Rey Reviewer', 1, NULL, 1785585600000, 1785585600000);

INSERT INTO event_members (id, event_id, user_id, role, created_at, updated_at) VALUES
  ('mem_dana', 'evt_aie_nyc_2026', 'usr_dana', 'admin', 1785585600000, 1785585600000),
  ('mem_rey', 'evt_aie_nyc_2026', 'usr_rey', 'reviewer', 1785585600000, 1785585600000);

INSERT INTO tracks (id, event_id, name, position, color, created_at, updated_at) VALUES
  ('trk_rag', 'evt_aie_nyc_2026', 'RAG & Retrieval', 1, '#0f766e', 1785585600000, 1785585600000),
  ('trk_agents', 'evt_aie_nyc_2026', 'Agents', 2, '#7c3aed', 1785585600000, 1785585600000),
  ('trk_evals', 'evt_aie_nyc_2026', 'Evals & Observability', 3, '#c2410c', 1785585600000, 1785585600000),
  ('trk_infra', 'evt_aie_nyc_2026', 'Infra & GPUs', 4, '#2563eb', 1785585600000, 1785585600000);

INSERT INTO reviewer_tracks (id, event_member_id, track_id, created_at, updated_at) VALUES
  ('rt_rey_agents', 'mem_rey', 'trk_agents', 1785585600000, 1785585600000),
  ('rt_rey_evals', 'mem_rey', 'trk_evals', 1785585600000, 1785585600000);

INSERT INTO tags (id, event_id, name, position, created_at, updated_at) VALUES
  ('tag_open', 'evt_aie_nyc_2026', 'Open Models', 1, 1785585600000, 1785585600000),
  ('tag_finetune', 'evt_aie_nyc_2026', 'Fine-tuning', 2, 1785585600000, 1785585600000),
  ('tag_voice', 'evt_aie_nyc_2026', 'Voice', 3, 1785585600000, 1785585600000),
  ('tag_safety', 'evt_aie_nyc_2026', 'Safety', 4, 1785585600000, 1785585600000),
  ('tag_cost', 'evt_aie_nyc_2026', 'Cost', 5, 1785585600000, 1785585600000),
  ('tag_multi', 'evt_aie_nyc_2026', 'Multimodal', 6, 1785585600000, 1785585600000),
  ('tag_devtools', 'evt_aie_nyc_2026', 'DevTools', 7, 1785585600000, 1785585600000),
  ('tag_prod', 'evt_aie_nyc_2026', 'Production', 8, 1785585600000, 1785585600000);

INSERT INTO formats (id, event_id, name, position, created_at, updated_at) VALUES
  ('fmt_keynote', 'evt_aie_nyc_2026', 'Keynote', 1, 1785585600000, 1785585600000),
  ('fmt_featured', 'evt_aie_nyc_2026', 'Featured Keynote', 2, 1785585600000, 1785585600000),
  ('fmt_talk', 'evt_aie_nyc_2026', 'Talk', 3, 1785585600000, 1785585600000),
  ('fmt_workshop', 'evt_aie_nyc_2026', 'Workshop', 4, 1785585600000, 1785585600000),
  ('fmt_lightning', 'evt_aie_nyc_2026', 'Lightning', 5, 1785585600000, 1785585600000);

INSERT INTO levels (id, event_id, name, position, created_at, updated_at) VALUES
  ('lvl_intro', 'evt_aie_nyc_2026', 'Intro', 1, 1785585600000, 1785585600000),
  ('lvl_intermediate', 'evt_aie_nyc_2026', 'Intermediate', 2, 1785585600000, 1785585600000),
  ('lvl_advanced', 'evt_aie_nyc_2026', 'Advanced', 3, 1785585600000, 1785585600000);

INSERT INTO rooms (id, event_id, name, position, capacity, created_at, updated_at) VALUES
  ('room_main', 'evt_aie_nyc_2026', 'Main Stage', 1, 900, 1785585600000, 1785585600000),
  ('room_a', 'evt_aie_nyc_2026', 'Hall A', 2, 320, 1785585600000, 1785585600000),
  ('room_b', 'evt_aie_nyc_2026', 'Hall B', 3, 260, 1785585600000, 1785585600000),
  ('room_workshop', 'evt_aie_nyc_2026', 'Workshop Studio', 4, 120, 1785585600000, 1785585600000);

INSERT INTO forms (
  id, event_id, internal_name, external_title, kind, collect_participants, status,
  welcome_heading, welcome_message, show_welcome, abstract_section, participant_section,
  participant_roles, close_date, submission_limit, allow_multiple_drafts, success_message,
  auto_redirect_portal, confirmation_email_enabled, confirmation_email_body,
  admin_alert_user_ids, created_at, updated_at
) VALUES (
  'form_sessions', 'evt_aie_nyc_2026', 'Session Submission Form', 'Welcome to our event!',
  'abstract', 1, 'open', 'Welcome',
  '<p>AI.Engineer Sandbox is built by the people shipping production AI. We are looking for specific, honest talks across RAG & Retrieval, Agents, Evals & Observability, and Infra & GPUs. Show the architecture, the tradeoffs, and what broke before it worked.</p>',
  1,
  '{"title":"Your session","heading":"Abstract","instructions":"Tell reviewers what attendees will learn and include concrete implementation details."}',
  '{"title":"Who is speaking?","heading":"Speakers","instructions":"Add every person who will appear on stage. You can invite up to three speakers."}',
  '[{"role":"speaker","enabled":true,"min":1,"max":3}]',
  1789444740000, NULL, 0,
  '<p>Thank you for sharing your work. We sent a confirmation and will post decisions in your speaker portal.</p>',
  1, 1,
  '<p>We received {{submission.title}}. You can revise it from your speaker portal until September 15.</p>',
  '["usr_dana"]', 1785585600000, 1785585600000
);

INSERT INTO form_fields (
  id, form_id, section, label, field_type, max_chars, required, locked, position,
  options, maps_to, condition, created_at, updated_at
) VALUES
  ('fld_title', 'form_sessions', 'abstract', 'Title', 'text', 255, 1, 1, 1, NULL, 'title', NULL, 1785585600000, 1785585600000),
  ('fld_description', 'form_sessions', 'abstract', 'Description', 'richtext', 5000, 1, 0, 2, NULL, 'description', NULL, 1785585600000, 1785585600000),
  ('fld_format', 'form_sessions', 'abstract', 'Format', 'dropdown', NULL, 1, 0, 3, '{"bind":"format"}', 'format_id', NULL, 1785585600000, 1785585600000),
  ('fld_track', 'form_sessions', 'abstract', 'Track', 'dropdown', NULL, 1, 0, 4, '{"bind":"track"}', 'tracks', NULL, 1785585600000, 1785585600000),
  ('fld_tags', 'form_sessions', 'abstract', 'Tags', 'checkbox', NULL, 1, 0, 5, '{"bind":"tags"}', 'tags', NULL, 1785585600000, 1785585600000),
  ('fld_level', 'form_sessions', 'abstract', 'Level', 'dropdown', NULL, 0, 0, 6, '{"bind":"level"}', 'level_id', NULL, 1785585600000, 1785585600000),
  ('fld_first', 'form_sessions', 'participant', 'First Name', 'text', 255, 1, 1, 1, NULL, 'first_name', NULL, 1785585600000, 1785585600000),
  ('fld_last', 'form_sessions', 'participant', 'Last Name', 'text', 255, 1, 1, 2, NULL, 'last_name', NULL, 1785585600000, 1785585600000),
  ('fld_email', 'form_sessions', 'participant', 'Email', 'email', 255, 1, 1, 3, NULL, 'email', NULL, 1785585600000, 1785585600000),
  ('fld_mobile', 'form_sessions', 'participant', 'Mobile', 'phone', 255, 0, 0, 4, NULL, 'phone', NULL, 1785585600000, 1785585600000),
  ('fld_bio', 'form_sessions', 'participant', 'Biography', 'richtext', 5000, 0, 0, 5, NULL, 'bio', NULL, 1785585600000, 1785585600000);

INSERT INTO contacts (
  id, event_id, email, first_name, last_name, title, company, salutation, honorific,
  pronouns, gender, bio, headshot_url, phone, linkedin_url, twitter_url, facebook_url,
  website_url, custom, created_at, updated_at
) VALUES
  ('con_01','evt_aie_nyc_2026','maya.chen@retrievallabs.ai','Maya','Chen','Staff ML Engineer','Retrieval Labs',NULL,NULL,'she/her',NULL,'Maya builds retrieval systems that serve hundreds of millions of queries at Retrieval Labs. Her recent work focuses on measuring answerability before an LLM is allowed to synthesize a response.','https://i.pravatar.cc/300?u=maya.chen@retrievallabs.ai',NULL,'https://linkedin.com/in/mayachen',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_02','evt_aie_nyc_2026','idris.okafor@relayagents.com','Idris','Okafor','Founder','Relay Agents',NULL,NULL,'he/him',NULL,'Idris leads Relay Agents, where his team operates customer-support agents across voice and chat. He writes about durable tool execution and the operational cost of agent retries.','https://i.pravatar.cc/300?u=idris.okafor@relayagents.com',NULL,'https://linkedin.com/in/idrisokafor','https://x.com/idrisbuilds',NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_03','evt_aie_nyc_2026','sofia.alvarez@signalgrade.dev','Sofía','Alvarez','Evaluation Lead','SignalGrade',NULL,NULL,'she/her',NULL,'Sofía designs production evaluation programs for regulated AI products. She specializes in turning messy support transcripts into stable, auditable graders.','https://i.pravatar.cc/300?u=sofia.alvarez@signalgrade.dev',NULL,'https://linkedin.com/in/sofia-alvarez',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_04','evt_aie_nyc_2026','arjun.mehta@tensorforge.io','Arjun','Mehta','Principal Infrastructure Engineer','TensorForge',NULL,NULL,'he/him',NULL,'Arjun runs GPU inference infrastructure for open models at TensorForge. He has reduced tail latency through continuous batching, quantization, and ruthless capacity modeling.','https://i.pravatar.cc/300?u=arjun.mehta@tensorforge.io',NULL,'https://linkedin.com/in/arjunmehta',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_05','evt_aie_nyc_2026','naomi.brooks@voicefoundry.com','Naomi','Brooks','VP Engineering','Voice Foundry',NULL,NULL,'she/her',NULL,'Naomi ships low-latency voice agents for healthcare scheduling. Her team works at the boundary between streaming speech models, telephony, and human escalation.','https://i.pravatar.cc/300?u=naomi.brooks@voicefoundry.com',NULL,'https://linkedin.com/in/naomibrooks','https://x.com/naomivoice',NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_06','evt_aie_nyc_2026','kenji.sato@openweights.org','Kenji','Sato','Research Engineer','Open Weights',NULL,NULL,'he/him',NULL,'Kenji develops small open models and practical fine-tuning recipes. He focuses on reproducible experiments that teams can run without a research-cluster budget.','https://i.pravatar.cc/300?u=kenji.sato@openweights.org',NULL,NULL,'https://x.com/kenjisato',NULL,'https://kenjisato.dev','{}',1785585600000,1785585600000),
  ('con_07','evt_aie_nyc_2026','amara.nwosu@safeloop.ai','Amara','Nwosu','Head of AI Safety','SafeLoop',NULL,NULL,'she/her',NULL,'Amara builds runtime safety controls for tool-using models. Her work pairs policy testing with product instrumentation so incidents can be diagnosed instead of merely blocked.','https://i.pravatar.cc/300?u=amara.nwosu@safeloop.ai',NULL,'https://linkedin.com/in/amaranwosu',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_08','evt_aie_nyc_2026','lucas.martin@costwise.cloud','Lucas','Martin','CTO','Costwise Cloud',NULL,NULL,'he/him',NULL,'Lucas helps AI teams understand inference cost per user action. He previously built capacity and spend controls for a global consumer platform.','https://i.pravatar.cc/300?u=lucas.martin@costwise.cloud',NULL,'https://linkedin.com/in/lucasmartin',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_09','evt_aie_nyc_2026','priya.raman@multimodal.studio','Priya','Raman','Applied Scientist','Multimodal Studio',NULL,NULL,'she/her',NULL,'Priya creates multimodal assistants for field technicians. She works on grounding image evidence, compact context representations, and evaluation under poor connectivity.','https://i.pravatar.cc/300?u=priya.raman@multimodal.studio',NULL,'https://linkedin.com/in/priyaraman',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_10','evt_aie_nyc_2026','theo.williams@tracekit.dev','Theo','Williams','Creator','TraceKit',NULL,NULL,'they/them',NULL,'Theo is the creator of TraceKit, an open-source observability toolkit for agent workflows. They care about traces that explain user-visible failures rather than producing decorative dashboards.','https://i.pravatar.cc/300?u=theo.williams@tracekit.dev',NULL,NULL,'https://x.com/theobuilds',NULL,'https://tracekit.dev','{}',1785585600000,1785585600000),
  ('con_11','evt_aie_nyc_2026','fatima.elamin@contextworks.ai','Fatima','El-Amin','ML Platform Lead','ContextWorks',NULL,NULL,'she/her',NULL,'Fatima leads the platform behind ContextWorks’ enterprise retrieval products. She specializes in migration paths from prototypes to observable, permission-aware systems.','https://i.pravatar.cc/300?u=fatima.elamin@contextworks.ai',NULL,'https://linkedin.com/in/fatimaelamin',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_12','evt_aie_nyc_2026','owen.park@shipyard.run','Owen','Park','Senior Developer Advocate','Shipyard',NULL,NULL,'he/him',NULL,'Owen teaches product engineers how to debug AI systems with ordinary software-engineering tools. His demos begin with failure reports and end with reproducible fixes.','https://i.pravatar.cc/300?u=owen.park@shipyard.run',NULL,'https://linkedin.com/in/owenpark','https://x.com/owenpark',NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_13','evt_aie_nyc_2026','lina.haddad@checkpoint.health','Lina','Haddad','Director of AI','Checkpoint Health',NULL,NULL,'she/her',NULL,'Lina deploys clinical documentation models with evidence trails and human review. She works closely with clinicians to define what a safe abstention looks like in practice.','https://i.pravatar.cc/300?u=lina.haddad@checkpoint.health',NULL,'https://linkedin.com/in/linahaddad',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_14','evt_aie_nyc_2026','mateo.silva@batchzero.ai','Mateo','Silva','Infrastructure Architect','BatchZero',NULL,NULL,'he/him',NULL,'Mateo designs multi-tenant inference systems for bursty workloads. His current focus is balancing queueing delay, model locality, and GPU utilization without hiding the tradeoffs.','https://i.pravatar.cc/300?u=mateo.silva@batchzero.ai',NULL,'https://linkedin.com/in/mateosilva',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_15','evt_aie_nyc_2026','grace.kim@finegrain.ai','Grace','Kim','Co-founder','Finegrain AI',NULL,NULL,'she/her',NULL,'Grace helps small teams fine-tune models on narrow, high-value workflows. She has shipped data curation pipelines for legal, finance, and operations teams.','https://i.pravatar.cc/300?u=grace.kim@finegrain.ai',NULL,'https://linkedin.com/in/gracekim',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_16','evt_aie_nyc_2026','darius.cole@redteam.tools','Darius','Cole','Security Engineer','Redteam Tools',NULL,NULL,'he/him',NULL,'Darius tests tool-using agents against prompt injection and confused-deputy failures. He turns offensive findings into concrete controls engineering teams can deploy.','https://i.pravatar.cc/300?u=darius.cole@redteam.tools',NULL,NULL,'https://x.com/dariusredteam',NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_17','evt_aie_nyc_2026','yuki.tanaka@memorylane.ai','Yuki','Tanaka','Staff Software Engineer','MemoryLane AI',NULL,NULL,'they/them',NULL,'Yuki builds long-running agent memory systems and studies when remembering less improves outcomes. Their systems combine retrieval, summarization, and explicit user controls.',NULL,NULL,'https://linkedin.com/in/yukitanaka',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_18','evt_aie_nyc_2026','elena.petrov@latencyworks.com','Elena','Petrov','Performance Engineer','LatencyWorks',NULL,NULL,'she/her',NULL,'Elena profiles end-to-end latency in multimodal and voice applications. She helps teams find the milliseconds users actually notice and remove work from the critical path.',NULL,NULL,'https://linkedin.com/in/elenapetrov',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_19','evt_aie_nyc_2026','jamal.reed@agentdesk.co','Jamal','Reed','Product Engineer','AgentDesk',NULL,NULL,'he/him',NULL,NULL,NULL,NULL,NULL,'https://x.com/jamalbuilds',NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_20','evt_aie_nyc_2026','ines.dubois@searchlight.dev','Inès','Dubois','Search Engineer','Searchlight',NULL,NULL,'she/her',NULL,NULL,NULL,NULL,'https://linkedin.com/in/inesdubois',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_21','evt_aie_nyc_2026','diego.morales@modelgarden.ai','Diego','Morales','ML Engineer','Model Garden',NULL,NULL,'he/him',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_22','evt_aie_nyc_2026','ayesha.khan@guardrail.systems','Ayesha','Khan','Founder','Guardrail Systems',NULL,NULL,'she/her',NULL,NULL,NULL,NULL,'https://linkedin.com/in/ayeshakhan',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_23','evt_aie_nyc_2026','noah.green@vectorhouse.io','Noah','Green','Solutions Architect','VectorHouse',NULL,NULL,'he/him',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_24','evt_aie_nyc_2026','mei.liu@promptops.dev','Mei','Liu','Developer Experience Lead','PromptOps',NULL,NULL,'she/her',NULL,NULL,NULL,NULL,'https://linkedin.com/in/meiliu',NULL,NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_25','evt_aie_nyc_2026','samira.bello@opencompute.org','Samira','Bello','Systems Researcher','Open Compute Collective',NULL,NULL,'she/her',NULL,NULL,NULL,NULL,NULL,'https://x.com/samirabello',NULL,NULL,'{}',1785585600000,1785585600000),
  ('con_26','evt_aie_nyc_2026','ben.carter@toolsmith.ai','Ben','Carter','Independent Engineer','Toolsmith AI',NULL,NULL,'he/him',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'https://bencarter.dev','{}',1785585600000,1785585600000);

INSERT INTO submissions (
  id, event_id, code, kind, status, source_form_id, submitter_contact_id, title,
  description, format_id, level_id, language, starts_at, ends_at, room_id, capacity,
  ceu_credits, client_session_id, notified_at, submitted_at, answers, created_at, updated_at
) VALUES
  ('sub_01','evt_aie_nyc_2026','SESS-1','abstract','pending','form_sessions','con_01','RAG is dead, long live retrieval','A practical teardown of a retrieval stack that stopped treating generation quality as a proxy for search quality. We will cover answerability, query routing, hybrid retrieval, and the metrics that exposed silent misses.','fmt_talk','lvl_intermediate','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1785844800000,'{}',1785844800000,1785844800000),
  ('sub_02','evt_aie_nyc_2026','SESS-2','abstract','pending','form_sessions','con_02','Agents that survive the weekend','How we made customer-support agents durable across deploys, vendor timeouts, and human handoffs. Attendees will leave with a state model, an idempotency strategy, and the failure budget we use in production.','fmt_talk','lvl_advanced','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1785931200000,'{}',1785931200000,1785931200000),
  ('sub_03','evt_aie_nyc_2026','SESS-3','abstract','pending','form_sessions','con_03','Evals that don''t lie: grading agents in production','Offline scores looked healthy while users were repeating themselves. This talk shows how we rebuilt evaluation around real task outcomes, slice ownership, and adjudication that does not collapse disagreement into a single number.','fmt_featured','lvl_intermediate','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786017600000,'{}',1786017600000,1786017600000),
  ('sub_04','evt_aie_nyc_2026','SESS-4','abstract','pending','form_sessions','con_04','Continuous batching without the mystery','A systems-level walkthrough of continuous batching for mixed-length requests, including queue policy, KV-cache pressure, and why impressive throughput graphs can conceal terrible tail latency.','fmt_talk','lvl_advanced','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786104000000,'{}',1786104000000,1786104000000),
  ('sub_05','evt_aie_nyc_2026','SESS-5','abstract','pending','form_sessions','con_05','Shipping voice agents on a $200/mo budget','A live architecture for a small-business voice agent using streaming transcription, constrained tools, aggressive caching, and graceful human fallback. Every cost line is shown.','fmt_workshop','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786190400000,'{}',1786190400000,1786190400000),
  ('sub_06','evt_aie_nyc_2026','SESS-6','abstract','pending','form_sessions','con_07','The prompt injection incident review','A candid reconstruction of an indirect prompt injection that crossed tool boundaries. We will map the blast radius, the missing controls, and the layered mitigations deployed afterward.','fmt_talk','lvl_advanced','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786276800000,'{}',1786276800000,1786276800000),
  ('sub_07','evt_aie_nyc_2026','SESS-7','abstract','pending','form_sessions','con_08','Cost per resolved task, not cost per token','Token dashboards reward the wrong optimizations. This session builds a unit-economics model for agent workflows, including retries, human review, cache misses, and abandoned tasks.','fmt_lightning','lvl_intermediate','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786363200000,'{}',1786363200000,1786363200000),
  ('sub_08','evt_aie_nyc_2026','SESS-8','abstract','pending','form_sessions','con_09','Multimodal field support with bad Wi-Fi','How to build an image-and-text assistant for technicians when connectivity is intermittent and mistakes are expensive. We cover evidence compression, local queues, and grounded follow-up questions.','fmt_talk','lvl_intermediate','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786449600000,'{}',1786449600000,1786449600000),
  ('sub_09','evt_aie_nyc_2026','SESS-9','abstract','pending','form_sessions','con_10','Tracing the user-visible failure','A trace is only useful if it explains why a user did not get their job done. We connect model calls, tool state, retries, and UI recovery into one diagnostic story.','fmt_talk','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786536000000,'{}',1786536000000,1786536000000),
  ('sub_10','evt_aie_nyc_2026','SESS-10','abstract','pending','form_sessions','con_11','Permission-aware retrieval in the real world','Enterprise RAG fails when authorization is bolted on after indexing. This talk covers document-level ACL propagation, cache isolation, and tests that prevent a fast answer from becoming a data leak.','fmt_talk','lvl_advanced','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786622400000,'{}',1786622400000,1786622400000),
  ('sub_11','evt_aie_nyc_2026','SESS-11','abstract','pending','form_sessions','con_12','Debugging AI with boring tools','Logs, fixtures, replay, and deterministic boundaries still work. This workshop shows how product engineers can isolate model variability without inventing an entirely new engineering discipline.','fmt_workshop','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786708800000,'{}',1786708800000,1786708800000),
  ('sub_12','evt_aie_nyc_2026','SESS-12','abstract','maybe','form_sessions','con_17','Your agent remembers too much','Long-term memory can amplify stale facts, privacy risk, and user confusion. We compare selective forgetting, source-aware summaries, and explicit memory controls in long-running assistants.','fmt_talk','lvl_intermediate','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786795200000,'{}',1786795200000,1786795200000),
  ('sub_13','evt_aie_nyc_2026','SESS-13','abstract','maybe','form_sessions','con_18','The 300 milliseconds users notice','A measurement-driven tour of latency in voice and multimodal products. We separate network, model, orchestration, and rendering delay, then prioritize the changes that improve perceived speed.','fmt_lightning','lvl_intermediate','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786881600000,'{}',1786881600000,1786881600000),
  ('sub_14','evt_aie_nyc_2026','SESS-14','abstract','maybe','form_sessions','con_19','Human handoff is an agent capability','Escalation should be modeled as a first-class tool with context, ownership, and completion criteria. We show the handoff contract that cut repeat explanations in half.','fmt_talk','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1786968000000,'{}',1786968000000,1786968000000),
  ('sub_15','evt_aie_nyc_2026','SESS-15','abstract','maybe','form_sessions','con_20','Query rewriting after the honeymoon','Query rewriting improves demos and quietly destroys exact intent. This talk presents a routing policy based on ambiguity, retrieval confidence, and reversible transformations.','fmt_talk','lvl_advanced','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1787054400000,'{}',1787054400000,1787054400000),
  ('sub_16','evt_aie_nyc_2026','SESS-16','abstract','accepted','form_sessions','con_13','Abstention is a feature','Clinical AI needs to know when evidence is insufficient. We show how product, evaluation, and interface decisions combine to make abstention useful rather than frustrating.','fmt_keynote','lvl_intermediate','en',1791810000000,1791813600000,'room_main',NULL,NULL,NULL,1788264000000,1787140800000,'{}',1787140800000,1788264000000),
  ('sub_17','evt_aie_nyc_2026','SESS-17','abstract','accepted','form_sessions','con_14','Packing GPUs for bursty inference','A concrete scheduler for multi-tenant inference with bursty arrivals. We cover model locality, admission control, and why average utilization is a dangerous success metric.','fmt_talk','lvl_advanced','en',1791813600000,1791817200000,'room_a',NULL,NULL,NULL,1788264000000,1787227200000,'{}',1787227200000,1788264000000),
  ('sub_18','evt_aie_nyc_2026','SESS-18','abstract','accepted','form_sessions','con_15','Fine-tuning with 800 examples','A reproducible workflow for turning a small, carefully adjudicated dataset into a useful specialist model. Includes data splits, error analysis, and rollback criteria.','fmt_talk','lvl_intermediate','en',1791815400000,1791819000000,'room_a',NULL,NULL,NULL,1788264000000,1787313600000,'{}',1787313600000,1788264000000),
  ('sub_19','evt_aie_nyc_2026','SESS-19','abstract','accepted','form_sessions','con_16','Red-teaming tool-using agents','A hands-on threat model for agents that browse, email, and modify business data. We move from prompt injection payloads to capability boundaries and verifiable approvals.','fmt_workshop','lvl_advanced','en',1791819000000,1791822600000,'room_b',NULL,NULL,NULL,1788264000000,1787400000000,'{}',1787400000000,1788264000000),
  ('sub_20','evt_aie_nyc_2026','SESS-20','abstract','accepted','form_sessions','con_06','Small models, sharp tools','Open models become much more capable when tools are narrow and feedback is immediate. This session builds a local-first coding assistant and measures the impact of tool design.','fmt_workshop','lvl_intermediate','en',1791820800000,1791824400000,'room_workshop',NULL,NULL,NULL,1788264000000,1787486400000,'{}',1787486400000,1788264000000),
  ('sub_21','evt_aie_nyc_2026','SESS-21','abstract','accepted','form_sessions','con_01','When retrieval should refuse','Retrieval quality improves when the system can declare that the corpus cannot answer. We cover calibrated refusal, escalation, and how to explain missing evidence to users.','fmt_talk','lvl_advanced','en',1791824400000,1791828000000,'room_main',NULL,NULL,NULL,1788264000000,1787572800000,'{}',1787572800000,1788264000000),
  ('sub_22','evt_aie_nyc_2026','SESS-22','abstract','declined','form_sessions','con_22','Guardrails solve everything','A broad survey of guardrail products and common safety categories, with a proposed checklist for teams starting an AI project.','fmt_talk','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,NULL,1788350400000,1787659200000,'{}',1787659200000,1788350400000),
  ('sub_23','evt_aie_nyc_2026','SESS-23','abstract','declined','form_sessions','con_23','Choosing a vector database in 2026','A feature comparison of popular vector stores covering filters, indexing algorithms, pricing models, and managed deployment options.','fmt_talk','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,NULL,1788350400000,1787745600000,'{}',1787745600000,1788350400000),
  ('sub_24','evt_aie_nyc_2026','SESS-24','abstract','withdrawn','form_sessions','con_24','Prompts as production assets','A workflow for versioning, reviewing, testing, and releasing prompt changes alongside application code.','fmt_lightning','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1787832000000,'{}',1787832000000,1788436800000),
  ('sub_25','evt_aie_nyc_2026','SESS-25','abstract','draft','form_sessions','con_25','Making open inference boring','Notes toward a production playbook for operating open models with predictable latency, observability, and upgrade paths.','fmt_talk','lvl_advanced','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{}',1787918400000,1787918400000),
  ('sub_26','evt_aie_nyc_2026','SESS-26','abstract','draft','form_sessions','con_26','Tool schemas humans can debug','A draft workshop on designing tool inputs, validation errors, and audit trails that both models and on-call engineers can understand.','fmt_workshop','lvl_intermediate','en',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{}',1788004800000,1788004800000),
  ('sub_27','evt_aie_nyc_2026','SESS-27','session','accepted',NULL,'con_04','Opening keynote: The new AI engineering stack','A field report on the systems layer emerging between foundation models and reliable products, with lessons gathered from teams operating at meaningful scale.','fmt_featured','lvl_intro','en',1791896400000,1791900000000,'room_main',NULL,NULL,'sponsor-nimbus-01',NULL,1788091200000,'{}',1788091200000,1788091200000),
  ('sub_28','evt_aie_nyc_2026','SESS-28','session','accepted',NULL,'con_05','Voice systems lab: latency you can hear','An interactive sponsor lab where attendees inspect a streaming voice pipeline, tune interruption handling, and compare the experience at different latency budgets.','fmt_workshop','lvl_intermediate','en',1791900000000,1791903600000,'room_a',NULL,NULL,'sponsor-sonic-02',NULL,1788094800000,'{}',1788094800000,1788094800000),
  ('sub_29','evt_aie_nyc_2026','SESS-29','session','accepted',NULL,'con_08','Inference economics breakfast','A moderated conversation about capacity planning, committed spend, and the organizational habits that keep model bills connected to product value.','fmt_talk','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,'sponsor-costwise-03',NULL,1788098400000,'{}',1788098400000,1788098400000),
  ('sub_30','evt_aie_nyc_2026','SESS-30','session','accepted',NULL,'con_10','Open-source observability clinic','Bring a broken agent trace. Maintainers from the ecosystem will help identify missing context, misleading spans, and the shortest path to a useful incident timeline.','fmt_workshop','lvl_intermediate','en',NULL,NULL,NULL,NULL,NULL,'sponsor-tracekit-04',NULL,1788102000000,'{}',1788102000000,1788102000000),
  ('sub_31','evt_aie_nyc_2026','SESS-31','session','accepted',NULL,'con_06','Open models showcase','Five teams demonstrate useful products running on open weights, then share the deployment profile and fine-tuning decision behind each one.','fmt_lightning','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,'sponsor-openweights-05',NULL,1788105600000,'{}',1788105600000,1788105600000),
  ('sub_32','evt_aie_nyc_2026','SESS-32','session','accepted',NULL,'con_12','Closing session: what we learned in the sandbox','A fast synthesis of recurring architecture choices, unresolved debates, and implementation ideas collected from speakers and attendees across the conference.','fmt_keynote','lvl_intro','en',NULL,NULL,NULL,NULL,NULL,'sponsor-shipyard-06',NULL,1788109200000,'{}',1788109200000,1788109200000);

-- The sub_17/sub_18 Hall A overlap is the single deliberate room conflict for the agenda demo.

INSERT INTO submission_tracks (id, submission_id, track_id, created_at, updated_at) VALUES
  ('st_01','sub_01','trk_rag',1785585600000,1785585600000),('st_02','sub_02','trk_agents',1785585600000,1785585600000),
  ('st_03','sub_03','trk_evals',1785585600000,1785585600000),('st_04','sub_04','trk_infra',1785585600000,1785585600000),
  ('st_05','sub_05','trk_agents',1785585600000,1785585600000),('st_06','sub_06','trk_agents',1785585600000,1785585600000),
  ('st_07','sub_07','trk_infra',1785585600000,1785585600000),('st_08','sub_08','trk_agents',1785585600000,1785585600000),
  ('st_09','sub_09','trk_evals',1785585600000,1785585600000),('st_10','sub_10','trk_rag',1785585600000,1785585600000),
  ('st_11','sub_11','trk_evals',1785585600000,1785585600000),('st_12','sub_12','trk_agents',1785585600000,1785585600000),
  ('st_13','sub_13','trk_infra',1785585600000,1785585600000),('st_14','sub_14','trk_agents',1785585600000,1785585600000),
  ('st_15','sub_15','trk_rag',1785585600000,1785585600000),('st_16','sub_16','trk_evals',1785585600000,1785585600000),
  ('st_17','sub_17','trk_infra',1785585600000,1785585600000),('st_18','sub_18','trk_infra',1785585600000,1785585600000),
  ('st_19','sub_19','trk_agents',1785585600000,1785585600000),('st_20','sub_20','trk_agents',1785585600000,1785585600000),
  ('st_21','sub_21','trk_rag',1785585600000,1785585600000),('st_22','sub_22','trk_evals',1785585600000,1785585600000),
  ('st_23','sub_23','trk_rag',1785585600000,1785585600000),('st_24','sub_24','trk_evals',1785585600000,1785585600000),
  ('st_25','sub_25','trk_infra',1785585600000,1785585600000),('st_26','sub_26','trk_agents',1785585600000,1785585600000),
  ('st_27','sub_27','trk_infra',1785585600000,1785585600000),('st_28','sub_28','trk_agents',1785585600000,1785585600000),
  ('st_29','sub_29','trk_infra',1785585600000,1785585600000),('st_30','sub_30','trk_evals',1785585600000,1785585600000),
  ('st_31','sub_31','trk_infra',1785585600000,1785585600000),('st_32','sub_32','trk_agents',1785585600000,1785585600000);

INSERT INTO submission_tags (id, submission_id, tag_id, created_at, updated_at) VALUES
  ('sg_01a','sub_01','tag_prod',1785585600000,1785585600000),('sg_01b','sub_01','tag_devtools',1785585600000,1785585600000),
  ('sg_02a','sub_02','tag_prod',1785585600000,1785585600000),('sg_02b','sub_02','tag_devtools',1785585600000,1785585600000),
  ('sg_03a','sub_03','tag_prod',1785585600000,1785585600000),('sg_03b','sub_03','tag_safety',1785585600000,1785585600000),
  ('sg_04a','sub_04','tag_prod',1785585600000,1785585600000),('sg_04b','sub_04','tag_cost',1785585600000,1785585600000),
  ('sg_05a','sub_05','tag_voice',1785585600000,1785585600000),('sg_05b','sub_05','tag_cost',1785585600000,1785585600000),
  ('sg_06a','sub_06','tag_safety',1785585600000,1785585600000),('sg_06b','sub_06','tag_prod',1785585600000,1785585600000),
  ('sg_07a','sub_07','tag_cost',1785585600000,1785585600000),('sg_07b','sub_07','tag_prod',1785585600000,1785585600000),
  ('sg_08a','sub_08','tag_multi',1785585600000,1785585600000),('sg_08b','sub_08','tag_prod',1785585600000,1785585600000),
  ('sg_09a','sub_09','tag_devtools',1785585600000,1785585600000),('sg_09b','sub_09','tag_prod',1785585600000,1785585600000),
  ('sg_10a','sub_10','tag_safety',1785585600000,1785585600000),('sg_10b','sub_10','tag_prod',1785585600000,1785585600000),
  ('sg_11a','sub_11','tag_devtools',1785585600000,1785585600000),('sg_11b','sub_11','tag_prod',1785585600000,1785585600000),
  ('sg_12a','sub_12','tag_prod',1785585600000,1785585600000),('sg_12b','sub_12','tag_safety',1785585600000,1785585600000),
  ('sg_13a','sub_13','tag_voice',1785585600000,1785585600000),('sg_13b','sub_13','tag_multi',1785585600000,1785585600000),
  ('sg_14a','sub_14','tag_prod',1785585600000,1785585600000),('sg_14b','sub_14','tag_devtools',1785585600000,1785585600000),
  ('sg_15a','sub_15','tag_prod',1785585600000,1785585600000),('sg_15b','sub_15','tag_devtools',1785585600000,1785585600000),
  ('sg_16a','sub_16','tag_safety',1785585600000,1785585600000),('sg_16b','sub_16','tag_prod',1785585600000,1785585600000),
  ('sg_17a','sub_17','tag_cost',1785585600000,1785585600000),('sg_17b','sub_17','tag_prod',1785585600000,1785585600000),
  ('sg_18a','sub_18','tag_finetune',1785585600000,1785585600000),('sg_18b','sub_18','tag_open',1785585600000,1785585600000),
  ('sg_19a','sub_19','tag_safety',1785585600000,1785585600000),('sg_19b','sub_19','tag_devtools',1785585600000,1785585600000),
  ('sg_20a','sub_20','tag_open',1785585600000,1785585600000),('sg_20b','sub_20','tag_devtools',1785585600000,1785585600000),
  ('sg_21a','sub_21','tag_prod',1785585600000,1785585600000),('sg_21b','sub_21','tag_safety',1785585600000,1785585600000),
  ('sg_22a','sub_22','tag_safety',1785585600000,1785585600000),('sg_22b','sub_22','tag_prod',1785585600000,1785585600000),
  ('sg_23a','sub_23','tag_devtools',1785585600000,1785585600000),('sg_23b','sub_23','tag_cost',1785585600000,1785585600000),
  ('sg_24a','sub_24','tag_devtools',1785585600000,1785585600000),('sg_24b','sub_24','tag_prod',1785585600000,1785585600000),
  ('sg_25a','sub_25','tag_open',1785585600000,1785585600000),('sg_25b','sub_25','tag_prod',1785585600000,1785585600000),
  ('sg_26a','sub_26','tag_devtools',1785585600000,1785585600000),('sg_26b','sub_26','tag_prod',1785585600000,1785585600000),
  ('sg_27a','sub_27','tag_prod',1785585600000,1785585600000),('sg_27b','sub_27','tag_open',1785585600000,1785585600000),
  ('sg_28a','sub_28','tag_voice',1785585600000,1785585600000),('sg_28b','sub_28','tag_devtools',1785585600000,1785585600000),
  ('sg_29a','sub_29','tag_cost',1785585600000,1785585600000),('sg_29b','sub_29','tag_prod',1785585600000,1785585600000),
  ('sg_30a','sub_30','tag_devtools',1785585600000,1785585600000),('sg_30b','sub_30','tag_prod',1785585600000,1785585600000),
  ('sg_31a','sub_31','tag_open',1785585600000,1785585600000),('sg_31b','sub_31','tag_finetune',1785585600000,1785585600000),
  ('sg_32a','sub_32','tag_prod',1785585600000,1785585600000),('sg_32b','sub_32','tag_devtools',1785585600000,1785585600000);

INSERT INTO submission_participants (id, submission_id, contact_id, role, position, created_at, updated_at) VALUES
  ('sp_01a','sub_01','con_01','speaker',1,1785585600000,1785585600000),('sp_01b','sub_01','con_20','speaker',2,1785585600000,1785585600000),
  ('sp_02a','sub_02','con_02','speaker',1,1785585600000,1785585600000),('sp_02b','sub_02','con_19','speaker',2,1785585600000,1785585600000),
  ('sp_03a','sub_03','con_03','speaker',1,1785585600000,1785585600000),('sp_04a','sub_04','con_04','speaker',1,1785585600000,1785585600000),
  ('sp_05a','sub_05','con_05','speaker',1,1785585600000,1785585600000),('sp_06a','sub_06','con_07','speaker',1,1785585600000,1785585600000),
  ('sp_06b','sub_06','con_16','speaker',2,1785585600000,1785585600000),('sp_07a','sub_07','con_08','speaker',1,1785585600000,1785585600000),
  ('sp_08a','sub_08','con_09','speaker',1,1785585600000,1785585600000),('sp_09a','sub_09','con_10','speaker',1,1785585600000,1785585600000),
  ('sp_10a','sub_10','con_11','speaker',1,1785585600000,1785585600000),('sp_11a','sub_11','con_12','speaker',1,1785585600000,1785585600000),
  ('sp_12a','sub_12','con_17','speaker',1,1785585600000,1785585600000),('sp_13a','sub_13','con_18','speaker',1,1785585600000,1785585600000),
  ('sp_14a','sub_14','con_19','speaker',1,1785585600000,1785585600000),('sp_15a','sub_15','con_20','speaker',1,1785585600000,1785585600000),
  ('sp_16a','sub_16','con_13','speaker',1,1785585600000,1785585600000),('sp_16b','sub_16','con_22','speaker',2,1785585600000,1785585600000),
  ('sp_17a','sub_17','con_14','speaker',1,1785585600000,1785585600000),('sp_18a','sub_18','con_15','speaker',1,1785585600000,1785585600000),
  ('sp_18b','sub_18','con_21','speaker',2,1785585600000,1785585600000),('sp_19a','sub_19','con_16','speaker',1,1785585600000,1785585600000),
  ('sp_20a','sub_20','con_06','speaker',1,1785585600000,1785585600000),('sp_20b','sub_20','con_26','speaker',2,1785585600000,1785585600000),
  ('sp_21a','sub_21','con_01','speaker',1,1785585600000,1785585600000),('sp_22a','sub_22','con_22','speaker',1,1785585600000,1785585600000),
  ('sp_23a','sub_23','con_23','speaker',1,1785585600000,1785585600000),('sp_24a','sub_24','con_24','speaker',1,1785585600000,1785585600000),
  ('sp_25a','sub_25','con_25','speaker',1,1785585600000,1785585600000),('sp_26a','sub_26','con_26','speaker',1,1785585600000,1785585600000),
  ('sp_27a','sub_27','con_04','speaker',1,1785585600000,1785585600000),('sp_28a','sub_28','con_05','speaker',1,1785585600000,1785585600000),
  ('sp_29a','sub_29','con_08','speaker',1,1785585600000,1785585600000),('sp_30a','sub_30','con_10','speaker',1,1785585600000,1785585600000),
  ('sp_31a','sub_31','con_06','speaker',1,1785585600000,1785585600000),('sp_32a','sub_32','con_12','speaker',1,1785585600000,1785585600000);

INSERT INTO reviews (id, submission_id, reviewer_id, decision, score, comment, created_at, updated_at) VALUES
  ('rev_01','sub_02','mem_rey','approve',5,'The durability model is concrete and the incident examples make this immediately useful.',1788177600000,1788177600000),
  ('rev_02','sub_03','mem_rey','maybe',4,'Strong premise; ask for one full grader-disagreement example in the final outline.',1788178200000,1788178200000),
  ('rev_03','sub_06','mem_rey','deny',2,'Important topic, but the current abstract is mostly incident narrative and needs more reusable engineering detail.',1788178800000,1788178800000),
  ('rev_04','sub_12','mem_rey','maybe',4,'A thoughtful counterweight to memory hype. The user-control section should be expanded.',1788179400000,1788179400000),
  ('rev_05','sub_14','mem_rey','approve',5,'Clear product insight with a specific implementation contract and measurable outcome.',1788180000000,1788180000000),
  ('rev_06','sub_22','mem_rey','deny',2,'The scope is too broad for a talk and does not yet offer evidence beyond a product checklist.',1788180600000,1788180600000);

INSERT INTO portal_forms (
  id, event_id, name, title, target_type, sections, confirmation_email_enabled,
  confirmation_email_body, created_at, updated_at
) VALUES
  ('pf_hotel','evt_aie_nyc_2026','Hotel stay requirements','Hotel stay requirements','contact',
   '[{"title":"Your stay","instructions":"Tell us which nights you need so we can reserve the correct room block.","fields":[{"label":"Check-in date","type":"date","required":true,"options":null,"note":null},{"label":"Check-out date","type":"date","required":true,"options":null,"note":null},{"label":"Room preference","type":"dropdown","required":true,"options":["King","Two queens","Accessible room"],"note":null},{"label":"Special requests","type":"richtext","required":false,"options":null,"note":null}]}]',
   1,'<p>Thanks — our speaker team will confirm your reservation details by email.</p>',1785585600000,1785585600000),
  ('pf_flight','evt_aie_nyc_2026','Flight reimbursement','Flight reimbursement','contact',
   '[{"title":"Travel plan","instructions":"Share your expected itinerary before booking travel above the policy cap.","fields":[{"label":"Departure airport","type":"text","required":true,"options":null,"note":null},{"label":"Estimated cost (USD)","type":"number","required":true,"options":null,"note":null},{"label":"Receipt upload note","type":"richtext","required":false,"options":null,"note":"After purchase, keep the itemized receipt for reimbursement."}]}]',
   1,'<p>Your estimate is with the speaker operations team. We will contact you if approval is needed.</p>',1785585600000,1785585600000);

INSERT INTO task_templates (
  id, event_id, title, instructions, scope, portal_form_id, file_request_id,
  auto_assign_on_accept, due_date, position, created_at, updated_at
) VALUES
  ('tt_hotel','evt_aie_nyc_2026','Hotel stay requirements','Complete this even if you do not need a room so our team can close the loop.','contact','pf_hotel',NULL,1,1790208000000,1,1785585600000,1785585600000),
  ('tt_flight','evt_aie_nyc_2026','Flight reimbursement','Share an estimate before booking and retain your itemized receipt.','contact','pf_flight',NULL,1,1790208000000,2,1785585600000,1785585600000),
  ('tt_description','evt_aie_nyc_2026','Finalize talk description','Review the public description and make any final audience-facing edits.','submission',NULL,NULL,1,1790812800000,3,1785585600000,1785585600000),
  ('tt_profile','evt_aie_nyc_2026','Confirm bio & headshot','Check that your bio is current and your headshot is suitable for the public speaker gallery.','contact',NULL,NULL,1,1790812800000,4,1785585600000,1785585600000);

INSERT INTO task_assignments (
  id, task_template_id, contact_id, submission_id, status, completed_at, created_at, updated_at
)
SELECT
  'ta_' || template.id || '_' || accepted.contact_id,
  template.id,
  accepted.contact_id,
  NULL,
  CASE
    WHEN accepted.contact_id IN ('con_01','con_06') THEN 'done'
    WHEN template.id = 'tt_profile' AND accepted.contact_id IN ('con_04','con_05','con_10','con_12') THEN 'done'
    ELSE 'todo'
  END,
  CASE
    WHEN accepted.contact_id IN ('con_01','con_06') THEN 1788609600000
    WHEN template.id = 'tt_profile' AND accepted.contact_id IN ('con_04','con_05','con_10','con_12') THEN 1788609600000
    ELSE NULL
  END,
  1788264000000,
  1788609600000
FROM task_templates AS template
CROSS JOIN (
  SELECT DISTINCT participant.contact_id
  FROM submission_participants AS participant
  INNER JOIN submissions AS submission ON submission.id = participant.submission_id
  WHERE submission.status = 'accepted'
) AS accepted
WHERE template.scope = 'contact';

INSERT INTO task_assignments (
  id, task_template_id, contact_id, submission_id, status, completed_at, created_at, updated_at
)
SELECT
  'ta_' || template.id || '_' || submission.id,
  template.id,
  NULL,
  submission.id,
  CASE WHEN submission.id IN ('sub_21','sub_31') THEN 'done' ELSE 'todo' END,
  CASE WHEN submission.id IN ('sub_21','sub_31') THEN 1788609600000 ELSE NULL END,
  1788264000000,
  1788609600000
FROM task_templates AS template
CROSS JOIN submissions AS submission
WHERE template.scope = 'submission' AND submission.status = 'accepted';

INSERT INTO portal_form_responses (
  id, form_id, contact_id, submission_id, answers, submitted_at, created_at, updated_at
) VALUES
  ('pfr_01','pf_hotel','con_01',NULL,'{"Check-in date":"2026-10-11","Check-out date":"2026-10-15","Room preference":"King","Special requests":"Late arrival after 9 PM."}',1788523200000,1788523200000,1788523200000),
  ('pfr_02','pf_flight','con_01',NULL,'{"Departure airport":"SFO","Estimated cost (USD)":640,"Receipt upload note":"Nonstop fare held through Friday."}',1788526800000,1788526800000,1788526800000),
  ('pfr_03','pf_hotel','con_06',NULL,'{"Check-in date":"2026-10-12","Check-out date":"2026-10-14","Room preference":"Two queens","Special requests":"No special requests."}',1788530400000,1788530400000,1788530400000),
  ('pfr_04','pf_flight','con_06',NULL,'{"Departure airport":"SEA","Estimated cost (USD)":510,"Receipt upload note":"Morning outbound preferred."}',1788534000000,1788534000000,1788534000000);

INSERT INTO email_log (
  id, event_id, contact_id, type, subject, body, ics_attached, status, sent_at,
  created_at, updated_at
) VALUES
  ('email_01','evt_aie_nyc_2026','con_01','confirmation','We received “RAG is dead, long live retrieval”','Thanks, Maya. Your submission SESS-1 is in the review queue.',0,'sent',1785844860000,1785844860000,1785844860000),
  ('email_02','evt_aie_nyc_2026','con_03','confirmation','We received “Evals that don''t lie”','Thanks, Sofía. Your submission SESS-3 is in the review queue.',0,'sent',1786017660000,1786017660000,1786017660000),
  ('email_03','evt_aie_nyc_2026','con_13','accepted','You''re speaking at AI.Engineer Sandbox NYC','We are delighted to accept “Abstention is a feature.” Your onboarding tasks are ready in the speaker portal.',0,'sent',1788264060000,1788264060000,1788264060000),
  ('email_04','evt_aie_nyc_2026','con_22','declined','An update on your AI.Engineer Sandbox submission','Thank you for the thoughtful proposal. We are not able to include it in this year''s program.',0,'sent',1788350460000,1788350460000,1788350460000);
