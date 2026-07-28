-- Add deep Tourfic metadata to imported experiences without rewriting editorial content.
ALTER TABLE `experiences`
  ADD COLUMN `featured_text` TEXT NULL,
  ADD COLUMN `video_url` TEXT NULL,
  ADD COLUMN `duration_value` INTEGER NULL,
  ADD COLUMN `duration_unit` VARCHAR(40) NULL,
  ADD COLUMN `languages_json` JSON NULL,
  ADD COLUMN `location_address` TEXT NULL,
  ADD COLUMN `latitude` DECIMAL(10,7) NULL,
  ADD COLUMN `longitude` DECIMAL(10,7) NULL,
  ADD COLUMN `map_zoom` INTEGER NULL,
  ADD COLUMN `gallery_media_source_ids` JSON NULL,
  ADD COLUMN `pricing_mode` ENUM('FIXED', 'ON_REQUEST') NOT NULL DEFAULT 'ON_REQUEST',
  ADD COLUMN `pricing_json` JSON NULL,
  ADD COLUMN `booking_json` JSON NULL,
  ADD COLUMN `availability_json` JSON NULL,
  ADD COLUMN `contact_json` JSON NULL,
  ADD COLUMN `included_items_json` JSON NULL,
  ADD COLUMN `excluded_items_json` JSON NULL,
  ADD COLUMN `itinerary_json` JSON NULL,
  ADD COLUMN `faqs_json` JSON NULL,
  ADD COLUMN `display_json` JSON NULL,
  ADD COLUMN `editorial_flags_json` JSON NULL;

CREATE INDEX `idx_experiences_pricing_mode` ON `experiences`(`pricing_mode`);
