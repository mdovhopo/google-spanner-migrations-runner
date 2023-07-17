CREATE TABLE test (
  id              INT64 NOT NULL,
  name            STRING(256),
  last_name       STRING(256),
) PRIMARY KEY (id);

CREATE TABLE test_2 (
  id              INT64 NOT NULL,
  name            INT64 NOT NULL,
  last_name       STRING(256),
  first_name      STRING(128),
  metadata        JSON,
) PRIMARY KEY (id);
