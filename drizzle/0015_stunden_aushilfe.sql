ALTER TABLE `timesheets` ADD `writing_party_id` integer REFERENCES parties(id) ON DELETE set null;
