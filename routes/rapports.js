const express = require('express');
const router = express.Router();
const pool = require('../db');

// Test route to verify request handling
router.post('/test', (req, res) => {
    console.log('=== TEST REQUEST ===');
    console.log('Headers:', req.headers);
    console.log('Raw body:', req.body);
    console.log('Query params:', req.query);

    res.status(200).json({
        success: true,
        message: 'Test endpoint working',
        body: req.body,
        headers: req.headers,
        query: req.query
    });
});

// Create a new rapport
router.post('/', async (req, res) => {
    console.log('🔥 POST /api/rapports - Request received at', new Date().toISOString());
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Raw request body type:', typeof req.body);
    console.log('Raw request body:', req.body);
    
    // Log raw body for debugging
    let rawBody = '';
    req.on('data', chunk => {
        rawBody += chunk.toString();
    });
    
    req.on('end', () => {
        console.log('Raw request body (from stream):', rawBody);
    });
    
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            console.error('Empty request body received');
            return res.status(400).json({
                success: false,
                message: 'Le corps de la requête est vide',
                receivedHeaders: req.headers,
                receivedBody: req.body
            });
        }
        
        const { user_id, type, titre, contenu } = req.body;
        
        console.log('Parsed request data:', { 
            user_id: typeof user_id,
            type: typeof type,
            titre: typeof titre,
            contenu_type: typeof contenu,
            contenu_length: contenu ? contenu.length : 0,
            contenu_sample: contenu ? String(contenu).substring(0, 100) + '...' : 'empty' 
        });

        // Validate required fields
        if (!user_id || !type || !titre || !contenu) {
            const error = new Error('Tous les champs sont obligatoires');
            console.error('Validation error:', error.message, { 
                user_id, 
                type, 
                titre, 
                has_contenu: !!contenu,
                contenu_type: typeof contenu
            });
            return res.status(400).json({
                success: false,
                message: error.message,
                received: { 
                    user_id, 
                    type, 
                    titre, 
                    has_contenu: !!contenu,
                    contenu_type: typeof contenu
                }
            });
        }

        // Ensure user_id is integer
        const userId = parseInt(user_id, 10);
        if (isNaN(userId)) {
            const error = new Error('ID utilisateur invalide');
            console.error('Invalid user ID:', { user_id, parsed: userId });
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.log('Checking if user exists with ID:', userId);
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        console.log('User check result:', { rowCount: userCheck.rowCount });
        
        if (userCheck.rows.length === 0) {
            const error = new Error(`Aucun utilisateur trouvé avec l'ID: ${userId}`);
            console.error('User not found:', error.message);
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        const queryText = `
            INSERT INTO rapports (user_id, type, titre, contenu, statut, date_creation)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `;
        const queryValues = [userId, type, titre, contenu, 0];
        
        console.log('Executing query:', queryText);
        console.log('Query values:', queryValues);

        console.log('Executing database query...');
        const result = await pool.query(queryText, queryValues);
        console.log('✅ Query successful, rows affected:', result.rowCount);
        console.log('Inserted record:', result.rows[0]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        // Log detailed error information
        const errorInfo = {
            message: error.message,
            code: error.code,
            detail: error.detail,
            table: error.table,
            constraint: error.constraint,
            stack: error.stack,
            receivedData: req.body,
            timestamp: new Date().toISOString()
        };
        
        console.error('🔥 ERROR CREATING RAPPORT:', JSON.stringify(errorInfo, null, 2));

        // Check for specific database errors
        if (error.code === '42P01') { // Table does not exist
            const errorResponse = {
                success: false,
                message: 'Erreur: La table rapports n\'existe pas dans la base de données',
                error: process.env.NODE_ENV === 'development' ? {
                    code: error.code,
                    detail: error.message,
                    hint: 'Vérifiez que la table rapports existe et est correctement configurée.',
                    query: queryText,
                    values: queryValues
                } : undefined
            };
            console.error('Table does not exist error:', errorResponse);
            return res.status(500).json(errorResponse);
        }

        if (error.code === '23503') { // Foreign key violation
            const errorResponse = {
                success: false,
                message: 'Erreur: L\'utilisateur spécifié n\'existe pas',
                error: process.env.NODE_ENV === 'development' ? {
                    code: error.code,
                    detail: error.detail,
                    hint: `L'utilisateur avec l'ID ${user_id} n'existe pas dans la table users.`,
                    query: queryText,
                    values: queryValues
                } : undefined
            };
            console.error('Foreign key violation:', errorResponse);
            return res.status(400).json(errorResponse);
        }

        if (error.code === '23505') { // Unique violation
            const errorResponse = {
                success: false,
                message: 'Erreur: Un rapport similaire existe déjà',
                error: process.env.NODE_ENV === 'development' ? {
                    code: error.code,
                    detail: error.detail,
                    hint: 'Vérifiez les contraintes uniques sur la table rapports.',
                    query: queryText,
                    values: queryValues
                } : undefined
            };
            console.error('Unique constraint violation:', errorResponse);
            return res.status(409).json(errorResponse);
        }

        // Generic error response
        const errorResponse = {
            success: false,
            message: 'Une erreur est survenue lors du traitement de votre demande',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                code: error.code,
                detail: error.detail,
                hint: 'Une erreur inattendue est survenue lors du traitement de la requête.',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                query: queryText,
                values: queryValues
            } : undefined
        };
        
        console.error('Unexpected error:', JSON.stringify(errorResponse, null, 2));
        res.status(500).json(errorResponse);
    }
});


// Delete a rapport
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // First check if the rapport exists
        const checkRapport = await pool.query('SELECT id FROM rapports WHERE id = $1', [id]);
        
        if (checkRapport.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rapport non trouvé'
            });
        }

        // Delete the rapport
        await pool.query('DELETE FROM rapports WHERE id = $1', [id]);
        
        res.status(200).json({
            success: true,
            message: 'Rapport supprimé avec succès'
        });
        
    } catch (error) {
        console.error('Error deleting rapport:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du rapport',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Mark a single notification as read
router.post('/:id/mark-read', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Update the notification as read in the database
        const result = await pool.query(
            'UPDATE rapports SET lu = true WHERE id = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rapport non trouvé'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage du rapport comme lu',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
    try {
        // Mark all unread notifications as read
        const result = await pool.query(
            'UPDATE rapports SET lu = true WHERE lu = false RETURNING *'
        );
        
        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
        
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage de tous les rapports comme lus',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
