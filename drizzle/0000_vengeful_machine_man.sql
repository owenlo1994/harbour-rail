CREATE TABLE `rail_observations` (
	`key` text PRIMARY KEY NOT NULL,
	`line` text NOT NULL,
	`payload` text NOT NULL,
	`polled_at` integer DEFAULT 0 NOT NULL,
	`expires_at` integer DEFAULT 0 NOT NULL,
	`source_time` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rail_observations_line_time` ON `rail_observations` (`line`,`polled_at`);--> statement-breakpoint
CREATE TABLE `rail_trip_cache` (
	`line` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
