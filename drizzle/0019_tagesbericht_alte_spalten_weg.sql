DROP INDEX `daily_report_materials_kind_idx`;--> statement-breakpoint
CREATE INDEX `daily_report_materials_report_idx` ON `daily_report_materials` (`report_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `daily_report_materials` DROP COLUMN `kind`;--> statement-breakpoint
ALTER TABLE `daily_report_rows` DROP COLUMN `q1`;--> statement-breakpoint
ALTER TABLE `daily_report_rows` DROP COLUMN `q2`;--> statement-breakpoint
ALTER TABLE `daily_report_rows` DROP COLUMN `q3`;--> statement-breakpoint
ALTER TABLE `daily_report_rows` DROP COLUMN `q4`;--> statement-breakpoint
ALTER TABLE `daily_report_rows` DROP COLUMN `q5`;--> statement-breakpoint
ALTER TABLE `daily_report_rows` DROP COLUMN `q6`;--> statement-breakpoint
ALTER TABLE `daily_report_rows` DROP COLUMN `q7`;--> statement-breakpoint
ALTER TABLE `daily_report_rows` DROP COLUMN `q8`;