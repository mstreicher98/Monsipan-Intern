ALTER TABLE `daily_report_materials` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_report_materials` ADD `product_id` integer REFERENCES products(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `daily_report_materials` ADD `material` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_report_positions` ADD `total_quantity` real;--> statement-breakpoint
ALTER TABLE `daily_report_rows` ADD `quantities` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `close_signature` text;--> statement-breakpoint
UPDATE `daily_report_rows` SET `quantities` = json_array(`q1`, `q2`, `q3`, `q4`, `q5`, `q6`, `q7`, `q8`);--> statement-breakpoint
UPDATE `daily_report_materials` SET
	`material` = CASE `kind` WHEN 'gelb' THEN 'gelb' WHEN 'weiss' THEN 'weiß' ELSE 'Reflexk.' END,
	`sort_order` = CASE `kind` WHEN 'gelb' THEN 0 WHEN 'weiss' THEN 1 ELSE 2 END;
