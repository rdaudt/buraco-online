CREATE TABLE `media_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`seat` integer NOT NULL,
	`kind` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`touched_at` integer NOT NULL
);
