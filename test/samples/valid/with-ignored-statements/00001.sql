CREATE TABLE test (
  id              INT64 NOT NULL,
  createdAt       TIMESTAMP NOT NULL,
) PRIMARY KEY (id);

alter table test add row deletion policy (older_than(createdAt, interval 30 day));
