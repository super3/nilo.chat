-- One-time backfill: spread any pre-existing seed messages across multiple days
-- so the date separators (Today / Yesterday / older dates) are visible in the UI.
--
-- Earlier deploys seeded every message with the same (current) timestamp, so
-- everything collapsed under a single "Today" divider. This migration re-dates
-- the existing seed rows.
--
-- IMPORTANT: this migration must NOT insert seed messages. migrate.js re-runs
-- every .sql file on every deploy, so an INSERT here re-populated demo content
-- into the production database on each deploy (and re-created any seed rows an
-- admin had deleted). Seeding now lives solely in seedDatabase() in
-- src/server/index.js, which only runs for empty PR preview databases.
--
-- This UPDATE is idempotent and safe to re-run: it only re-dates rows that
-- exactly match a known seed message and never touches real user messages. In
-- production (which should hold no seed rows) it is a harmless no-op.

-- Re-date any existing seed messages.
WITH seed(days_ago, username, message, channel) AS (
  VALUES
    (3, 'nilo-bot', 'Welcome to nilo.chat! Say hi — no account needed.', 'welcome'),
    (3, 'alice', 'Hey everyone! Excited to be here.', 'welcome'),
    (1, 'bob', 'Hi! This chat app is looking great.', 'welcome'),
    (0, 'dana', 'Just joined — loving the vibe already.', 'welcome'),
    (4, 'nilo-bot', 'This is the general channel for announcements and updates.', 'general'),
    (2, 'alice', 'Anyone working on the new feature?', 'general'),
    (2, 'charlie', 'Yes! The @username autocomplete is live — try typing @ in the message box.', 'general'),
    (1, 'bob', 'Nice work. Date separators just landed too.', 'general'),
    (0, 'dana', 'Morning all — what is on the roadmap this week?', 'general'),
    (5, 'nilo-bot', 'Track outreach, experiments, and new user activity here.', 'growth'),
    (2, 'bob', 'We had 15 new signups this week!', 'growth'),
    (1, 'alice', 'The Reddit outreach experiment is paying off.', 'growth'),
    (0, 'charlie', 'Another 6 signups overnight 🎉', 'growth'),
    (4, 'nilo-bot', 'Share bugs, ideas, and feature requests in this channel.', 'feedback'),
    (2, 'charlie', 'Love the new mention feature. Try typing @alice or @bob!', 'feedback'),
    (1, 'dana', 'Could we get a dark mode at some point?', 'feedback'),
    (0, 'alice', 'Date dividers make catching up so much easier.', 'feedback')
)
UPDATE messages m
SET timestamp = NOW() - make_interval(days => s.days_ago)
FROM seed s
WHERE m.channel = s.channel
  AND m.username = s.username
  AND m.message = s.message;
