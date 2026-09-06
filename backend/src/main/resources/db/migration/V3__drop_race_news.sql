-- ─────────────────────────────────────────────────────────────────────────────
-- Remove the News feature. The /news pages, RaceNewsController/Service, the
-- auto-generated race reports and the curated driver-news seeder are all gone —
-- it was a news-site feature, not a pit wall one, and overlapped Results and
-- Standings.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS race_news;
