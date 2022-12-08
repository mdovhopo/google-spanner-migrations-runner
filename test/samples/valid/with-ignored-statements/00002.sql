alter table test add row deletion policy (older_than(createdAt, interval 30 day));
