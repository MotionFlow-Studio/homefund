CREATE TABLE `expenses` (
	`id` varchar(36) NOT NULL,
	`household_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`category` enum('groceries','household','eating_out','transport','kids','health','clothing','fun','bills','other') NOT NULL,
	`spent_on` date NOT NULL,
	`merchant` varchar(120),
	`note` varchar(280),
	`source` enum('manual','receipt','voice') NOT NULL DEFAULT 'manual',
	`created_by_user_id` varchar(36),
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`deleted_at` timestamp(3),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixed_costs` (
	`id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`name` varchar(60) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`deleted_at` timestamp(3),
	CONSTRAINT `fixed_costs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`currency` char(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`deleted_at` timestamp(3),
	CONSTRAINT `households_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` varchar(36) NOT NULL,
	`household_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`name` varchar(60) NOT NULL,
	`role` enum('owner','adult','child') NOT NULL,
	`color` varchar(7) NOT NULL,
	`birth_year` int,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`deleted_at` timestamp(3),
	CONSTRAINT `members_id` PRIMARY KEY(`id`),
	CONSTRAINT `members_household_user_unique` UNIQUE(`household_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `pay_settings` (
	`member_id` varchar(36) NOT NULL,
	`payday_day` tinyint unsigned NOT NULL,
	`income_minor` bigint NOT NULL,
	`savings_goal_minor` bigint NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `pay_settings_member_id` PRIMARY KEY(`member_id`)
);
--> statement-breakpoint
CREATE TABLE `receipt_items` (
	`id` varchar(36) NOT NULL,
	`expense_id` varchar(36) NOT NULL,
	`position` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`quantity_milli` int NOT NULL DEFAULT 1000,
	`unit_price` decimal(19,6),
	`line_total_minor` bigint NOT NULL,
	`category` enum('groceries','household','eating_out','transport','kids','health','clothing','fun','bills','other') NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`deleted_at` timestamp(3),
	CONSTRAINT `receipt_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_household_id_households_id_fk` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_member_id_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fixed_costs` ADD CONSTRAINT `fixed_costs_member_id_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `members` ADD CONSTRAINT `members_household_id_households_id_fk` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `members` ADD CONSTRAINT `members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pay_settings` ADD CONSTRAINT `pay_settings_member_id_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_items` ADD CONSTRAINT `receipt_items_expense_id_expenses_id_fk` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `expenses_household_spent_idx` ON `expenses` (`household_id`,`spent_on`);--> statement-breakpoint
CREATE INDEX `expenses_member_spent_idx` ON `expenses` (`member_id`,`spent_on`);--> statement-breakpoint
CREATE INDEX `expenses_household_updated_idx` ON `expenses` (`household_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `fixed_costs_member_idx` ON `fixed_costs` (`member_id`);--> statement-breakpoint
CREATE INDEX `members_household_idx` ON `members` (`household_id`);--> statement-breakpoint
CREATE INDEX `receipt_items_expense_idx` ON `receipt_items` (`expense_id`);