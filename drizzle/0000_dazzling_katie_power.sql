CREATE TABLE `calibration` (
	`id` tinyint NOT NULL,
	`cumulative_adjustment` double NOT NULL DEFAULT 1,
	CONSTRAINT `calibration_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calibration_coverage` (
	`position` int NOT NULL,
	`covered` boolean NOT NULL,
	CONSTRAINT `calibration_coverage_position` PRIMARY KEY(`position`)
);
--> statement-breakpoint
CREATE TABLE `day_log_moods` (
	`date` char(10) NOT NULL,
	`mood` enum('calm','happy','energetic','irritable','sad','anxious','sensitive','low') NOT NULL,
	CONSTRAINT `day_log_moods_date_mood_pk` PRIMARY KEY(`date`,`mood`)
);
--> statement-breakpoint
CREATE TABLE `day_log_pain_interference` (
	`date` char(10) NOT NULL,
	`interference` enum('work_or_school','sleep','exercise','social','household') NOT NULL,
	CONSTRAINT `day_log_pain_interference_date_interference_pk` PRIMARY KEY(`date`,`interference`)
);
--> statement-breakpoint
CREATE TABLE `day_log_pain_sites` (
	`date` char(10) NOT NULL,
	`site` enum('lower_abdomen','back','legs','pelvis','head','other') NOT NULL,
	CONSTRAINT `day_log_pain_sites_date_site_pk` PRIMARY KEY(`date`,`site`)
);
--> statement-breakpoint
CREATE TABLE `day_log_symptoms` (
	`date` char(10) NOT NULL,
	`symptom` enum('cramps','breast_tenderness','bloating','headache','fatigue','cravings','gi_change','acne','irritability','low_mood','anxiety','emotional_sensitivity','sleep_change','exercise_change','focus_change','libido_change') NOT NULL,
	CONSTRAINT `day_log_symptoms_date_symptom_pk` PRIMARY KEY(`date`,`symptom`)
);
--> statement-breakpoint
CREATE TABLE `day_logs` (
	`date` char(10) NOT NULL,
	`bleeding` enum('none','spotting','menstrual') NOT NULL,
	`flow` enum('spotting','light','medium','heavy','very_heavy'),
	`bleeding_context` enum('period','intermenstrual','postcoital','unexpected'),
	`period_boundary` enum('start','end'),
	`clots` enum('none','small','ge_2_5cm'),
	`product_changes` int,
	`fastest_product_change_hours` decimal(2,1),
	`double_protection` boolean,
	`night_change` boolean,
	`leak_through` boolean,
	`pain_severity` enum('none','mild','moderate','severe') NOT NULL,
	`painkiller_did_not_help` boolean,
	`nothing_to_report` boolean,
	`notes` text,
	`logged_at` char(10) NOT NULL,
	`fertility_cervical_mucus` enum('dry','sticky','creamy','watery','egg_white'),
	`fertility_ovulation_pain` boolean,
	`fertility_bbt_celsius` decimal(4,2),
	`fertility_opk_result` enum('negative','positive'),
	CONSTRAINT `day_logs_date` PRIMARY KEY(`date`)
);
--> statement-breakpoint
CREATE TABLE `excluded_cycles` (
	`cycle_start_date` char(10) NOT NULL,
	`reason` text NOT NULL,
	`decided_on` char(10) NOT NULL,
	CONSTRAINT `excluded_cycles_cycle_start_date` PRIMARY KEY(`cycle_start_date`)
);
--> statement-breakpoint
CREATE TABLE `health_message_decisions` (
	`rule_id` varchar(16) NOT NULL,
	`dismissed` boolean NOT NULL,
	`snoozed_until` char(10),
	`decided_on` char(10) NOT NULL,
	CONSTRAINT `health_message_decisions_rule_id` PRIMARY KEY(`rule_id`)
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`issued_on` char(10) NOT NULL,
	`predicted_center` char(10),
	`predicted_low` char(10),
	`predicted_high` char(10),
	`resolved_actual_start` char(10),
	`signed_error` int,
	`covered` boolean,
	CONSTRAINT `predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` tinyint NOT NULL,
	`birth_year` int,
	`menarche_year` int,
	`reported_typical_cycle_length` int,
	`reported_typical_period_days` int,
	`reported_regularity` enum('consistent','variable','unknown'),
	`state_pregnant` boolean NOT NULL,
	`state_delivery_date` char(10),
	`state_breastfeeding` boolean NOT NULL,
	`state_hormonal_method_kind` enum('combined_pill','progestin_only_pill','patch','ring','hormonal_iud','implant','injection'),
	`state_hormonal_method_started_on` char(10),
	`state_copper_iud_inserted_on` char(10),
	`state_stopped_hormonal_on` char(10),
	`state_perimenopause_self_declared` boolean NOT NULL,
	`state_menopause_self_declared` boolean NOT NULL,
	`state_known_irregular` boolean NOT NULL,
	`state_prefer_not_to_say` boolean NOT NULL,
	`settings_fertility_enabled` boolean NOT NULL DEFAULT false,
	`settings_tier_c_symptoms_enabled` boolean NOT NULL DEFAULT false,
	`settings_health_awareness_enabled` boolean NOT NULL DEFAULT true,
	`settings_locale` enum('en-US','en-GB') NOT NULL DEFAULT 'en-US',
	`notif_period_reminder` boolean NOT NULL DEFAULT false,
	`notif_fertile_reminder` boolean NOT NULL DEFAULT false,
	`notif_symptom_reminder` boolean NOT NULL DEFAULT false,
	`notif_medication_reminder` boolean NOT NULL DEFAULT false,
	`notif_logging_reminder` boolean NOT NULL DEFAULT false,
	`notif_health_awareness` boolean NOT NULL DEFAULT false,
	`notif_private_wording` boolean NOT NULL DEFAULT true,
	CONSTRAINT `profile_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skip_prompt_decisions` (
	`gap_start_date` char(10) NOT NULL,
	`confirmed` boolean NOT NULL,
	`inferred_start_date` char(10),
	`decided_on` char(10) NOT NULL,
	CONSTRAINT `skip_prompt_decisions_gap_start_date` PRIMARY KEY(`gap_start_date`)
);
--> statement-breakpoint
ALTER TABLE `day_log_moods` ADD CONSTRAINT `day_log_moods_date_day_logs_date_fk` FOREIGN KEY (`date`) REFERENCES `day_logs`(`date`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `day_log_pain_interference` ADD CONSTRAINT `day_log_pain_interference_date_day_logs_date_fk` FOREIGN KEY (`date`) REFERENCES `day_logs`(`date`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `day_log_pain_sites` ADD CONSTRAINT `day_log_pain_sites_date_day_logs_date_fk` FOREIGN KEY (`date`) REFERENCES `day_logs`(`date`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `day_log_symptoms` ADD CONSTRAINT `day_log_symptoms_date_day_logs_date_fk` FOREIGN KEY (`date`) REFERENCES `day_logs`(`date`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `predictions_issued_on_idx` ON `predictions` (`issued_on`);