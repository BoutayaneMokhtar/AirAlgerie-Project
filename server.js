app.get('/api/employees', (req, res) => {
    const query = `
        SELECT u.*, d.nom as direction 
        FROM users u 
        LEFT JOIN directions d ON u.directionid = d.id 
        WHERE u.role = 'employee'
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching employees:', err);
            res.status(500).json({ error: 'Error fetching employees' });
            return;
        }
        res.json(results);
    });
}); 