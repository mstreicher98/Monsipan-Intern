DROP INDEX `timesheets_user_week_idx`;--> statement-breakpoint
ALTER TABLE `timesheets` ADD `month` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `timesheets_user_week_month_idx` ON `timesheets` (`user_id`,`week_start`,`month`);--> statement-breakpoint
CREATE INDEX `timesheets_month_idx` ON `timesheets` (`month`);
