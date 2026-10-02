ALTER TABLE `timesheet_days` ADD `times` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
-- Bisherige Zeiten übernehmen: Beginn – Pause und Pauseende – Ende werden zwei Zeiträume,
-- ohne vollständige Pause bleibt es einer. Nur Zeilen, die noch nichts in "times" haben.
UPDATE `timesheet_days` SET `times` = CASE
	WHEN `from_time` = '' AND `to_time` = '' THEN '[]'
	WHEN `break_start` <> '' AND `break_end` <> '' THEN json_array(
		json_object('from', `from_time`, 'to', `break_start`),
		json_object('from', `break_end`, 'to', `to_time`)
	)
	ELSE json_array(json_object('from', `from_time`, 'to', `to_time`))
END
WHERE `times` = '[]';
