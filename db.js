const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',      
    host: 'localhost',            
    database: 'AirAlgerie',    
    password: '0000', 
    port: 5432,                   
});

// Vérifier la connexion
pool.connect()
    .then(() => console.log('✅ Connecté à PostgreSQL'))
    .catch(err => console.error('❌ Erreur de connexion à PostgreSQL:', err));

// Create rapports table with proper structure
pool.query(`
  CREATE TABLE IF NOT EXISTS rapports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(100) NOT NULL,
    titre VARCHAR(255) NOT NULL,
    contenu TEXT NOT NULL,
    statut INTEGER DEFAULT 0,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) {
    console.error('Error creating rapports table:', err);
  } else {
    console.log('Rapports table created or already exists');
  }
});

module.exports = pool; 
