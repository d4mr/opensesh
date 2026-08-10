CREATE TABLE `events` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`timezone` text NOT NULL
);

INSERT INTO `events` (`id`, `name`, `slug`, `starts_at`, `ends_at`, `timezone`)
VALUES (
	'evt_ai_engineer_nyc_2026',
	'AI.Engineer Sandbox — NYC 2026',
	'ai-engineer-nyc-2026',
	'2026-10-20T09:00:00-04:00',
	'2026-10-22T17:00:00-04:00',
	'America/New_York'
);
