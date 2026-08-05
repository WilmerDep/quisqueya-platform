-- Support public snapshot freshness queries that order by updated_at.
CREATE INDEX `idx_media_updated_at` ON `media_assets`(`updated_at`);
CREATE INDEX `idx_destinations_updated_at` ON `destinations`(`updated_at`);
CREATE INDEX `idx_experiences_updated_at` ON `experiences`(`updated_at`);
CREATE INDEX `idx_content_pages_updated_at` ON `content_pages`(`updated_at`);
