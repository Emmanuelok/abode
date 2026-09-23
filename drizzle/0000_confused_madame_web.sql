CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `requests_user_date` ON `requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `shopper_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`updated_at` text NOT NULL
);
