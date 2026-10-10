DROP INDEX `invoices_order_idx`;--> statement-breakpoint
ALTER TABLE `invoices` ADD `kind` text DEFAULT 'rechnung' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `state` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `section` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `invoices_order_idx` ON `invoices` (`order_id`);--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `invoice_id` integer REFERENCES invoices(id);--> statement-breakpoint
CREATE INDEX `daily_reports_invoice_idx` ON `daily_reports` (`invoice_id`);--> statement-breakpoint
-- Bisherige Rechnungen: die Berichte, die beim Erstellen schon geprüft waren, gelten als abgerechnet
UPDATE `daily_reports` SET `invoice_id` = (SELECT MIN(`i`.`id`) FROM `invoices` `i` WHERE `i`.`order_id` = `daily_reports`.`order_id`)
WHERE `status` IN ('geprueft', 'abgeschlossen') AND `invoice_id` IS NULL AND `checked_at` IS NOT NULL
	AND `checked_at` <= (SELECT MIN(`i`.`created_at`) FROM `invoices` `i` WHERE `i`.`order_id` = `daily_reports`.`order_id`);
