CREATE TABLE `daily_report_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`kind` text NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`film_thickness` real,
	FOREIGN KEY (`report_id`) REFERENCES `daily_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_report_materials_kind_idx` ON `daily_report_materials` (`report_id`,`kind`);--> statement-breakpoint
CREATE TABLE `daily_report_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`idx` integer NOT NULL,
	`lb_pos` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `daily_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_report_positions_idx` ON `daily_report_positions` (`report_id`,`idx`);--> statement-breakpoint
CREATE TABLE `daily_report_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`q1` real,
	`q2` real,
	`q3` real,
	`q4` real,
	`q5` real,
	`q6` real,
	`q7` real,
	`q8` real,
	FOREIGN KEY (`report_id`) REFERENCES `daily_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_report_rows_report_idx` ON `daily_report_rows` (`report_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `daily_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`road` text DEFAULT '' NOT NULL,
	`site` text DEFAULT '' NOT NULL,
	`cost_center` text DEFAULT '' NOT NULL,
	`daily_output` text DEFAULT '' NOT NULL,
	`lv_position` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'entwurf' NOT NULL,
	`party_id` integer,
	`created_by` integer,
	`closed_by` integer,
	`closed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `daily_reports_date_idx` ON `daily_reports` (`date`);--> statement-breakpoint
CREATE INDEX `daily_reports_party_idx` ON `daily_reports` (`party_id`);