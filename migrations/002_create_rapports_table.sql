-- Create rapports table if it doesn't exist
CREATE TABLE IF NOT EXISTS rapports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    titre VARCHAR(255) NOT NULL,
    contenu TEXT NOT NULL,
    statut INTEGER DEFAULT 0,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_rapports_user_id ON rapports(user_id);

-- Add index on date_creation for sorting
CREATE INDEX IF NOT EXISTS idx_rapports_date_creation ON rapports(date_creation);
