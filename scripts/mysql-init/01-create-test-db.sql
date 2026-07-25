-- Runs once, as root, on first initialization of the MySQL data volume
-- (docker-entrypoint-initdb.d). Creates a SEPARATE database for the destructive
-- integration tests (lib/repo/__integration__/*.itest.ts truncate every table between
-- tests) so `pnpm test:integration` can never touch the app's own `period_tracker`
-- data. See docs/DB-MIGRATION.md §4 and lib/repo/testUtils.ts's destructive guard.
CREATE DATABASE IF NOT EXISTS period_tracker_test;
GRANT ALL PRIVILEGES ON period_tracker_test.* TO 'app'@'%';
FLUSH PRIVILEGES;
