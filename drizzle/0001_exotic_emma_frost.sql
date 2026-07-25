CREATE TABLE `security` (
	`id` tinyint NOT NULL,
	`pin_hash` varchar(255),
	`session_secret` varchar(64),
	`failed_attempts` int NOT NULL DEFAULT 0,
	`locked_until` bigint,
	CONSTRAINT `security_id` PRIMARY KEY(`id`)
);
