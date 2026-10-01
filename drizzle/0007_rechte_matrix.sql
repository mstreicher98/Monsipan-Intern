CREATE TABLE `role_permissions` (
	`role` text NOT NULL,
	`permission` text NOT NULL,
	`allowed` integer DEFAULT false NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`role`, `permission`)
);
