DROP TABLE `prescriptions`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uploaded_by_patient_id` integer,
	`uploaded_by_worker_id` integer,
	`questionnaire_id` integer,
	`medical_record_id` integer,
	`chat_message_id` integer,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`content_type` text NOT NULL,
	`storage_url` text NOT NULL,
	`thumbnail_url` text,
	`attachment_type` text NOT NULL,
	`description` text,
	`metadata` text,
	`is_public` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	`uploaded_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`uploaded_by_patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`questionnaire_id`) REFERENCES `questionnaires`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medical_record_id`) REFERENCES `medical_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chat_message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_attachments`("id", "uploaded_by_patient_id", "uploaded_by_worker_id", "questionnaire_id", "medical_record_id", "chat_message_id", "file_name", "file_size", "content_type", "storage_url", "thumbnail_url", "attachment_type", "description", "metadata", "is_public", "expires_at", "uploaded_at", "created_at") SELECT "id", "uploaded_by_patient_id", "uploaded_by_worker_id", "questionnaire_id", "medical_record_id", "chat_message_id", "file_name", "file_size", "content_type", "storage_url", "thumbnail_url", "attachment_type", "description", "metadata", "is_public", "expires_at", "uploaded_at", "created_at" FROM `attachments`;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `__new_attachments` RENAME TO `attachments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;