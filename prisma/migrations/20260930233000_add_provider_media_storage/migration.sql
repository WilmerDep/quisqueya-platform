ALTER TABLE `media_assets`
  ADD COLUMN `storage_provider` VARCHAR(80) NOT NULL DEFAULT 'external' AFTER `source_url`,
  ADD COLUMN `storage_metadata_json` JSON NULL AFTER `checksum`;

ALTER TABLE `media_assets`
  DROP INDEX `media_assets_storage_key_key`,
  ADD UNIQUE INDEX `uniq_media_storage_provider_key`(`storage_provider`, `storage_key`),
  ADD INDEX `idx_media_storage_provider`(`storage_provider`);

ALTER TABLE `destinations`
  ADD COLUMN `gallery_media_ids` JSON NULL AFTER `featured_media_id`;

ALTER TABLE `experiences`
  ADD COLUMN `gallery_media_ids` JSON NULL AFTER `featured_media_id`;
