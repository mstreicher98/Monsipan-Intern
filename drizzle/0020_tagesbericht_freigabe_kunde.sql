ALTER TABLE `daily_reports` ADD `released_by` integer REFERENCES users(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `released_at` integer;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `release_signature` text;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `checked_by` integer REFERENCES users(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `checked_at` integer;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `customer_token` text;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `customer_name` text;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `customer_signature` text;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `customer_signed_at` integer;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `customer_email` text;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `customer_link_sent_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `daily_reports_customer_token_idx` ON `daily_reports` (`customer_token`);--> statement-breakpoint
UPDATE `daily_reports` SET
	`status` = 'geprueft',
	`release_signature` = `close_signature`,
	`released_by` = `closed_by`,
	`released_at` = `closed_at`,
	`checked_by` = `closed_by`,
	`checked_at` = `closed_at`,
	`customer_token` = lower(hex(randomblob(16)))
WHERE `status` = 'abgeschlossen';
