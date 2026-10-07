CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`addition` text DEFAULT '' NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`zip` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`uid` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE TABLE `offer_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offer_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'position' NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`quantity` real,
	`unit` text DEFAULT '' NOT NULL,
	`unit_price` real,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `offer_positions_offer_idx` ON `offer_positions` (`offer_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`project_number` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
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
	`status` text DEFAULT 'entwurf' NOT NULL,
	`released_by` integer,
	`released_at` integer,
	`customer_token` text,
	`customer_email` text,
	`customer_link_sent_at` integer,
	`change_request` text,
	`change_request_name` text,
	`change_requested_at` integer,
	`accepted_name` text,
	`accepted_signature` text,
	`accepted_at` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`released_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_number_idx` ON `offers` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `offers_customer_token_idx` ON `offers` (`customer_token`);--> statement-breakpoint
CREATE INDEX `offers_customer_idx` ON `offers` (`customer_id`);--> statement-breakpoint
CREATE INDEX `offers_date_idx` ON `offers` (`date`);--> statement-breakpoint
CREATE TABLE `order_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'position' NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`quantity` real,
	`unit` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_positions_order_idx` ON `order_positions` (`order_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`offer_id` integer,
	`party_id` integer,
	`status` text DEFAULT 'erstellt' NOT NULL,
	`project_number` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`customer_addition` text DEFAULT '' NOT NULL,
	`customer_street` text DEFAULT '' NOT NULL,
	`customer_zip` text DEFAULT '' NOT NULL,
	`customer_city` text DEFAULT '' NOT NULL,
	`customer_contact` text DEFAULT '' NOT NULL,
	`customer_phone` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status_by` integer,
	`status_at` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`status_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_idx` ON `orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_offer_idx` ON `orders` (`offer_id`);--> statement-breakpoint
CREATE INDEX `orders_party_idx` ON `orders` (`party_id`);