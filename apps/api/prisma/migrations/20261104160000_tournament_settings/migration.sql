-- Le jeu se choisit après la création rapide d'un tournoi : il devient facultatif pour un brouillon.
ALTER TABLE "tournaments" ALTER COLUMN "game_id" DROP NOT NULL;

-- Réglages propres au jeu (région, cartes, type de sélection…).
ALTER TABLE "tournaments" ADD COLUMN "game_settings" JSONB NOT NULL DEFAULT '{}';
