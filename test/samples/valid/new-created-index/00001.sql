CREATE TABLE tasks (
  id STRING(36) NOT NULL,
  tenant_id STRING(36) NOT NULL,
  task_type STRING(255) NOT NULL,
  status STRING(50) NOT NULL,
  created_at TIMESTAMP NOT NULL,
) PRIMARY KEY (id);

ALTER TABLE tasks ADD COLUMN deduplication_key STRING(MAX);

CREATE UNIQUE NULL_FILTERED INDEX unique_active_task
ON tasks (tenant_id, task_type, deduplication_key);


