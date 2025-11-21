CREATE TABLE data (
  id STRING(36) NOT NULL,
) PRIMARY KEY (id);

ALTER TABLE data ADD COLUMN deduplication_key STRING(MAX);

CREATE UNIQUE NULL_FILTERED INDEX unique_active_task
ON data (id, deduplication_key);


