CREATE TABLE `timesheet_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timesheet_id` integer NOT NULL,
	`date` text NOT NULL,
	`cost_center` text DEFAULT '' NOT NULL,
	`site` text DEFAULT '' NOT NULL,
	`from_time` text DEFAULT '' NOT NULL,
	`to_time` text DEFAULT '' NOT NULL,
	`normal_hours` real DEFAULT 0 NOT NULL,
	`overtime_50` real DEFAULT 0 NOT NULL,
	`overtime_100` real DEFAULT 0 NOT NULL,
	`vacation_hours` real DEFAULT 0 NOT NULL,
	`holiday_hours` real DEFAULT 0 NOT NULL,
	`rain_hours` real DEFAULT 0 NOT NULL,
	`sick_hours` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`timesheet_id`) REFERENCES `timesheets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timesheet_days_sheet_date_idx` ON `timesheet_days` (`timesheet_id`,`date`);--> statement-breakpoint
CREATE TABLE `timesheets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`week_start` text NOT NULL,
	`status` text DEFAULT 'entwurf' NOT NULL,
	`allowance_days` real,
	`allowance_amount` real,
	`vaz` text DEFAULT '' NOT NULL,
	`vaz_percent` real,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`released_by` integer,
	`released_at` integer,
	`checked_by` integer,
	`checked_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`released_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timesheets_user_week_idx` ON `timesheets` (`user_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `timesheets_week_idx` ON `timesheets` (`week_start`);--> statement-breakpoint
CREATE INDEX `timesheets_status_idx` ON `timesheets` (`status`);