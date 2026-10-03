PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_daily_reports` (
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
	`released_by` integer,
	`released_at` integer,
	`release_signature` text,
	`checked_by` integer,
	`checked_at` integer,
	`customer_token` text,
	`customer_name` text,
	`customer_signature` text,
	`customer_signed_at` integer,
	`customer_email` text,
	`customer_link_sent_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`released_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_daily_reports`("id", "number", "date", "road", "site", "cost_center", "daily_output", "lv_position", "note", "status", "party_id", "created_by", "released_by", "released_at", "release_signature", "checked_by", "checked_at", "customer_token", "customer_name", "customer_signature", "customer_signed_at", "customer_email", "customer_link_sent_at", "created_at", "updated_at") SELECT "id", "number", "date", "road", "site", "cost_center", "daily_output", "lv_position", "note", "status", "party_id", "created_by", "released_by", "released_at", "release_signature", "checked_by", "checked_at", "customer_token", "customer_name", "customer_signature", "customer_signed_at", "customer_email", "customer_link_sent_at", "created_at", "updated_at" FROM `daily_reports`;--> statement-breakpoint
DROP TABLE `daily_reports`;--> statement-breakpoint
ALTER TABLE `__new_daily_reports` RENAME TO `daily_reports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `daily_reports_date_idx` ON `daily_reports` (`date`);--> statement-breakpoint
CREATE INDEX `daily_reports_party_idx` ON `daily_reports` (`party_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_reports_customer_token_idx` ON `daily_reports` (`customer_token`);