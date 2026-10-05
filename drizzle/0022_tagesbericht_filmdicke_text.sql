ALTER TABLE `daily_report_materials` ADD `film_thickness_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `daily_report_materials` SET `film_thickness_text` = CASE
	WHEN `film_thickness` IS NULL THEN ''
	WHEN `film_thickness` = CAST(`film_thickness` AS INTEGER) THEN CAST(CAST(`film_thickness` AS INTEGER) AS TEXT)
	ELSE replace(CAST(`film_thickness` AS TEXT), '.', ',')
END;--> statement-breakpoint
ALTER TABLE `daily_report_materials` DROP COLUMN `film_thickness`;--> statement-breakpoint
ALTER TABLE `daily_report_materials` RENAME COLUMN `film_thickness_text` TO `film_thickness`;
