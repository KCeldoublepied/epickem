-- Les jeux du catalogue (GAME_CATALOG) existent sur toute base migrée : en Docker, le seed ne tourne pas.
INSERT INTO "games" ("id", "name", "slug", "updated_at") VALUES
  (gen_random_uuid(), 'League of Legends', 'league-of-legends', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Counter-Strike 2', 'counter-strike-2', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Super Smash Bros. Ultimate', 'super-smash-bros-ultimate', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Rocket League', 'rocket-league', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Fortnite', 'fortnite', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
