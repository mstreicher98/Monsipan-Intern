-- Stundenzettel monatlich trennen: bestehende Zettel bekommen ihren Monat,
-- Wochen über den Monatswechsel werden in zwei Zettel geteilt.
-- Die Schritte sind so geschrieben, dass ein erneuter Lauf nichts kaputt macht.

UPDATE `timesheets` SET `month` = substr(`week_start`, 1, 7) WHERE `month` = '';--> statement-breakpoint

INSERT INTO `timesheets` (`user_id`, `week_start`, `month`, `status`, `vaz`, `note`, `created_by`, `updated_at`)
SELECT t.`user_id`, t.`week_start`, substr(d.`date`, 1, 7), 'entwurf', '', '', t.`created_by`, t.`updated_at`
FROM `timesheets` t
JOIN `timesheet_days` d ON d.`timesheet_id` = t.`id`
WHERE substr(d.`date`, 1, 7) <> t.`month`
	AND NOT EXISTS (
		SELECT 1 FROM `timesheets` x
		WHERE x.`user_id` = t.`user_id` AND x.`week_start` = t.`week_start` AND x.`month` = substr(d.`date`, 1, 7)
	)
GROUP BY t.`user_id`, t.`week_start`, substr(d.`date`, 1, 7);--> statement-breakpoint

UPDATE `timesheet_days`
SET `timesheet_id` = (
	SELECT n.`id` FROM `timesheets` n
	JOIN `timesheets` o ON o.`id` = `timesheet_days`.`timesheet_id`
	WHERE n.`user_id` = o.`user_id` AND n.`week_start` = o.`week_start` AND n.`month` = substr(`timesheet_days`.`date`, 1, 7)
)
WHERE substr(`date`, 1, 7) <> (SELECT o.`month` FROM `timesheets` o WHERE o.`id` = `timesheet_days`.`timesheet_id`)
	AND EXISTS (
		SELECT 1 FROM `timesheets` n
		JOIN `timesheets` o ON o.`id` = `timesheet_days`.`timesheet_id`
		WHERE n.`user_id` = o.`user_id` AND n.`week_start` = o.`week_start` AND n.`month` = substr(`timesheet_days`.`date`, 1, 7)
	);
