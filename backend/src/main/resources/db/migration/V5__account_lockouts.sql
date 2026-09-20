-- Active login lockouts, so a restart doesn't hand a brute-forcer a fresh 5 attempts.
CREATE TABLE IF NOT EXISTS account_lockouts (
    username varchar(255) PRIMARY KEY,
    locked_until timestamp(6) with time zone NOT NULL
);
