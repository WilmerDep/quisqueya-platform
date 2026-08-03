-- Add only the destination fields required by the current public single phase.
ALTER TABLE `destinations`
  ADD COLUMN `excerpt` TEXT NULL,
  ADD COLUMN `featured_text` TEXT NULL,
  ADD COLUMN `gallery_media_source_ids` JSON NULL,
  ADD COLUMN `content_sections_json` JSON NULL,
  ADD COLUMN `location_json` JSON NULL,
  ADD COLUMN `display_json` JSON NULL,
  ADD COLUMN `editorial_flags_json` JSON NULL,
  ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0;

DROP INDEX `idx_destinations_status` ON `destinations`;
CREATE INDEX `idx_destinations_status_order` ON `destinations`(`status`, `sort_order`);
