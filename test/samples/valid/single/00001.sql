CREATE TABLE dlqTopics (
  id              INT64 NOT NULL,
  projectId       STRING(256),
  sourceTopicId   STRING(256),
) PRIMARY KEY (id);

CREATE TABLE dlqMessages (
  id              INT64 NOT NULL,
  messageId       INT64 NOT NULL,
  dlqTopicId      STRING(256),
  body            STRING(128),
  attributes      JSON,
) PRIMARY KEY (id);
