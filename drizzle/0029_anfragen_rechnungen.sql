CREATE TABLE `inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`received_on` text NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`sender_name` text DEFAULT '' NOT NULL,
	`sender_email` text DEFAULT '' NOT NULL,
	`sender_phone` text DEFAULT '' NOT NULL,
	`customer_id` integer,
	`location` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`offer_id` integer,
	`closed_at` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inquiries_offer_idx` ON `inquiries` (`offer_id`);--> statement-breakpoint
CREATE INDEX `inquiries_received_idx` ON `inquiries` (`received_on`);--> statement-breakpoint
CREATE TABLE `invoice_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`number` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'position' NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`quantity` real,
	`unit` text DEFAULT '' NOT NULL,
	`unit_price` real,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_positions_invoice_idx` ON `invoice_positions` (`invoice_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`order_id` integer,
	`offer_id` integer,
	`date` text NOT NULL,
	`service_from` text,
	`service_to` text,
	`due_date` text NOT NULL,
	`project_number` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`customer_id` integer,
	`customer_name` text DEFAULT '' NOT NULL,
	`customer_addition` text DEFAULT '' NOT NULL,
	`customer_street` text DEFAULT '' NOT NULL,
	`customer_zip` text DEFAULT '' NOT NULL,
	`customer_city` text DEFAULT '' NOT NULL,
	`customer_uid` text DEFAULT '' NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`closing` text DEFAULT '' NOT NULL,
	`vat_rate` real DEFAULT 20 NOT NULL,
	`reverse_charge` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'offen' NOT NULL,
	`paid_on` text,
	`paid_by` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`paid_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_idx` ON `invoices` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_order_idx` ON `invoices` (`order_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_date_idx` ON `invoices` (`date`);--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_mapping` text;