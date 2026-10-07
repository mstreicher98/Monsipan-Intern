CREATE TABLE `order_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`title` text NOT NULL,
	`file_name` text NOT NULL,
	`sha256` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_documents_order_idx` ON `order_documents` (`order_id`);--> statement-breakpoint
ALTER TABLE `offers` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `order_id` integer REFERENCES orders(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `daily_reports_order_idx` ON `daily_reports` (`order_id`);