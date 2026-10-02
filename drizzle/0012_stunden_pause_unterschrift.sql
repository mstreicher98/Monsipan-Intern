ALTER TABLE `timesheet_days` ADD `break_start` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `timesheet_days` ADD `break_end` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `timesheets` ADD `release_signature` text;