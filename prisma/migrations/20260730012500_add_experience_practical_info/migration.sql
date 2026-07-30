-- Add structured practical travel information without inventing editorial content.
ALTER TABLE `experiences`
  ADD COLUMN `practical_info_json` JSON NULL;
