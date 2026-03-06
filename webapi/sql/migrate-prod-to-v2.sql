-- Migration: copy data from old prod schema to v2.0 schema.
-- Prerequisites:
--   1. Create the v2.0 schema on the target database (run schema.sql on the target DB).
--   2. Replace dixbot and dixbotv2 in this file with your source and target database names
--      (e.g. dixbot_prod and dixbot_v2), then run.
--   3. MySQL user must have access to both databases (e.g. same server).
--
-- Replace placeholders before running, e.g.:
--   sed -e 's/dixbot/dixbot_prod/g' -e 's/dixbotv2/dixbot_v2/g' migrate-prod-to-v2.sql | mysql -u root -p
-- Or edit dixbot/dixbotv2 in this file and run: mysql -u root -p < migrate-prod-to-v2.sql

-- === 1. Direct table copies (same structure) ===

INSERT INTO dixbotv2.configurations (config, value)
  SELECT config, value FROM dixbot.configurations;

INSERT INTO dixbotv2.eight_ball_responses (response_string, sentiment, frequency)
  SELECT response_string, sentiment, frequency FROM dixbot.eight_ball_responses;

INSERT INTO dixbotv2.plusplus_tracking (type, `string`, voter, `timestamp`, value)
  SELECT type, `string`, voter, `timestamp`, value FROM dixbot.plusplus_tracking;

INSERT INTO dixbotv2.emoji_frequency (emoid, emoji, frequency, animated, type)
  SELECT emoid, emoji, COALESCE(frequency, 0), COALESCE(animated, 0), type
  FROM dixbot.emoji_frequency;

INSERT INTO dixbotv2.pin_history (msgid, `timestamp`)
  SELECT msgid, `timestamp` FROM dixbot.pin_history;

INSERT INTO dixbotv2.user_emoji_tracking (userid, emoid, frequency)
  SELECT userid, emoid, frequency FROM dixbot.user_emoji_tracking;

-- user_repost_tracking: old schema may not have msgcontents; new has it (nullable)
INSERT INTO dixbotv2.user_repost_tracking (userid, msgid, accuser, `timestamp`, msgcontents)
  SELECT u.userid, u.msgid, u.accuser, u.`timestamp`, NULL
  FROM dixbot.user_repost_tracking u;

-- === 2. take_a_look → triggers / responses / trigger_response (Option B) ===
-- Each old trigger phrase becomes a trigger; all old links become responses; each trigger gets every response.

INSERT INTO dixbotv2.responses (response_string, frequency)
  SELECT link, COALESCE(frequency, 0) FROM dixbot.take_a_look_responses;

INSERT INTO dixbotv2.triggers (trigger_string, selection_mode, frequency)
  SELECT DISTINCT `trigger`, 'random', 0
  FROM dixbot.take_a_look_triggers
  WHERE `trigger` IS NOT NULL AND TRIM(`trigger`) != '';

-- Junction: every migrated trigger linked to every migrated response
INSERT INTO dixbotv2.trigger_response (trigger_id, response_id, frequency)
  SELECT t.id, r.id, 0
  FROM dixbotv2.triggers t
  CROSS JOIN dixbotv2.responses r;
