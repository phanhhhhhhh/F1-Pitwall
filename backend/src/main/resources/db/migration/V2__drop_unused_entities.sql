-- ─────────────────────────────────────────────────────────────────────────────
-- Drop the model-only entities that were never wired to a feature:
--   car_setups, driver_contracts, sponsorships, engineers, championships
--
-- strategy_plans.engineer_id is dropped too — StrategyPlanService never set it
-- and the /strategy simulator has no concept of an owning engineer.
--
-- IF EXISTS guards keep this safe on a fresh DB (V1__baseline.sql created these
-- tables from the old pg_dump) and on an already-migrated deployment alike.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS strategy_plans DROP CONSTRAINT IF EXISTS fkbal1dr1ab2vrcocojjddyibk4;
ALTER TABLE IF EXISTS strategy_plans DROP COLUMN IF EXISTS engineer_id;

DROP TABLE IF EXISTS car_setups;
DROP TABLE IF EXISTS driver_contracts;
DROP TABLE IF EXISTS sponsorships;
DROP TABLE IF EXISTS engineers;
DROP TABLE IF EXISTS championships;
