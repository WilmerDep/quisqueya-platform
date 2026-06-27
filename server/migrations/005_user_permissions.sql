ALTER TABLE users
  ADD COLUMN permissions_json JSON NULL AFTER phone;
