const express = require('express');
const path = require('path');
const pool = require('./db');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const WebSocket = require('ws');
const rapportsRouter = require('./routes/rapports');

// Create Express app
const app = express();
const PORT = 3001;

// Create WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parse JSON bodies (must be before any route that needs to read the body)
app.use(express.json());

// Parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    
    ws.on('message', (message) => {
        console.log('Received:', message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Mount the rapports router after body parsers
app.use('/api/rapports', rapportsRouter);

// Temporary endpoint for logging report data
app.post('/api/reports', (req, res) => {
  console.log('\n=== Report Details ===');
  console.log('Title:', req.body.title);
  console.log('Type:', req.body.type);
  console.log('Start Date:', req.body.startDate);
  console.log('End Date:', req.body.endDate);
  console.log('Description:', req.body.description);
  console.log('======================');
  
  res.json({ success: true });
});


// Configurer les sessions
app.use(session({
    secret: 'mon_secret', // Change ça pour plus de sécurité
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // true si HTTPS
    name: 'sessionId' // Add a specific name for the session cookie
}));

// Add session debugging middleware
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    next();
});

// Routes
app.get('/', (req, res) => {
    res.render('congeCard');
});
app.get('/hr-portal', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('auth');
        }

        const userId = req.session.user.id;

        const conge = `
            SELECT 
                nature,
                COUNT(*) AS total
            FROM conges
            GROUP BY nature
            ORDER BY total DESC;
        `;
        const congeinfo = await pool.query(conge);
        const totalecongeinfo = congeinfo.rows;

        const nature = `
            SELECT 
                dp.nom AS departement_nom,
                c.nature,
                COUNT(*) AS total
            FROM conges c
            JOIN departements dp ON c.departement_id = dp.id
            GROUP BY dp.nom, c.nature
            ORDER BY dp.nom, total DESC;
        `;
        const natureinfo = await pool.query(nature);
        const totalenatureinfo = natureinfo.rows;

        const Qemployees = `
            SELECT 
                u.id, 
                u.matricule,
                u.nomcomplet, 
                c.conje AS conge, 
                f.nom AS fonction,
                d.nom AS direction,
                d.id AS direction_id,
                sd.nom AS sous_direction
            FROM users u
            LEFT JOIN fonctions f ON u.fonction_id = f.id
            LEFT JOIN departements dep ON u.departement_id = dep.id
            LEFT JOIN sous_direction sd ON dep.sous_direction_id = sd.id
            LEFT JOIN direction d ON sd.direction_id = d.id
            LEFT JOIN conges c ON u.id = c.user_id;
        `;
        const employeesinfo = await pool.query(Qemployees);
        const allemployeesinfo = employeesinfo.rows;

        const allsousdirectionsinfo = await pool.query(`SELECT * FROM sous_direction;`);
        const allsousdirectionsinfovar = allsousdirectionsinfo.rows;

        const allfonctioninfo = await pool.query(`SELECT * FROM fonctions;`);
        const allfonctioninfovar = allfonctioninfo.rows;

        const alldirectionsinfo = await pool.query(`SELECT * FROM direction;`);
        const alldirectionsinfovar = alldirectionsinfo.rows;

        const alldepartementinfo = await pool.query(`SELECT * FROM departements;`);
        const alldepartementsinfovar = alldepartementinfo.rows;

        const getAcceptanceStats = `
            SELECT 
                COUNT(*) AS total_requests,
                COUNT(CASE WHEN d.etat = 1 THEN 1 END) AS accepted_requests,
                COUNT(CASE WHEN d.etat = 2 THEN 1 END) AS rejected_requests,
                COALESCE(
                    ROUND(
                        (COUNT(CASE WHEN d.etat = 1 THEN 1 END) * 100.0) / NULLIF(COUNT(*), 0),
                        2
                    ), 0
                ) AS taux_acceptation,
                COALESCE(
                    ROUND(
                        (COUNT(CASE WHEN d.etat = 2 THEN 1 END) * 100.0) / NULLIF(COUNT(*), 0),
                        2
                    ), 0
                ) AS taux_refus
            FROM demandes d
            WHERE d.etat IN (1, 2);
        `;
        const resultAcceptanceStats = await pool.query(getAcceptanceStats);
        const acceptancetaux = resultAcceptanceStats.rows;

        const query = `
            SELECT 
                c.user_id, 
                u.nomcomplet,
                u.matricule, 
                c.jours_dispo,
                u.id AS user_id
            FROM 
                conges c
            JOIN 
                users u ON c.user_id = u.id
            WHERE 
                c.jours_dispo > 90
            ORDER BY 
                c.jours_dispo DESC
            LIMIT 5;
        `;
        const result = await pool.query(query);
        const top5Employees = result.rows;

        const personnesEnCongeCountQuery = `
            WITH monthly_data AS (
                SELECT 
                    DATE_TRUNC('month', date_debut) AS month_start,
                    TO_CHAR(DATE_TRUNC('month', date_debut), 'YYYY-MM') AS key,
                    TO_CHAR(DATE_TRUNC('month', date_debut), 'TMMonth YYYY') AS mois
                FROM demandes
                GROUP BY month_start, key, mois
            )
            SELECT 
                m.key,
                m.mois,
                COUNT(DISTINCT c.user_id) FILTER (WHERE c.conje = 1) AS total_en_conge,
                (SELECT COUNT(*) FROM users) AS total_users,
                ROUND(
                    100.0 - (
                        COUNT(DISTINCT c.user_id) FILTER (WHERE c.conje = 1)::float / 
                        (SELECT COUNT(*) FROM users) * 100
                    )::numeric, 2
                ) AS taux_presence,
                (
                    SELECT COUNT(*) 
                    FROM demandes d
                    WHERE d.etat = 0 
                    AND TO_CHAR(d.date_debut, 'YYYY-MM') = m.key
                ) AS demandes_en_attente
            FROM monthly_data m
            JOIN demandes c ON DATE_TRUNC('month', c.date_debut) = m.month_start
            GROUP BY m.key, m.mois
            ORDER BY m.key DESC;
        `;
        const personnesEnCongeResult = await pool.query(personnesEnCongeCountQuery);
        const monthlyStats = personnesEnCongeResult.rows;

        const demandesQuery = `
            SELECT d.*, 
                TO_CHAR(d.date_dmd, 'DD/MM/YYYY HH24:MI') AS date_dmd,
                TO_CHAR(d.date_debut, 'DD/MM/YYYY') AS date_debut,
                TO_CHAR(d.date_fin, 'DD/MM/YYYY') AS date_fin,
                u1.nomcomplet AS requester_name,
                u2.nomcomplet AS approver_name
            FROM demandes d
            JOIN users u1 ON d.user_id = u1.id
            LEFT JOIN users u2 ON d.approved_by = u2.id
            WHERE d.user_id = $1
            ORDER BY d.date_dmd DESC;
        `;
        const demandesResult = await pool.query(demandesQuery, [userId]);

        const unreadRapportsQuery = `
            SELECT 
                r.id,
                r.titre,
                r.type,
                r.contenu,
                r.lu,
                TO_CHAR(r.date_creation, 'DD/MM/YYYY HH24:MI') AS date_creation,
                u.nomcomplet AS author_name
            FROM rapports r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.date_creation DESC
            LIMIT 5;
        `;
        const rapportsResult = await pool.query(unreadRapportsQuery);
        const unreadRapportsCount = rapportsResult.rows.filter(r => !r.lu).length;

        const departResult = await pool.query(`
            SELECT departements.nom AS departement_nom
            FROM users
            JOIN departements ON users.departement_id = departements.id
            WHERE users.id = $1
        `, [userId]);

        const depart = departResult.rows[0];
        if (!depart) return res.status(404).send('Department not found');

        const departementId = req.session.user.departement_id;
        const resultM = await pool.query(`
            SELECT nomcomplet
            FROM users
            WHERE departement_id = $1 AND groupeid = 1
        `, [departementId]);

        const fonctionId = req.session.user.fonction_id;
        const resultF = await pool.query(`
            SELECT nom 
            FROM fonctions 
            WHERE id = $1
        `, [fonctionId]);
        const fonction = resultF.rows[0];

        const nomComplet = req.session.user.nomcomplet;
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nomComplet)}`;

        const workforceEvolutionResult = await pool.query(`
            SELECT TO_CHAR(date_trunc('month', date_entree), 'YYYY-MM') AS month, COUNT(*) AS count
            FROM users
            WHERE date_entree <= NOW()
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        `);
        const workforceEvolutionData = workforceEvolutionResult.rows.reverse();

        const departmentDistributionResult = await pool.query(`
            SELECT d.nom AS department, COUNT(u.id) AS count
            FROM departements d
            LEFT JOIN users u ON u.departement_id = d.id
            GROUP BY d.nom
            ORDER BY d.nom
        `);
        const departmentDistributionData = departmentDistributionResult.rows;

        const turnoverResult = await pool.query(`
            WITH months AS (
                SELECT to_char(date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs), 'YYYY-MM') AS month
                FROM generate_series(0, 11) AS gs
            ),
            hires AS (
                SELECT TO_CHAR(date_trunc('month', date_entree), 'YYYY-MM') AS month, COUNT(*) AS hired
                FROM users
                WHERE date_entree <= NOW()
                GROUP BY month
            ),
            leavers AS (
                SELECT TO_CHAR(date_trunc('month', date_sortie), 'YYYY-MM') AS month, COUNT(*) AS left
                FROM users
                WHERE date_sortie IS NOT NULL AND date_sortie <= NOW()
                GROUP BY month
            ),
            avg_staff AS (
                SELECT m.month,
                    COALESCE((SELECT COUNT(*) FROM users WHERE (date_entree <= (m.month || '-28')::date) AND (date_sortie IS NULL OR date_sortie > (m.month || '-01')::date)), 0) AS staff
                FROM months m
            )
            SELECT m.month,
                COALESCE(l.left, 0) AS left,
                COALESCE(a.staff, 1) AS avg_staff,
                ROUND(COALESCE(l.left, 0)::decimal / NULLIF(COALESCE(a.staff, 1),0) * 100, 2) AS turnover_rate
            FROM months m
            LEFT JOIN leavers l ON m.month = l.month
            LEFT JOIN avg_staff a ON m.month = a.month
            ORDER BY m.month;
        `);
        const turnoverData = turnoverResult.rows;

        const rapportsResults = await pool.query(`
            SELECT id, titre, type, date_creation, contenu, status, user_id
            FROM rapports
            ORDER BY date_creation DESC;
        `);
        const rapports = rapportsResults.rows;

        const leaveRequestsResult = await pool.query(`
            SELECT 
                d.*,
                u.nomcomplet AS employee_name,
                TO_CHAR(d.date_dmd, 'DD/MM/YYYY HH24:MI') AS date_dmd_formatted,
                TO_CHAR(d.date_debut, 'DD/MM/YYYY') AS date_debut_formatted,
                TO_CHAR(d.date_fin, 'DD/MM/YYYY') AS date_fin_formatted,
                u.departement_id
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            WHERE u.groupeid = 3 AND d.etat = 0
            ORDER BY d.date_dmd DESC
            LIMIT 10;
        `);

        res.render('hr-portal', {
            avatarUrl,
            rapports,
            fonction,
            resultM: resultM.rows,
            leaveRequests: leaveRequestsResult.rows,
            alldirectionsinfovar,
            allfonctioninfovar,
            depart,
            demandes: demandesResult.rows,
            user: req.session.user,
            workforceEvolutionData,
            monthlyStats,
            totalenatureinfo,
            top5Employees,
            acceptancetaux,
            allemployeesinfo,
            totalecongeinfo,
            alldepartementsinfovar,
            allsousdirectionsinfovar,
            departmentDistributionData,
            unreadRapportsCount,
            turnoverData
        });

    } catch (error) {
        console.error('Error in /hr-portal:', error);
        res.status(500).send('Erreur serveur');
    }
});


app.post('/notifications/mark-all-read', async (req, res) => {
    try {
        const userId = req.session.user.id;
        await pool.query(
            'UPDATE demandes SET lu = TRUE WHERE user_id = $1',
            [userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Erreur mark-all-read:', err);
        res.status(500).json({ success: false });
    }
});
app.get("/sous-director-portal", async (req, res) => {
    console.log('[DEBUG] /sous-director-portal route hit');
    // Debug: Log session user
    console.log('Session user:', req.session.user);
    
    if (!req.session.user) {
        return res.render('auth');
    }
    // Only allow users with groupeid = 2 (sous-director)
    if (req.session.user.groupeid !== 2) {
        return res.status(403).render('error', { message: "Accès refusé : réservé aux Sous-Directeurs." });
    }

    // Fetch sous-director info from users table
    let sousDirector = null;
    try {
        const sousDirectorResult = await pool.query(
            `SELECT u.*, d.nom AS departement_nom, sd.nom AS sous_direction_nom 
            FROM users u 
            LEFT JOIN departements d ON u.departement_id = d.id 
            LEFT JOIN sous_direction sd ON d.sous_direction_id = sd.id 
            WHERE u.id = $1`,
            [req.session.user.id]
        );
        if (sousDirectorResult.rows.length > 0) {
            sousDirector = sousDirectorResult.rows[0];
        }
    } catch (err) {
        console.error('Error fetching sous-director info:', err);
    }

    try {
        // Pagination & search
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 10;
        const offset = (page - 1) * itemsPerPage;
        const searchQuery = req.query.search || '';
        // Fetch the sous-director's direction_id
        let sousDirectorDirectionId = null;
        if (sousDirector && sousDirector.departement_id) {
            const directionQuery = `
                SELECT sd.direction_id
                FROM departements dep
                JOIN sous_direction sd ON dep.sous_direction_id = sd.id
                WHERE dep.id = $1
            `;
            const directionResult = await pool.query(directionQuery, [sousDirector.departement_id]);
            sousDirectorDirectionId = directionResult.rows[0]?.direction_id;
        }

        // Managers in the same direction
        let managers = [];
        let totalManagers = 0;
        let totalPages = 1;
        if (sousDirectorDirectionId) {
            // Get total count for pagination
            const countManagersQuery = `
                SELECT COUNT(*) as total
                FROM users u
                JOIN departements d ON u.departement_id = d.id
                JOIN sous_direction sd ON d.sous_direction_id = sd.id
                WHERE u.groupeid = 1 AND sd.direction_id = $1
            `;
            const countResult = await pool.query(countManagersQuery, [sousDirectorDirectionId]);
            totalManagers = parseInt(countResult.rows[0]?.total || 0);
            totalPages = Math.ceil(totalManagers / itemsPerPage) || 1;

            const managersQuery = `
                SELECT u.id, u.nomcomplet, u.email, f.nom as fonction_nom, d.nom as departement_nom
                FROM users u
                LEFT JOIN fonctions f ON u.fonction_id = f.id
                LEFT JOIN departements d ON u.departement_id = d.id
                JOIN sous_direction sd ON d.sous_direction_id = sd.id
                WHERE u.groupeid = 1 AND sd.direction_id = $1
                ORDER BY u.nomcomplet
                LIMIT $2 OFFSET $3
            `;
            const result = await pool.query(managersQuery, [sousDirectorDirectionId, itemsPerPage, offset]);
            managers = result.rows.map(mgr => ({
                id: mgr.id,
                name: mgr.nomcomplet,
                email: mgr.email || '',
                department: mgr.departement_nom || '',
                fonction: mgr.fonction_nom || '',
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(mgr.nomcomplet)}`
            }));
        }

        // Fetch leave requests for managers in this sous-director's direction
        let demandes = [];
        let pendingDemandes = [];
        if (sousDirectorDirectionId) {
            // All demandes for managers in this direction
            const allDemandesQuery = `
                SELECT 
                    d.*,
                    u.nomcomplet AS employee_name,
                    u.email AS employee_email,
                    f.nom as fonction_nom,
                    dep.nom as departement_nom,
                    TO_CHAR(d.date_dmd, 'DD/MM/YYYY HH24:MI') AS formatted_date_dmd,
                    TO_CHAR(d.date_debut, 'DD/MM/YYYY') AS formatted_date_debut,
                    TO_CHAR(d.date_fin, 'DD/MM/YYYY') AS formatted_date_fin,
                    CASE 
                        WHEN d.etat = 0 THEN 'En attente'
                        WHEN d.etat = 1 THEN 'Approuvé'
                        WHEN d.etat = 2 THEN 'Refusé'
                    END as status
                FROM demandes d
                JOIN users u ON d.user_id = u.id
                JOIN departements dep ON u.departement_id = dep.id
                JOIN sous_direction sd ON dep.sous_direction_id = sd.id
                JOIN fonctions f ON u.fonction_id = f.id
                WHERE u.groupeid = 1 
                AND sd.direction_id = $1
                ORDER BY d.date_dmd DESC
            `;
            const allDemandesResult = await pool.query(allDemandesQuery, [sousDirectorDirectionId]);
            demandes = allDemandesResult.rows;

            // Only pending demandes (etat = 0) from managers and employees
            const pendingDemandesQuery = `
                SELECT 
                    d.*,
                    u.nomcomplet AS employee_name,
                    u.email AS employee_email,
                    f.nom as fonction_nom,
                    dep.nom as departement_nom,
                    TO_CHAR(d.date_dmd, 'DD/MM/YYYY HH24:MI') AS formatted_date_dmd,
                    TO_CHAR(d.date_debut, 'DD/MM/YYYY') AS formatted_date_debut,
                    TO_CHAR(d.date_fin, 'DD/MM/YYYY') AS formatted_date_fin,
                    'En attente' as status
                FROM demandes d
                JOIN users u ON d.user_id = u.id
                JOIN departements dep ON u.departement_id = dep.id
                JOIN sous_direction sd ON dep.sous_direction_id = sd.id
                JOIN fonctions f ON u.fonction_id = f.id
                WHERE u.groupeid IN (0, 1)
                AND sd.direction_id = $1 
                AND d.etat = 0
                ORDER BY d.date_dmd DESC
            `;
            const pendingDemandesResult = await pool.query(pendingDemandesQuery, [sousDirectorDirectionId]);
            console.log('[DEBUG] pendingDemandesResult:', pendingDemandesResult.rows);
            pendingDemandes = pendingDemandesResult.rows;
        }
        // Fetch only the sous-director's own demandes for the historique section
        let sousDirectorDemandes = [];
        if (sousDirector && sousDirector.id) {
            const sousDirectorDemandesQuery = `
                SELECT d.*, u.nomcomplet AS employee_name, u.email AS employee_email
                FROM demandes d
                JOIN users u ON d.user_id = u.id
                WHERE d.user_id = $1
                ORDER BY d.date_dmd DESC
            `;
            const sousDirectorDemandesResult = await pool.query(sousDirectorDemandesQuery, [sousDirector.id]);
            sousDirectorDemandes = sousDirectorDemandesResult.rows;
        }
        // Get pending requests count for dashboard
        let pendingRequestsCount = 0;
        if (sousDirectorDirectionId) {
            const pendingRequestsCountQuery = `
                SELECT COUNT(*) as pending_count
                FROM demandes d
                JOIN users u ON d.user_id = u.id
                JOIN departements dep ON u.departement_id = dep.id
                JOIN sous_direction sd ON dep.sous_direction_id = sd.id
                WHERE u.groupeid = 1 AND sd.direction_id = $1 AND d.etat = 0
            `;
            const pendingRequestsCountResult = await pool.query(pendingRequestsCountQuery, [sousDirectorDirectionId]);
            pendingRequestsCount = pendingRequestsCountResult.rows[0]?.pending_count || 0;
        }
        // Get today's absences count for managers in this direction
        let absencesTodayCount = 0;
        if (sousDirectorDirectionId) {
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
            const absencesTodayQuery = `
                SELECT COUNT(*) as absences_count
                FROM demandes d
                JOIN users u ON d.user_id = u.id
                JOIN departements dep ON u.departement_id = dep.id
                JOIN sous_direction sd ON dep.sous_direction_id = sd.id
                WHERE u.groupeid = 1 AND sd.direction_id = $1
                AND d.etat = 1
                AND d.date_debut <= $2
                AND d.date_fin >= $3
            `;
            const absencesTodayResult = await pool.query(absencesTodayQuery, [sousDirectorDirectionId, todayStart, todayEnd]);
            absencesTodayCount = absencesTodayResult.rows[0]?.absences_count || 0;
        }
        // Get all departments for management section
        let departments = [];
        let allEmployees = [];
        if (sousDirector && sousDirector.departement_id) {
            // Get sous_direction_id for the current sous-director
            const sousDirQuery = `
                SELECT sd.id as sous_direction_id, sd.nom as sous_direction_nom
                FROM departements d
                JOIN sous_direction sd ON d.sous_direction_id = sd.id
                WHERE d.id = $1
            `;
            const sousDirResult = await pool.query(sousDirQuery, [sousDirector.departement_id]);
            
            if (sousDirResult.rows.length > 0) {
                const sousDirectionId = sousDirResult.rows[0].sous_direction_id;
                const sousDirectionName = sousDirResult.rows[0].sous_direction_nom;
                
                // Get departments only from this sous-direction
                const departmentsQuery = `
                    SELECT d.*, 
                           (SELECT COUNT(*) FROM users u WHERE u.departement_id = d.id) as employee_count,
                           (SELECT COUNT(*) FROM users u WHERE u.departement_id = d.id AND u.groupeid = 1) as manager_count
                    FROM departements d
                    WHERE d.sous_direction_id = $1
                    ORDER BY d.nom
                `;
                const departmentsResult = await pool.query(departmentsQuery, [sousDirectionId]);
                departments = departmentsResult.rows;

                // Get all employees and managers from this sous-direction
                const employeesQuery = `
                    SELECT 
                        u.*,
                        d.nom as departement_nom,
                        f.nom as fonction_nom,
                        CASE 
                            WHEN u.groupeid = 1 THEN 'Manager'
                            ELSE 'Employé'
                        END as role,
                        CASE 
                            WHEN EXISTS (
                                SELECT 1 FROM demandes d 
                                WHERE d.user_id = u.id 
                                AND d.etat = 1 
                                AND CURRENT_DATE BETWEEN d.date_debut AND d.date_fin
                            ) THEN true
                            ELSE false
                        END as conge
                    FROM users u
                    JOIN departements d ON u.departement_id = d.id
                    LEFT JOIN fonctions f ON u.fonction_id = f.id
                    WHERE d.sous_direction_id = $1
                    AND u.groupeid IN (0, 1)  -- Only employees and managers
                    ORDER BY u.groupeid DESC, u.nomcomplet ASC
                `;
                const employeesResult = await pool.query(employeesQuery, [sousDirectionId]);
                allEmployees = employeesResult.rows;
                // Map to required properties for frontend
                allEmployees = allEmployees.map(emp => ({
                    id: emp.id,
                    nomcomplet: emp.nomcomplet,
                    email: emp.email,
                    departement_nom: emp.departement_nom,
                    departement_id: emp.departement_id,
                    groupeid: emp.groupeid,
                    conge: emp.conge
                }));
                
                // Add sous-direction name to sousDirector object
                sousDirector.sous_direction_nom = sousDirectionName;
                sousDirector.sous_direction_id = sousDirectionId;
            }
        }

        // Fetch sous-director's available leave days (jours_dispo)
        let jours_dispo = 0;
        if (sousDirector && sousDirector.id) {
            const QSousDirectorConge = `
                SELECT jours_dispo
                FROM conges
                WHERE user_id = $1
                ORDER BY id DESC
                LIMIT 1
            `;
            const sousDirectorCongeResult = await pool.query(QSousDirectorConge, [sousDirector.id]);
            jours_dispo = sousDirectorCongeResult.rows[0]?.jours_dispo || 0;
        }

        // Fetch sous-director's approved documents (leave requests with document_generated = true)
        let documents = [];
        if (sousDirector && sousDirector.id) {
            const docsQuery = `
                SELECT d.id, d.nature, d.date_debut, d.date_fin, d.jour_pres, d.document_generated, d.document_generated_at
                FROM demandes d
                WHERE d.user_id = $1 AND d.etat = 1 AND d.document_generated = true
                ORDER BY d.date_dmd DESC
            `;
            const docsResult = await pool.query(docsQuery, [sousDirector.id]);
            documents = docsResult.rows;
        }

        // Render sous-director portal
        res.render('sous-director-portal', {
            user: req.session.user,
            sousDirector,
            demandes,
            pendingDemandes,
            sousDirectorDemandes, // Pass sous-director's own demandes for Historique
            employees: allEmployees,  // Changed from managers to allEmployees
            departments,
            pagination: {
                page,
                totalPages,
                totalManagers,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            searchQuery,
            pendingRequestsCount,
            absencesTodayCount,
            notificationsCount: pendingRequestsCount,
            jours_dispo, // Pass sous-director's available leave days
            documents // Pass sous-director's documents to EJS
        });
    } catch (err) {
        console.error('Error in sous-director portal:', err);
        res.status(500).send('Erreur lors du chargement du portail sous-directeur.');
    }
});
app.get("/manager-portal", async (req, res) => {
    if (!req.session.user) {
        return res.render('auth');
    }

    try {
        const manager = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 10;
        const offset = (page - 1) * itemsPerPage;
        const searchQuery = req.query.search || '';

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users u
            WHERE u.groupeid = 0 AND u.departement_id = $1
        `;
        const countResult = await pool.query(countQuery, [manager.departement_id]);
        const totalEmployees = parseInt(countResult.rows[0]?.total || 0);
        const totalPages = Math.ceil(totalEmployees / itemsPerPage) || 1;

        // Get employees in manager's department (fetch ALL for client-side pagination)
        const query = `
            SELECT 
                u.id, u.nomcomplet, u.email,
                f.nom as fonction_nom,
                d.nom as departement_nom
            FROM users u
            LEFT JOIN fonctions f ON u.fonction_id = f.id
            LEFT JOIN departements d ON u.departement_id = d.id
            WHERE u.groupeid = 0 AND u.departement_id = $1
            ORDER BY u.nomcomplet
        `;
        const queryParams = [manager.departement_id];
        const result = await pool.query(query, queryParams);
        const employees = result.rows.map(emp => {
            return {
                id: emp.id,
                name: emp.nomcomplet,
                email: emp.email || '',
                department: emp.departement_nom || '',
                fonction: emp.fonction_nom || '',
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nomcomplet)}`
            };
        });

        // Get team members' leave requests (excluding manager's requests)
        const teamRequestsQuery = `
            SELECT 
                d.*,
                u.nomcomplet as employee_name,
                u.email as employee_email,
                f.nom as nature
                FROM demandes d
                JOIN users u ON d.user_id = u.id
            LEFT JOIN fonctions f ON u.fonction_id = f.id
            WHERE u.departement_id = $1 
            AND u.groupeid = 0
            AND u.id != $2
            ORDER BY d.date_debut DESC
            `;
        const teamRequestsResult = await pool.query(teamRequestsQuery, [manager.departement_id, manager.id]);
        const teamRequests = teamRequestsResult.rows;

        // Get manager's own leave requests
        const managerRequestsQuery = `
            SELECT 
                d.*,
                u.nomcomplet as employee_name,
                u.email as employee_email,
                f.nom as nature
                FROM demandes d
                JOIN users u ON d.user_id = u.id
            LEFT JOIN fonctions f ON u.fonction_id = f.id
            WHERE u.id = $1
            ORDER BY d.date_debut DESC
        `;
        const managerRequestsResult = await pool.query(managerRequestsQuery, [manager.id]);
        const managerRequests = managerRequestsResult.rows;

        // Count manager's pending requests
        const managerPendingRequestsCount = managerRequests.filter(req => req.etat === 0).length;

        // Get team stats
        const teamStatsQuery = `
            WITH employee_count AS (
                SELECT COUNT(*) as total_employees
                FROM users
                WHERE departement_id = $1 AND groupeid = 0
            ),
            absences_today AS (
                SELECT COUNT(DISTINCT u.id) as absent_count
                FROM users u
                JOIN demandes d ON u.id = d.user_id
                WHERE u.departement_id = $1 
                AND u.groupeid = 0 
                AND d.etat = 1 
                AND d.date_debut <= CURRENT_DATE 
                AND d.date_fin >= CURRENT_DATE
            )
            SELECT 
                ec.total_employees,
                COALESCE(at.absent_count, 0) as absent_count
            FROM employee_count ec
            CROSS JOIN absences_today at`;
            
        const teamStatsResult = await pool.query(teamStatsQuery, [manager.departement_id]);
        const teamStats = teamStatsResult.rows[0] || { total_employees: 0, absent_count: 0 };

        // Get pending requests count for dashboard (team members only)
        const pendingRequestsCountQuery = `
            SELECT COUNT(*) as pending_count
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            WHERE u.departement_id = $1 
            AND u.groupeid = 0 
            AND u.id != $2 
            AND d.etat = 0
        `;
        const pendingRequestsCountResult = await pool.query(pendingRequestsCountQuery, [manager.departement_id, manager.id]);
        const pendingRequestsCount = pendingRequestsCountResult.rows[0]?.pending_count || 0;

        // Get today's absences count (team members only)
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const absencesTodayQuery = `
            SELECT COUNT(*) as absences_count
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            WHERE u.departement_id = $1 
            AND u.groupeid = 0 
            AND u.id != $2
            AND d.etat = 1
            AND d.date_debut <= $3
            AND d.date_fin >= $4
        `;
        const absencesTodayResult = await pool.query(absencesTodayQuery, [manager.departement_id, manager.id, todayStart, todayEnd]);
        const absencesTodayCount = absencesTodayResult.rows[0]?.absences_count || 0;

        // Prepare team stats data
        const teamStatsData = {
            totalMembers: teamStatsResult.rows[0]?.total_employees || 0,
            absencesToday: teamStatsResult.rows[0]?.absent_count || 0
        };

        // Fetch manager's own documents (approved leave requests with generated documents)
        const docsQuery = `
            SELECT d.id, d.nature, d.date_debut, d.date_fin, d.jour_pres, d.document_generated, d.document_generated_at
            FROM demandes d
            WHERE d.user_id = $1 AND d.etat = 1 AND d.document_generated = true
            ORDER BY d.date_dmd DESC
        `;
        const docsResult = await pool.query(docsQuery, [manager.id]);
        const documents = docsResult.rows;

        // Fetch manager's available leave days (jours_dispo)
        const QmanagerConge = `
            SELECT jours_dispo
            FROM conges
            WHERE user_id = $1
            ORDER BY id DESC
            LIMIT 1
        `;
        const managerCongeResult = await pool.query(QmanagerConge, [manager.id]);
        const jours_dispo = managerCongeResult.rows[0]?.jours_dispo || 0;

        // Fetch manager's department name
        const departementResult = await pool.query(
            'SELECT nom FROM departements WHERE id = $1',
            [manager.departement_id]
        );
        manager.departement_nom = departementResult.rows[0]?.nom || '';


        

        res.render('manager-portal', {
            user: req.session.user,
            manager: manager,
            demandes: teamRequests, // Team members' requests
            pendingDemandes: teamRequests.filter(d => d.etat === 0), // Pending team requests
            employees: employees,
            leaveRequests: managerRequests, // Manager's own requests
            pagination: {
                page,
                totalPages,
                totalEmployees: teamStatsData.totalMembers,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            searchQuery,
            pendingRequestsCount,
            absencesTodayCount: teamStatsData.absencesToday,
            notificationsCount: pendingRequestsCount,
            teamStats: teamStatsData,
            managerPendingRequestsCount, // Add the manager's pending requests count
            documents, // Pass manager's documents to EJS
            jours_dispo, // Pass manager's available leave days
        });

    } catch (err) {
        console.error('Error in /manager-portal:', err);
        res.status(500).send("Erreur serveur: " + err.message);
    }
});
app.get('/employee-portal', async (req, res) => {
    if (!req.session.user) {
        return res.render('auth');
    }

    const userId = req.session.user.id;
    const userGroupeId = req.session.user.groupeid;

    try {
        // Get demandes
        const demandesQuery = `
            SELECT d.*, 
       TO_CHAR(d.date_dmd, 'DD/MM/YYYY HH24:MI') AS date_dmd,
       TO_CHAR(d.date_debut, 'DD/MM/YYYY') AS date_debut,
       TO_CHAR(d.date_fin, 'DD/MM/YYYY') AS date_fin,
       u1.nomcomplet AS requester_name,
       u2.nomcomplet AS approver_name
FROM demandes d
JOIN users u1 ON d.user_id = u1.id
LEFT JOIN users u2 ON d.approved_by = u2.id
WHERE d.user_id = $1
ORDER BY d.date_dmd DESC;`;
        const demandesResult = await pool.query(demandesQuery, [userId]);




        // In your route handler
const notificationsQuery = `
    -- Get leave request notifications
    SELECT 
        'leave_request' as type,
        d.id,
        d.etat,
        d.date_debut,
        d.date_fin,
      
        d.lu,
        d.document_generated_at,
        u.nomcomplet as user_name
    FROM demandes d
    JOIN users u ON d.user_id = u.id
    WHERE d.user_id = $1 
    AND d.etat != 0 
    AND d.lu = false
    
    UNION ALL
    
    -- Get report notifications
    SELECT 
        'rapport' as type,
        r.id,
        0 as etat, -- Not used for rapports
        NULL as date_debut, -- Not used for rapports
        NULL as date_fin,   -- Not used for rapports
      
        r.lu,
        r.date_creation,
        u.nomcomplet as user_name
    FROM rapports r
    JOIN users u ON r.user_id = u.id
    WHERE r.user_id = $1 
    AND r.lu = false
    
    
`;

console.log('Fetching notifications for user ID:', userId);
const notificationsResult = await pool.query(notificationsQuery, [userId]);
const notifications = notificationsResult.rows;
console.log('Fetched notifications:', notifications);

        // Get department info
        const query = `
            SELECT 
                departements.nom AS departement_nom
            FROM 
                users
            JOIN 
                departements ON users.departement_id = departements.id
            WHERE 
                users.id = $1
        `;
        const result = await pool.query(query, [userId]);
        const depart = result.rows[0];
        if (!depart) {
            return res.status(404).send('Department not found');
        }
        const departementId = req.session.user.departement_id;
        const queryM = `
            SELECT 
                nomcomplet
            FROM 
                users
            WHERE 
                departement_id = $1 AND 
                groupeid = 1
        `;
        const resultM = await pool.query(queryM, [departementId]);
        // ----------------------------
        // activity recent 
        const activityRecentQuery = `
        SELECT * FROM demandes
        WHERE user_id = $1
        ORDER BY date_dmd DESC
        LIMIT 3
      `;
        const activityRecent = await pool.query(activityRecentQuery, [userId]);
        const fonctionId = req.session.user.fonction_id;
        const queryF = `
            SELECT nom 
            FROM fonctions 
            WHERE id = $1
        `;
        const resultF = await pool.query(queryF, [fonctionId]);
        const fonction = resultF.rows[0];
        const nomComplet = req.session.user.nomcomplet;
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nomComplet)}`;
        const Qemployees = `
                SELECT c.id,
       c.user_id,
       c.jours_dispo,
       c.jours_pris,
       c.conje,
       c.nature,
       c.departement_id,
       c.direction_id,
       c.sous_direction_id,
       c.fonction_id,
       u.nomcomplet AS user_name
FROM conges c
JOIN users u ON c.user_id = u.id
WHERE c.user_id = $1
ORDER BY c.id DESC;
        `;
        const employeesinfo = await pool.query(Qemployees, [userId]);
        const allemployeesinfo = employeesinfo.rows;

        // If employee (groupeid == 0), fetch their approved documents
        let documents = [];
        if (userGroupeId === 0) {
            const docsQuery = `
                SELECT d.id, d.nature, d.date_debut, d.date_fin, d.jour_pres, d.document_generated, d.document_generated_at
                FROM demandes d
                WHERE d.user_id = $1 AND d.etat = 1 AND d.document_generated = true
                ORDER BY d.date_dmd DESC
            `;
            const docsResult = await pool.query(docsQuery, [userId]);
            documents = docsResult.rows;
        }


         const rapportsQuery = `
            SELECT r.id, r.titre, r.type, r.contenu, r.date_creation
            FROM rapports r
            WHERE r.user_id = $1
            ORDER BY r.date_creation DESC
        `;
        const rapportsResult = await pool.query(rapportsQuery, [userId]);
        const rapports = rapportsResult.rows;

        // Render the page with all data
        res.render('employee-portal', {
            avatarUrl: avatarUrl,
            fonction: fonction,
            resultM: resultM.rows,
            depart: depart,
            activityRecent: activityRecent.rows,
            allemployeesinfo: allemployeesinfo,
            demandes: demandesResult.rows,
            notifications: notifications,
            user: req.session.user,
            rapports,
            documents // Pass documents to EJS
        });

    } catch (error) {
        console.error('Error in /employee-portal:', error);
        res.status(500).send('Erreur serveur');
    }
});


app.post('/add-demande', async (req, res) => {
    try {
        console.log('📦 Données reçues :', req.body);
        const { date_debut, date_fin, nature, motif } = req.body;
        const user_id = req.session.user.id;
        
        // Validate required fields based on leave type
        if (!date_debut || !date_fin || !nature) {
            return res.status(400).json({ 
                success: false, 
                    message: 'Les dates et la nature du congé sont obligatoires' 
                });
        }

        // Validate motif only for "Exceptionnel" type
        if (nature === 'Exceptionnel' && !motif) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Le motif est obligatoire pour un congé exceptionnel' 
                });
        }

        // Calculate days
        const jourPres = Math.ceil((new Date(date_fin) - new Date(date_debut)) / (1000 * 3600 * 24)) + 1;

        // Insert the leave request with current timestamp
        const result = await pool.query(
            `INSERT INTO demandes (date_debut, date_fin, nature, motif, etat, user_id, jour_pres, date_dmd) 
            VALUES ($1, $2, $3, $4, 0, $5, $6, CURRENT_TIMESTAMP)
            RETURNING id`,
            [date_debut, date_fin, nature, motif || null, user_id, jourPres]
        );

        console.log('✅ Nouvelle demande reçue :', { 
            id: result.rows[0].id,
            date_debut, 
            date_fin, 
            nature, 
            motif, 
            user_id,
            jourPres 
        });

            return res.json({ 
            success: true, 
                message: 'Demande de congé soumise avec succès!',
                demandeId: result.rows[0].id
        });

    } catch (err) {
        console.error('Error submitting leave request:', err);
            return res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la soumission de la demande' 
        });
    }
});



app.get('/auth', (req, res) => {
    res.render('auth');
});

app.get('/test-db', async (req, res) => {
    try {

    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur de base de données');
    }
});

app.post('/auth', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt - Email:', email);
    
    if (!email || !password) {
        console.log('Missing credentials');
        return res.status(400).render('auth', { error: 'Email et mot de passe requis' });
    }

    try {
        console.log('Attempting database query...');
        const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
        console.log('Query result:', result.rows.length > 0 ? 'User found' : 'No user found');
        console.log('User group:', result.rows[0]?.groupeid);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            
            // For admin users (groupeid = 5)
            if (user.groupeid === 5) {
                console.log('Admin user detected, groupeid:', user.groupeid);
                
                try {
                const directionQuery = `
                    SELECT d.id as direction_id, d.nom as direction_nom
                    FROM users u
                    JOIN direction d ON u.direction_id = d.id
                    WHERE u.id = $1
                `;
                const directionResult = await pool.query(directionQuery, [user.id]);
                console.log('Direction query result:', directionResult.rows[0]);
                
                if (directionResult.rows.length > 0) {
                    const directionId = directionResult.rows[0].direction_id;
                    req.session.user = { 
                        id: user.id, 
                        email: user.email, 
                        groupeid: user.groupeid, 
                        nomcomplet: user.nomcomplet,
                        direction_id: directionId,
                        direction_nom: directionResult.rows[0].direction_nom
                    };
                    console.log('Redirecting to admin portal with direction:', directionId);
                    return res.redirect(`/administration-portal?direction=${directionId}`);
                } else {
                    console.log('No direction found for admin user');
                    return res.render('auth', { error: 'Direction non trouvée pour cet administrateur.' });
                    }
                } catch (dirErr) {
                    console.error('Error fetching direction:', dirErr);
                    return res.status(500).render('auth', { error: 'Erreur lors de la récupération de la direction' });
                }
            } else {
                // For non-admin users
                req.session.user = { 
                    id: user.id, 
                    email: user.email, 
                    groupeid: user.groupeid, 
                    nomcomplet: user.nomcomplet, 
                    date_entree: user.date_entree, 
                    departement_id: user.departement_id, 
                    fonction_id: user.fonction_id, 
                    matricule: user.matricule, 
                    phone: user.phone 
                };

                // Handle redirects based on user type
                const redirects = {
                    0: 'employee-portal',
                    1: 'manager-portal',
                    2: 'sous-director-portal',
                    3: 'hr-portal',
                    4: 'director-portal',
                    5: 'administration-portal'
                };

                const redirectPath = redirects[user.groupeid];
                if (redirectPath) {
                    console.log(`Redirecting to ${redirectPath}`);
                    return res.redirect('/' + redirectPath);
            } else {
                    console.log('Unknown user type:', user.groupeid);
                return res.render('auth', { error: 'Type d\'utilisateur inconnu.' });
                }
            }
        } else {
            console.log('Invalid credentials');
            return res.render('auth', { error: 'Email ou mot de passe incorrect' });
        }
    } catch (err) {
        console.error('Auth error:', err);
        return res.status(500).render('auth', { error: 'Une erreur est survenue lors de l\'authentification' });
    }
});

app.post('/add-demande', async (req, res) => {
    try {
        console.log('📦 Données reçues :', req.body);
        const { date_debut, date_fin, nature, motif } = req.body;
        const user_id = req.session.user.id;

        // Validate required fields based on leave type
        if (!date_debut || !date_fin || !nature) {
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Les dates et la nature du congé sont obligatoires' 
                });
            }
            return res.redirect('back');
        }

        // Validate motif only for "Exceptionnel" type
        if (nature === 'Exceptionnel' && !motif) {
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Le motif est obligatoire pour un congé exceptionnel' 
                });
            }
            return res.redirect('back');
        }

        // Calculate days
        const jourPres = Math.ceil((new Date(date_fin) - new Date(date_debut)) / (1000 * 3600 * 24)) + 1;

        // Insert the leave request with current timestamp
        const result = await pool.query(
            `INSERT INTO demandes (date_debut, date_fin, nature, motif, etat, user_id, jour_pres, date_dmd) 
            VALUES ($1, $2, $3, $4, 0, $5, $6, CURRENT_TIMESTAMP)
            RETURNING id`,
            [date_debut, date_fin, nature, motif || null, user_id, jourPres]
        );

        console.log('✅ Nouvelle demande reçue :', { 
            id: result.rows[0].id,
            date_debut, 
            date_fin, 
            nature, 
            motif, 
            user_id,
            jourPres 
        });

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({ 
                success: true, 
                message: 'Demande de congé soumise avec succès!',
                demandeId: result.rows[0].id
            });
        }

        // For regular form submission, redirect back to the same page
        res.redirect('back');

    } catch (err) {
        console.error('Error submitting leave request:', err);
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de la soumission de la demande' 
            });
        }
        res.redirect('back');
    }
});

app.get('/demande', async (req, res) => {
    try {
        // Get all demandes with requester and approver names
        const alldemande = await pool.query(
            `SELECT d.*, 
                    u1.nomcomplet,
                    u2.nomcomplet as approver_name
             FROM demandes d
             JOIN users u1 ON d.user_id = u1.id
             LEFT JOIN users u2 ON d.approved_by = u2.id`
        );

        // Check if session user exists before querying
        let userdemande = { rows: [] }; // Default empty array
        if (req.session.user && req.session.user.id) {
            userdemande = await pool.query(
                `SELECT d.*, 
                        u1.nomcomplet,
                        u2.nomcomplet as approver_name
                 FROM demandes d
                 JOIN users u1 ON d.user_id = u1.id
                 LEFT JOIN users u2 ON d.approved_by = u2.id
                 WHERE d.user_id = $1`,
                [req.session.user.id]
            );
        }

        console.log(alldemande.rows);

        res.render('demande', {
            demandes: alldemande.rows,
            user: req.session.user || {}, // Ensures user is always an object
            userdemandes: userdemande.rows
        });

    } catch (err) {
        console.error('Database Error:', err.message);
        res.status(500).send('Erreur serveur');
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.redirect('/employee-portal'); // Redirect back if error
        }
        res.redirect('/auth'); // Redirect to login after logout
    });
});
app.post('/update-etat/:id', async (req, res) => {
    const demandeId = req.params.id;
    const adminId = req.session.user.id; // Get the admin's ID who is approving

    try {
        // Update the "etat" field and add the admin who approved
        await pool.query(
            'UPDATE demandes SET etat = $1, approved_by = $2 WHERE id = $3',
            [1, adminId, demandeId]
        );

        // Fetch the approved demande to get user_id and jour_pres
        const demandeResult = await pool.query('SELECT user_id, jour_pres FROM demandes WHERE id = $1', [demandeId]);
        if (demandeResult.rows.length > 0) {
            const { user_id, jour_pres } = demandeResult.rows[0];
            // Decrement jours_dispo for the user (manager or employee)
            await pool.query(
                'UPDATE conges SET jours_dispo = GREATEST(jours_dispo - $1, 0) WHERE user_id = $2',
                [jour_pres, user_id]
            );
        }

        // Get the updated leave requests for the department
        const leaveRequestsQuery = `
            SELECT d.*, u.nomcomplet AS employee_name, u.email AS employee_email
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            WHERE u.departement_id = $1 AND u.groupeid = 0
            ORDER BY d.date_dmd DESC
        `;
        const leaveRequestsResult = await pool.query(leaveRequestsQuery, [req.session.user.departement_id]);
        const leaveRequests = leaveRequestsResult.rows;

        // Redirect based on user role with updated data
        if (req.session.user.groupeid === 2) {
            res.redirect('/sous-director-portal');
        } else if (req.session.user.groupeid === 4) {
            res.redirect('/director-portal');
        } else {
            res.redirect('/manager-portal');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la mise à jour de l'état");
    }
});


// annuler demande  
app.post('/annuler-demande/:id', async (req, res) => {
    const demandeId = req.params.id;
    const adminId = req.session.user.id; // Get the admin's ID who is refusing

    try {
        // Update the demande with refusal and admin who refused
        await pool.query(
            'UPDATE demandes SET etat = $1, approved_by = $2 WHERE id = $3',
            [2, adminId, demandeId]
        );

        // Redirect based on user role
        if (req.session.user.groupeid === 2) {
            res.redirect('/sous-director-portal');
        } else if (req.session.user.groupeid === 4) {
            res.redirect('/director-portal');
        } else {
            res.redirect('/manager-portal');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la suppression de la demande");
    }
});


app.get('/download/:id', async (req, res) => {
    const requestId = parseInt(req.params.id, 10);
    try {
        // Fetch leave request details from database with formatted dates
        const result = await pool.query(
            `SELECT d.*, 
             TO_CHAR(d.date_dmd, 'DD/MM/YYYY HH24:MI') as formatted_date_dmd,
             TO_CHAR(d.date_debut, 'DD/MM/YYYY') as formatted_date_debut,
             TO_CHAR(d.date_fin, 'DD/MM/YYYY') as formatted_date_fin,
             u.nomcomplet as employee_name,
             a.nomcomplet as admin_name
             FROM demandes d 
             JOIN users u ON d.user_id = u.id 
             LEFT JOIN users a ON d.approved_by = a.id
             WHERE d.id = $1`,
            [requestId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('Demande de congé introuvable.');
        }

        const leaveRequest = result.rows[0];

        // Set response headers for file download
        res.setHeader('Content-Disposition', `attachment; filename=demande_conge_${requestId}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');

        // Create a new PDF document
        const doc = new PDFDocument();
        doc.pipe(res);

        // Add Air Algérie Logo
        doc.image('public/imgs/Air_Algérie-Logo.wine.png', 50, 30, { width: 150 })
            .moveDown();

        // Title with styling
        doc.font('Helvetica-Bold')
            .fontSize(24)
            .text('Demande de Congé', { align: 'center' })
            .moveDown(4);

        // Add a horizontal line
        doc.moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .stroke()
            .moveDown();

        // Employee Information with better formatting
        doc.font('Helvetica')
            .fontSize(14);

        // Create two columns
        const leftColumn = 50;
        const rightColumn = 300;
        const startY = doc.y;

        // Left column
        doc.text('Informations de la demande:', leftColumn, startY, { underline: true })
            .moveDown()
            .fontSize(12)
            .text(`ID de demande: ${leaveRequest.id}`, leftColumn)
            .text(`Date de demande: ${leaveRequest.formatted_date_dmd}`, leftColumn)
            .text(`Nature: ${leaveRequest.nature}`, leftColumn)
            .text(`Motif: ${leaveRequest.motif}`, leftColumn)
            .text(`Nom complet: ${leaveRequest.employee_name}`, leftColumn);

        // Right column
        doc.fontSize(14)
            .text('Période:', rightColumn, startY, { underline: true })
            .moveDown()
            .fontSize(12)
            .text(`Date de début: ${leaveRequest.formatted_date_debut}`, rightColumn)
            .text(`Date de fin: ${leaveRequest.formatted_date_fin}`, rightColumn);

        // Status section with colored box
        doc.moveDown(2)
            .moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .stroke()
            .moveDown();

        const status = leaveRequest.etat === 1 ? 'APPROUVÉ' : 'REFUSÉ';
        const statusColor = leaveRequest.etat === 1 ? '#28a745' : '#dc3545';

        doc.fillColor(statusColor)
            .fontSize(16)
            .text(`État: ${status}`, { align: 'center' })
            .fillColor('black');

        // Add admin name if available
        if (leaveRequest.admin_name) {
            doc.moveDown()
                .fontSize(12)
                .text(`Décision prise par: ${leaveRequest.admin_name}`, { align: 'center' });
        }

        // Footer
        doc.fontSize(10)
            .text('Air Algérie - Direction des Ressources Humaines', 50, doc.page.height - 50, {
                align: 'center',
                width: doc.page.width - 100
            });

        // Add signature section with line
        doc.text('Signature du Responsable:', 50, doc.y + 20);
        doc.moveTo(50, doc.y + 40)
           .lineTo(250, doc.y + 40)
           .stroke();
        
        doc.text('Signature de l\'Employé:', 300, doc.y + 20);
        doc.moveTo(300, doc.y + 40)
           .lineTo(500, doc.y + 40)
           .stroke();

        // Add cache stamp in bottom right
        const centerX = doc.page.width - 120; // Position from right
        const centerY = doc.page.height - 120; // Position from bottom
        
        // Draw outer circle with Air Algérie red color
        doc.circle(centerX, centerY, 70) // Increased size to accommodate longer text
           .lineWidth(3)
           .strokeColor('#E0001A') // Air Algérie red
           .stroke();
        
        // Draw inner circle
        doc.circle(centerX, centerY, 65)
           .lineWidth(2)
           .strokeColor('#E0001A')
           .stroke();
        
        // Add decorative elements (more professional pattern)
        for (let i = 0; i < 360; i += 15) {
            const angle = (i * Math.PI) / 180;
            const x1 = centerX + 65 * Math.cos(angle);
            const y1 = centerY + 65 * Math.sin(angle);
            const x2 = centerX + 70 * Math.cos(angle);
            const y2 = centerY + 70 * Math.sin(angle);
            doc.moveTo(x1, y1)
               .lineTo(x2, y2)
               .strokeColor('#E0001A')
               .stroke();
        }
        
        // Add text in circular format with more professional content
        doc.fontSize(14)
           .fillColor('#E0001A')
           .text('AIR ALGÉRIE', centerX, centerY - 40, {
               align: 'center',
               width: 120
           });
        
        // Split direction description into two lines if needed
        const directionDesc = leaveRequest.direction_description;
        const words = directionDesc.split(' ');
        let line1 = '', line2 = '';
        
        if (words.length > 3) {
            const midPoint = Math.ceil(words.length / 2);
            line1 = words.slice(0, midPoint).join(' ');
            line2 = words.slice(midPoint).join(' ');
        } else {
            line1 = directionDesc;
        }
        
        doc.fontSize(8)
           .text(line1, centerX, centerY - 20, {
               align: 'center',
               width: 120
           });
        
        if (line2) {
            doc.fontSize(8)
               .text(line2, centerX, centerY - 10, {
                   align: 'center',
                   width: 120
               });
        }
        
        // Add document reference
        doc.fontSize(7)
           .text(`Ref: ${leaveRequest.id}/${new Date().getFullYear()}`, centerX, centerY + 10, {
               align: 'center',
               width: 100
           });
        
        // Add date in the center with a decorative circle
        doc.circle(centerX, centerY + 25, 20)
           .lineWidth(1)
           .strokeColor('#E0001A')
           .stroke();
        
        doc.fontSize(8)
           .text(new Date().toLocaleDateString('fr-FR'), centerX, centerY + 30, {
               align: 'center',
               width: 40
           });

        // Add official seal text
        doc.fontSize(7)
           .fillColor('#000000')
           .text('CACHE OFFICIEL', centerX, centerY + 50, {
               align: 'center',
               width: 80
           });

        // Add small text for authenticity
        doc.fontSize(6)
           .text('Document Authentique', centerX, centerY + 60, {
               align: 'center',
               width: 80
           });

        // Finalize PDF
        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('Erreur lors de la génération du PDF.');
    }
});

app.get("/etat", async (req, res) => {
    if (req.session.user) {

        res.render("etat", {
            user: req.session.user || {},
        });
    }
    else {
        res.redirect('auth');
    }
})



//---------------------- adminstration portal-----------------------------//
app.get('/administration-portal', async (req, res) => {
    if (!req.session.user) {
        return res.render('auth');
    }

    // Check if user is admin
    if (req.session.user.groupeid !== 5) {
        return res.render('auth', { error: 'Accès non autorisé.' });
    }

    try {
        // Get the direction from URL and compare with admin's direction
        const requestedDirection = req.query.direction;
        const userDirectionId = req.session.user.direction_id;

        // If someone tries to access a different direction, redirect to error page
        if (requestedDirection && requestedDirection !== userDirectionId.toString()) {
            return res.render('error', { 
                message: 'Accès non autorisé à cette direction.',
                details: 'Vous ne pouvez accéder qu\'à votre direction assignée.'
            });
        }

        // Verify that the admin's direction exists
        const directionCheckQuery = `
            SELECT id, nom FROM direction WHERE id = $1;
        `;
        const directionCheckResult = await pool.query(directionCheckQuery, [userDirectionId]);
        
        if (directionCheckResult.rows.length === 0) {
            console.error('Admin direction not found:', userDirectionId);
            return res.render('error', { 
                message: 'Direction non trouvée',
                details: 'La direction assignée à cet administrateur n\'existe pas.'
            });
        }

        // Get all directions
        const directionsQuery = `
          SELECT * FROM direction;
        `;
        const directionsResult = await pool.query(directionsQuery);
        const alldirectionsinfovar = directionsResult.rows;

        // Get all sous-directions for the admin's direction
        const sousDirectionsQuery = `
          SELECT sd.* 
          FROM sous_direction sd
          WHERE sd.direction_id = $1
          ORDER BY sd.nom;
        `;
        const sousDirectionsResult = await pool.query(sousDirectionsQuery, [userDirectionId]);
        const allsousdirectionsinfovar = sousDirectionsResult.rows;

        // Get all employees with their sous-directions for the admin's direction
        const employeesQuery = `
          SELECT 
            u.id, 
            u.matricule,
            u.nomcomplet, 
            c.conje AS conge, 
            f.nom AS fonction,
            d.nom AS direction,
            d.id AS direction_id,
            sd.nom AS sous_direction,
            sd.id AS sous_direction_id
          FROM users u
          LEFT JOIN fonctions f ON u.fonction_id = f.id
          LEFT JOIN departements dep ON u.departement_id = dep.id
          LEFT JOIN sous_direction sd ON dep.sous_direction_id = sd.id
          LEFT JOIN direction d ON sd.direction_id = d.id
          LEFT JOIN conges c ON u.id = c.user_id
          WHERE d.id = $1;
        `;
        const employeesResult = await pool.query(employeesQuery, [userDirectionId]);
        const allemployeesinfo = employeesResult.rows;

        // Get current direction info
        const currentDirection = directionCheckResult.rows[0];

        // Get responsable for the direction
        const responsableQuery = `
          SELECT u.*, f.nom as fonction
          FROM users u
          LEFT JOIN fonctions f ON u.fonction_id = f.id
          WHERE u.direction_id = $1 AND u.fonction_id = 7
          LIMIT 1;
        `;
        const responsableResult = await pool.query(responsableQuery, [userDirectionId]);
        const responsable = responsableResult.rows[0] || {};

        // Get leave requests for the direction
        const leaveRequestsQuery = `
          SELECT d.*, 
                 TO_CHAR(d.date_dmd, 'DD/MM/YYYY HH24:MI') AS date_dmd,
                 TO_CHAR(d.date_debut, 'DD/MM/YYYY') AS date_debut,
                 TO_CHAR(d.date_fin, 'DD/MM/YYYY') AS date_fin,
                 u.nomcomplet,
                 u.fonction_id,
                 u.id as user_id,
                 u.direction_id,
                 f.nom as fonction_nom
          FROM demandes d
          JOIN users u ON d.user_id = u.id
          JOIN fonctions f ON u.fonction_id = f.id
          WHERE u.direction_id = $1
          AND d.etat = 1
          ORDER BY d.date_dmd DESC`;
        const leaveRequestsResult = await pool.query(leaveRequestsQuery, [userDirectionId]);

        // Get all rapports for the direction
        

        const rapportsQuery = `
          SELECT r.*, 
                 TO_CHAR(r.date_creation, 'DD/MM/YYYY') as date
          FROM rapports r
          ORDER BY r.date_creation DESC`;
        const rapportsResult = await pool.query(rapportsQuery);
        


        
        console.log('Session userId:', req.session.user.id);
        const userId = req.session.user.id;

        const rapportsQ = `
          SELECT 
            r.*, 
            TO_CHAR(r.date_creation, 'DD/MM/YYYY') as date
          FROM 
            rapports r
          WHERE 
            r.user_id = $1
          ORDER BY 
            r.date_creation DESC`;
            
        const rapportsR = await pool.query(rapportsQ, [userId]);


        // Calculate stats
        const activeCount = allemployeesinfo.filter(emp => emp.conge !== 1).length;
        const leaveCount = allemployeesinfo.filter(emp => emp.conge === 1).length;



        

        res.render('administration-portal', {
            allsousdirectionsinfovar,
            allemployeesinfo,
            currentDirection,
            selectedDirection: userDirectionId,
            selectedSousDirectionId: null,
            isAdmin: true,
            responsable: responsable,
            stats: {
                leaveRequestsCount: leaveRequestsResult.rows.length,
                activeCount,
                leaveCount,
                reportsCount: rapportsResult.rows.length,
                documentsToGenerate: leaveRequestsResult.rows.filter(req => !req.document_generated).length
            },
            leaveRequests: leaveRequestsResult.rows,
            rapports: rapportsR.rows,
            user: req.session.user
        });
    } catch (error) {
        console.error('Erreur administration portal:', error);
        res.status(500).send('Erreur serveur');
    }
});

// --- API: Get all years with approved demandes for year filter ---
app.get('/api/effectif-years', async (req, res) => {
  try {
        const userDirectionId = req.session.user.direction_id;
    const result = await pool.query(`
            SELECT DISTINCT EXTRACT(YEAR FROM d.date_debut) AS year
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            JOIN departements dep ON u.departement_id = dep.id
            JOIN sous_direction sd ON dep.sous_direction_id = sd.id
            WHERE d.approved_by IS NOT NULL
            AND sd.direction_id = $1
      ORDER BY year DESC
        `, [userDirectionId]);
    const years = result.rows.map(row => String(row.year));
    res.json(years);
  } catch (error) {
    console.error('Error fetching effectif years:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/leave-requests-by-month', async (req, res) => {
    try {
        const userDirectionId = req.session.user.direction_id;
      const result = await pool.query(`
        SELECT 
                EXTRACT(MONTH FROM d.date_debut) AS month,
                EXTRACT(YEAR FROM d.date_debut) AS year,
          COUNT(*) AS count
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            JOIN departements dep ON u.departement_id = dep.id
            JOIN sous_direction sd ON dep.sous_direction_id = sd.id
            WHERE d.approved_by IS NOT NULL
            AND sd.direction_id = $1
            GROUP BY EXTRACT(YEAR FROM d.date_debut), EXTRACT(MONTH FROM d.date_debut)
        ORDER BY year, month
        `, [userDirectionId]);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching leave requests by month:', error);
      res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/effectif-evolution', async (req, res) => {
    try {
        const userDirectionId = req.session.user.direction_id;
      const { month, year } = req.query;
        console.log('Fetching data for direction:', userDirectionId, 'month:', month, 'year:', year);

      let baseQuery = `
        SELECT 
                    TO_CHAR(d.date_debut, 'DD/MM/YYYY') as date,
                    COUNT(DISTINCT d.user_id) AS count
                FROM demandes d
                JOIN users u ON d.user_id = u.id
                JOIN departements dep ON u.departement_id = dep.id
                JOIN sous_direction sd ON dep.sous_direction_id = sd.id
                WHERE d.approved_by IS NOT NULL
                AND sd.direction_id = $1
        `;
        let params = [userDirectionId];

      if (month) {
            baseQuery += ` AND EXTRACT(MONTH FROM d.date_debut) = $${params.length + 1}`;
        params.push(month);
      }
        if (year) {
            baseQuery += ` AND EXTRACT(YEAR FROM d.date_debut) = $${params.length + 1}`;
            params.push(year);
        }

        const finalQuery = baseQuery + ` GROUP BY d.date_debut ORDER BY d.date_debut`;
        console.log('Executing query:', finalQuery, 'with params:', params);
        
        const result = await pool.query(finalQuery, params);
        console.log('Query results:', result.rows);
        
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching effectif evolution:', error);
      res.status(500).json({ error: 'Server error' });
    }
});

// --- API: Get min/max year for year filter (full range) ---
app.get('/api/effectif-year-range', async (req, res) => {
  try {
        const userDirectionId = req.session.user.direction_id;
    const result = await pool.query(`
            SELECT 
                MIN(EXTRACT(YEAR FROM d.date_debut)) AS min, 
                MAX(EXTRACT(YEAR FROM d.date_debut)) AS max 
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            JOIN departements dep ON u.departement_id = dep.id
            JOIN sous_direction sd ON dep.sous_direction_id = sd.id
            WHERE sd.direction_id = $1
        `, [userDirectionId]);
    const min = result.rows[0].min ? Math.floor(result.rows[0].min) : new Date().getFullYear();
    const max = result.rows[0].max ? Math.floor(result.rows[0].max) : new Date().getFullYear();
    res.json({ min, max });
  } catch (error) {
    console.error('Error fetching effectif year range:', error);
    res.status(500).json({ error: 'Server error' });
    }
});

// Get all rapports
app.get('/api/rapports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rapports ORDER BY date_creation DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rapports:', err);
    res.status(500).json({ error: 'Error fetching rapports' });
  }
});

// Create new rapport
app.post('/api/rapports', async (req, res) => {
  try {
    const { title, type, description } = req.body;
    const department_id = req.session.user.departement_id;
    
    // Validate required fields
    if (!title || !type || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Title, type, and description are required'
      });
    }

    // Insert the report into the database
    const result = await pool.query(
      `INSERT INTO rapports 
       (title, type, description, department_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *, TO_CHAR(date_creation, 'DD/MM/YYYY') as date`,
      [title, type, description, department_id]
    );

    // Send success response with the created report
    res.status(201).json({
      success: true,
      message: 'Rapport créé avec succès',
      rapport: result.rows[0]
    });

  } catch (err) {
    console.error('Error creating rapport:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la création du rapport',
      details: err.message 
    });
  }
});

// Delete rapport
app.delete('/api/rapports/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM rapports WHERE id = $1', [id]);
    res.json({ message: 'Rapport deleted successfully' });
  } catch (err) {
    console.error('Error deleting rapport:', err);
    res.status(500).json({ error: 'Error deleting rapport' });
  }
});

// Document Generation Routes
app.post('/generate-document/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        console.log('Generating document for request:', requestId);
        
        // Get leave request details
        const requestQuery = `
            SELECT d.*, u.nomcomplet, u.matricule, u.fonction_id, u.direction_id,
                   f.nom as fonction_nom, 
                   dir.nom as direction_nom,
                   dir.description as direction_description
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            JOIN fonctions f ON u.fonction_id = f.id
            JOIN direction dir ON u.direction_id = dir.id
            WHERE d.id = $1`;
        const requestResult = await pool.query(requestQuery, [requestId]);
        
        if (requestResult.rows.length === 0) {
            console.log('No request found with ID:', requestId);
            return res.status(404).json({ success: false, message: 'Demande non trouvée' });
        }

        const request = requestResult.rows[0];
        console.log('Found request:', request);

        // Generate PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50
        });

        // Set up PDF stream
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            console.log('PDF generated successfully, size:', pdfBuffer.length);
            
            // Save PDF to database
            const saveQuery = `
                UPDATE demandes 
                SET document_generated = true,
                    document_data = $1,
                    document_generated_at = CURRENT_TIMESTAMP
                WHERE id = $2`;
            
            pool.query(saveQuery, [pdfBuffer, requestId])
                .then(() => {
                    console.log('Document saved to database for request:', requestId);
                    res.json({ success: true, message: 'Document généré avec succès' });
                })
                .catch(err => {
                    console.error('Error saving document to database:', err);
                    res.status(500).json({ 
                        success: false, 
                        message: 'Erreur lors de la sauvegarde du document',
                        error: err.message 
                    });
                });
        });

        try {
            // Add Air Algérie letterhead with correct image path
            doc.image('public/imgs/Air_Algérie-Logo.wine.png', 50, 50, { width: 100 });
            doc.fontSize(20).text('Air Algérie', 170, 70);
            doc.fontSize(12).text(request.direction_description, 170, 90);

            // Add document title
            doc.moveDown(2);
            doc.fontSize(16).text('ATTESTATION DE CONGÉ', { align: 'center' });
            doc.moveDown();

            // Add employee information
            doc.fontSize(12);
            doc.text(`N° Matricule: ${request.matricule}`);
            doc.text(`Nom et Prénom: ${request.nomcomplet}`);
            doc.text(`Fonction: ${request.fonction_nom}`);
            doc.text(`Direction: ${request.direction_description}`);
            doc.moveDown();

            // Add leave details
            doc.text(`Type de Congé: ${request.nature}`);
            doc.text(`Date de Début: ${new Date(request.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
            doc.text(`Date de Fin: ${new Date(request.date_fin).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
            doc.text(`Durée: ${request.jour_pres || 0} jours`);
            doc.moveDown();

            // Add approval information
            doc.text(`Approuvé par: ${request.approved_by || 'N/A'}`);
            doc.text(`Date d'approbation: ${request.date_approval ? new Date(request.date_approval).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}`);
            doc.moveDown(2);

            // Add signature section with line
            doc.text('Signature du Responsable:', 50, doc.y + 20);
            doc.moveTo(50, doc.y + 40)
               .lineTo(250, doc.y + 40)
               .stroke();
            
            doc.text('Signature de l\'Employé:', 300, doc.y + 20);
            doc.moveTo(300, doc.y + 40)
               .lineTo(500, doc.y + 40)
               .stroke();

            // Add cache stamp in bottom right
            const centerX = doc.page.width - 120;
            const centerY = doc.page.height - 120;
            
            // Draw outer circle with Air Algérie red color
            doc.circle(centerX, centerY, 70)
               .lineWidth(3)
               .strokeColor('#E0001A')
               .stroke();
            
            // Draw inner circle
            doc.circle(centerX, centerY, 65)
               .lineWidth(2)
               .strokeColor('#E0001A')
               .stroke();
            
            // Add decorative elements
            for (let i = 0; i < 360; i += 15) {
                const angle = (i * Math.PI) / 180;
                const x1 = centerX + 65 * Math.cos(angle);
                const y1 = centerY + 65 * Math.sin(angle);
                const x2 = centerX + 70 * Math.cos(angle);
                const y2 = centerY + 70 * Math.sin(angle);
                doc.moveTo(x1, y1)
                   .lineTo(x2, y2)
                   .strokeColor('#E0001A')
                   .stroke();
            }
            
            // Add text in circular format
            doc.fontSize(14)
               .fillColor('#E0001A')
               .text('AIR ALGÉRIE', centerX, centerY - 40, {
                   align: 'center',
                   width: 120
               });
            
            // Split direction description into two lines if needed
            const directionDesc = request.direction_description;
            const words = directionDesc.split(' ');
            let line1 = '', line2 = '';
            
            if (words.length > 3) {
                const midPoint = Math.ceil(words.length / 2);
                line1 = words.slice(0, midPoint).join(' ');
                line2 = words.slice(midPoint).join(' ');
            } else {
                line1 = directionDesc;
            }
            
            doc.fontSize(8)
               .text(line1, centerX, centerY - 20, {
                   align: 'center',
                   width: 120
               });
            
            if (line2) {
                doc.fontSize(8)
                   .text(line2, centerX, centerY - 10, {
                       align: 'center',
                       width: 120
                   });
            }
            
            // Add document reference
            doc.fontSize(7)
               .text(`Ref: ${request.id}/${new Date().getFullYear()}`, centerX, centerY + 10, {
                   align: 'center',
                   width: 100
               });
            
            // Add date in the center with a decorative circle
            doc.circle(centerX, centerY + 25, 20)
               .lineWidth(1)
               .strokeColor('#E0001A')
               .stroke();
            
            doc.fontSize(8)
               .text(new Date().toLocaleDateString('fr-FR'), centerX, centerY + 30, {
                   align: 'center',
                   width: 40
               });

            // Add official seal text
            doc.fontSize(7)
               .fillColor('#000000')
               .text('CACHE OFFICIEL', centerX, centerY + 50, {
                   align: 'center',
                   width: 80
               });

            // Add small text for authenticity
            doc.fontSize(6)
               .text('Document Authentique', centerX, centerY + 60, {
                   align: 'center',
                   width: 80
               });

            doc.end();
        } catch (pdfError) {
            console.error('Error during PDF content generation:', pdfError);
            console.error('PDF content generation error details:', {
                message: pdfError.message,
                stack: pdfError.stack
            });
            res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de la génération du contenu du PDF',
                error: pdfError.message 
            });
        }
    } catch (error) {
        console.error('Error in document generation route:', error);
        console.error('Route error details:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la génération du document',
            error: error.message 
        });
    }
});

app.post('/generate-all-documents', async (req, res) => {
    try {
        // Get all approved leave requests without documents
        const requestsQuery = `
            SELECT d.*, u.nomcomplet, u.matricule, u.fonction_id, u.direction_id,
                   f.nom as fonction_nom, 
                   dir.nom as direction_nom,
                   dir.description as direction_description
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            JOIN fonctions f ON u.fonction_id = f.id
            JOIN direction dir ON u.direction_id = dir.id
            WHERE d.etat = 1 
            AND d.document_generated = false`;
        const requestsResult = await pool.query(requestsQuery);
        
        if (requestsResult.rows.length === 0) {
            return res.json({
                success: true,
                message: 'Aucun document à générer'
            });
        }

        let successCount = 0;
        let errorCount = 0;
        let errors = [];

        for (const request of requestsResult.rows) {
            try {
                // Generate document for each request
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 50
                });

                const chunks = [];
                doc.on('data', chunk => chunks.push(chunk));
                
                await new Promise((resolve, reject) => {
                    doc.on('end', async () => {
                        try {
                            const pdfBuffer = Buffer.concat(chunks);
                            
                            // Save PDF to database
                            await pool.query(`
                                UPDATE demandes 
                                SET document_generated = true,
                                    document_data = $1,
                                    document_generated_at = CURRENT_TIMESTAMP
                                WHERE id = $2`, [pdfBuffer, request.id]);
                            
                            successCount++;
                            resolve();
                        } catch (err) {
                            errorCount++;
                            errors.push(`Error for request ${request.id}: ${err.message}`);
                            resolve(); // Continue with next document even if this one fails
                        }
                    });

                    // Add Air Algérie letterhead with correct image path
                    doc.image('public/imgs/Air_Algérie-Logo.wine.png', 50, 50, { width: 100 });
                    doc.fontSize(20).text('Air Algérie', 170, 70);
                    doc.fontSize(12).text(request.direction_description, 170, 90);

                    // Add document title
                    doc.moveDown(2);
                    doc.fontSize(16).text('ATTESTATION DE CONGÉ', { align: 'center' });
                    doc.moveDown();

                    // Add employee information
                    doc.fontSize(12);
                    doc.text(`N° Matricule: ${request.matricule}`);
                    doc.text(`Nom et Prénom: ${request.nomcomplet}`);
                    doc.text(`Fonction: ${request.fonction_nom}`);
                    doc.text(`Direction: ${request.direction_description}`);
                    doc.moveDown();

                    // Add leave details
                    doc.text(`Type de Congé: ${request.nature}`);
                    doc.text(`Date de Début: ${new Date(request.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
                    doc.text(`Date de Fin: ${new Date(request.date_fin).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
                    doc.text(`Durée: ${request.jour_pres || 0} jours`);
                    doc.moveDown();

                    // Add approval information
                    doc.text(`Approuvé par: ${request.approved_by || 'N/A'}`);
                    doc.text(`Date d'approbation: ${request.date_approval ? new Date(request.date_approval).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}`);
                    doc.moveDown(2);

                    // Add signature section with line
                    doc.text('Signature du Responsable:', 50, doc.y + 20);
                    doc.moveTo(50, doc.y + 40)
                       .lineTo(250, doc.y + 40)
                       .stroke();
                    
                    doc.text('Signature de l\'Employé:', 300, doc.y + 20);
                    doc.moveTo(300, doc.y + 40)
                       .lineTo(500, doc.y + 40)
                       .stroke();

                    // Add cache stamp in bottom right
                    const centerX = doc.page.width - 120;
                    const centerY = doc.page.height - 120;
                    
                    // Draw outer circle with Air Algérie red color
                    doc.circle(centerX, centerY, 70)
                       .lineWidth(3)
                       .strokeColor('#E0001A')
                       .stroke();
                    
                    // Draw inner circle
                    doc.circle(centerX, centerY, 65)
                       .lineWidth(2)
                       .strokeColor('#E0001A')
                       .stroke();
                    
                    // Add decorative elements
                    for (let i = 0; i < 360; i += 15) {
                        const angle = (i * Math.PI) / 180;
                        const x1 = centerX + 65 * Math.cos(angle);
                        const y1 = centerY + 65 * Math.sin(angle);
                        const x2 = centerX + 70 * Math.cos(angle);
                        const y2 = centerY + 70 * Math.sin(angle);
                        doc.moveTo(x1, y1)
                           .lineTo(x2, y2)
                           .strokeColor('#E0001A')
                           .stroke();
                    }
                    
                    // Add text in circular format
                    doc.fontSize(14)
                       .fillColor('#E0001A')
                       .text('AIR ALGÉRIE', centerX, centerY - 40, {
                           align: 'center',
                           width: 120
                       });
                    
                    // Split direction description into two lines if needed
                    const directionDesc = request.direction_description;
                    const words = directionDesc.split(' ');
                    let line1 = '', line2 = '';
                    
                    if (words.length > 3) {
                        const midPoint = Math.ceil(words.length / 2);
                        line1 = words.slice(0, midPoint).join(' ');
                        line2 = words.slice(midPoint).join(' ');
                    } else {
                        line1 = directionDesc;
                    }
                    
                    doc.fontSize(8)
                       .text(line1, centerX, centerY - 20, {
                           align: 'center',
                           width: 120
                       });
                    
                    if (line2) {
                        doc.fontSize(8)
                           .text(line2, centerX, centerY - 10, {
                               align: 'center',
                               width: 120
                           });
                    }
                    
                    // Add document reference
                    doc.fontSize(7)
                       .text(`Ref: ${request.id}/${new Date().getFullYear()}`, centerX, centerY + 10, {
                           align: 'center',
                           width: 100
                       });
                    
                    // Add date in the center with a decorative circle
                    doc.circle(centerX, centerY + 25, 20)
                       .lineWidth(1)
                       .strokeColor('#E0001A')
                       .stroke();
                    
                    doc.fontSize(8)
                       .text(new Date().toLocaleDateString('fr-FR'), centerX, centerY + 30, {
                           align: 'center',
                           width: 40
                       });

                    // Add official seal text
                    doc.fontSize(7)
                       .fillColor('#000000')
                       .text('CACHE OFFICIEL', centerX, centerY + 50, {
                           align: 'center',
                           width: 80
                       });

                    // Add small text for authenticity
                    doc.fontSize(6)
                       .text('Document Authentique', centerX, centerY + 60, {
                           align: 'center',
                           width: 80
                       });

                    doc.end();
                });
            } catch (error) {
                errorCount++;
                errors.push(`Error for request ${request.id}: ${error.message}`);
            }
        }

        res.json({ 
            success: true, 
            message: `${successCount} document(s) généré(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`,
            details: {
                successCount,
                errorCount,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        console.error('Error generating all documents:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la génération des documents',
            error: error.message 
        });
    }
});

app.get('/download-document/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        
        // Get document data
        const query = `
            SELECT document_data, nomcomplet, date_debut
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = $1`;
        const result = await pool.query(query, [requestId]);
        
        if (result.rows.length === 0 || !result.rows[0].document_data) {
            return res.status(404).send('Document non trouvé');
        }

        const { document_data, nomcomplet, date_debut } = result.rows[0];
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Attestation_Conge_${nomcomplet}_${date_debut}.pdf`);
        
        // Send PDF data
        res.send(document_data);
    } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).send('Erreur lors du téléchargement du document');
    }
});

app.get('/view-document/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        
        // Get document data
        const query = `
            SELECT document_data
            FROM demandes
            WHERE id = $1`;
        const result = await pool.query(query, [requestId]);
        
        if (result.rows.length === 0 || !result.rows[0].document_data) {
            return res.status(404).send('Document non trouvé');
        }

        // Set response headers for viewing
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        
        // Send PDF data
        res.send(result.rows[0].document_data);
    } catch (error) {
        console.error('Error viewing document:', error);
        res.status(500).send('Erreur lors de l\'affichage du document');
    }
});

app.get('/print-document/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        
        // Get document data
        const query = `
            SELECT document_data
            FROM demandes
            WHERE id = $1`;
        const result = await pool.query(query, [requestId]);
        
        if (result.rows.length === 0 || !result.rows[0].document_data) {
            return res.status(404).send('Document non trouvé');
        }

        // Set response headers for printing
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        
        // Send PDF data
        res.send(result.rows[0].document_data);
    } catch (error) {
        console.error('Error printing document:', error);
        res.status(500).send('Erreur lors de l\'impression du document');
  }
});

// Get admin stats
app.get('/api/admin-stats', async (req, res) => {
  try {
    const userDirectionId = req.session.user.direction_id;

    // Get leave requests for the direction
    const leaveRequestsQuery = `
      SELECT d.*, 
             TO_CHAR(d.date_dmd, 'DD/MM/YYYY HH24:MI') AS date_dmd,
             TO_CHAR(d.date_debut, 'DD/MM/YYYY') AS date_debut,
             TO_CHAR(d.date_fin, 'DD/MM/YYYY') AS date_fin,
             u.nomcomplet,
             u.fonction_id,
             u.id as user_id,
             u.direction_id,
             f.nom as fonction_nom
      FROM demandes d
      JOIN users u ON d.user_id = u.id
      JOIN fonctions f ON u.fonction_id = f.id
      WHERE u.direction_id = $1
      AND d.etat = 1
      ORDER BY d.date_dmd DESC`;
    const leaveRequestsResult = await pool.query(leaveRequestsQuery, [userDirectionId]);

    // Get all rapports
    const rapportsQuery = `
      SELECT r.*, 
             TO_CHAR(r.date_creation, 'DD/MM/YYYY') as date
      FROM rapports r
      ORDER BY r.date_creation DESC`;
    const rapportsResult = await pool.query(rapportsQuery);

    // Get sous-directions count
    const sousDirectionsQuery = `
      SELECT COUNT(*) as count
      FROM sous_direction
      WHERE direction_id = $1`;
    const sousDirectionsResult = await pool.query(sousDirectionsQuery, [userDirectionId]);

    // Get active employees count
    const employeesQuery = `
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN conges c ON u.id = c.user_id
      WHERE u.direction_id = $1
      AND (c.conje IS NULL OR c.conje != 1)`;
    const employeesResult = await pool.query(employeesQuery, [userDirectionId]);

    res.json({
      leaveRequestsCount: leaveRequestsResult.rows.length,
      activeCount: employeesResult.rows[0].count,
      sousDirectionsCount: sousDirectionsResult.rows[0].count,
      reportsCount: rapportsResult.rows.length,
      documentsToGenerate: leaveRequestsResult.rows.filter(req => !req.document_generated).length
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({ error: 'Error getting admin stats' });
  }
});


//-----------------------------//

// --- Director Leave Request Submission ---
app.post('/director/request-leave', async (req, res) => {
    if (!req.session.user || req.session.user.groupeid !== 4) {
        return res.status(403).render('error', { message: "Accès refusé : réservé au Directeur." });
    }
    try {
        const { nature, date_debut, date_fin, motif } = req.body;
        await pool.query(
            'INSERT INTO demandes (user_id, nature, date_debut, date_fin, motif, etat) VALUES ($1, $2, $3, $4, $5, 0)',
            [req.session.user.id, nature, date_debut, date_fin, motif]
        );
        res.redirect('/director-portal');
    } catch (err) {
        console.error('Erreur lors de la soumission de la demande de congé directeur:', err);
        res.status(500).send("Erreur lors de la soumission de la demande de congé");
    }
});
// --- Director Portal: View and Approve/Refuse Sous-Director Leave Requests ---
app.get('/director-portal', async (req, res) => {
    if (!req.session.user || req.session.user.groupeid !== 4) {
        return res.status(403).render('error', { message: "Accès refusé : réservé au Directeur." });
    }
    try {
        // Get director info
        const directorResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.user.id]);
        const director = directorResult.rows[0];

        // Get search query and sous-direction filter from request
        const searchQuery = req.query.search || '';
        const selectedSousDirectionId = req.query.sous_direction_id || '';

        // Fetch all sous-directions in the director's direction
        const sousDirectionsQuery = `
            SELECT sd.* 
            FROM sous_direction sd
            WHERE sd.direction_id = $1
            ORDER BY sd.nom
        `;
        const sousDirectionsResult = await pool.query(sousDirectionsQuery, [director.direction_id]);
        const sousDirections = sousDirectionsResult.rows;

        // Build the employees query with sous-direction filter
        let employeesQuery = `
            SELECT 
                u.*,
                d.nom as departement_nom,
                f.nom as fonction_nom,
                sd.nom as sous_direction_nom,
                sd.id as sous_direction_id,
                CASE 
                    WHEN u.groupeid = 0 THEN 'Employé'
                    WHEN u.groupeid = 1 THEN 'Manager'
                    WHEN u.groupeid = 2 THEN 'Sous-Directeur'
                    WHEN u.groupeid = 4 THEN 'Directeur'
                    ELSE 'Autre'
                END as role
            FROM users u
            LEFT JOIN departements d ON u.departement_id = d.id
            LEFT JOIN sous_direction sd ON d.sous_direction_id = sd.id
            LEFT JOIN fonctions f ON u.fonction_id = f.id
            WHERE u.direction_id = $1
            AND u.groupeid IN (0, 1, 2, 4)  -- Only employees, managers, sous-directors, and director
        `;

        const queryParams = [director.direction_id];

        // Add sous-direction filter if selected
        if (selectedSousDirectionId) {
            employeesQuery += ` AND sd.id = $${queryParams.length + 1}`;
            queryParams.push(selectedSousDirectionId);
        }

        // Add search filter if search query exists
        if (searchQuery) {
            employeesQuery += ` AND (LOWER(u.nomcomplet) LIKE LOWER($${queryParams.length + 1}) OR LOWER(u.email) LIKE LOWER($${queryParams.length + 1}))`;
            queryParams.push(`%${searchQuery}%`);
        }

        employeesQuery += ` ORDER BY u.groupeid DESC, u.nomcomplet ASC`;

        const employeesResult = await pool.query(employeesQuery, queryParams);
        const employees = employeesResult.rows;

        // Fetch all leave requests from employees in the direction
        const demandesQuery = `
            SELECT 
                d.*,
                u.nomcomplet AS employee_name,
                u.email AS employee_email,
                sd.nom as sous_direction_nom,
                CASE 
                    WHEN u.groupeid = 0 THEN 'Employé'
                    WHEN u.groupeid = 1 THEN 'Manager'
                    WHEN u.groupeid = 2 THEN 'Sous-Directeur'
                    WHEN u.groupeid = 4 THEN 'Directeur'
                    ELSE 'Autre'
                END as role
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            LEFT JOIN departements dep ON u.departement_id = dep.id
            LEFT JOIN sous_direction sd ON dep.sous_direction_id = sd.id
            WHERE u.direction_id = $1 AND u.groupeid = 2  -- Only sous-directors in the same direction
            ORDER BY d.date_dmd DESC
        `;
        const demandesResult = await pool.query(demandesQuery, [director.direction_id]);
        const demandes = demandesResult.rows;

        // Only render pending requests (etat === 0)
        const pendingDemandes = demandes.filter(d => d.etat === 0);
        const notificationsCount = pendingDemandes.length;

        // Calculate stats
        const stats = {
            totalEmployees: employees.length,
            totalSousDirectors: employees.filter(e => e.groupeid === 2).length,
            totalManagers: employees.filter(e => e.groupeid === 1).length,
            totalRegularEmployees: employees.filter(e => e.groupeid === 0).length,
            leaveRequests: {
                total: demandes.length,
                approved: demandes.filter(d => d.etat === 1).length,
                rejected: demandes.filter(d => d.etat === 2).length,
                pending: demandes.filter(d => d.etat === 0).length
            }
        };

        // Fetch director's own leave requests for the Historique section
        let directorDemandes = [];
        if (director && director.id) {
            const directorDemandesQuery = `
                SELECT d.*, u.nomcomplet AS employee_name, u.email AS employee_email
                FROM demandes d
                JOIN users u ON d.user_id = u.id
                WHERE d.user_id = $1
                ORDER BY d.date_dmd DESC
            `;
            const directorDemandesResult = await pool.query(directorDemandesQuery, [director.id]);
            directorDemandes = directorDemandesResult.rows;
        }

        // Fetch director's approved documents (leave requests with document_generated = true)
        let documents = [];
        if (director && director.id) {
            const docsQuery = `
                SELECT d.id, d.nature, d.date_debut, d.date_fin, d.jour_pres, d.document_generated, d.document_generated_at
                FROM demandes d
                WHERE d.user_id = $1 AND d.etat = 1 AND d.document_generated = true
                ORDER BY d.date_dmd DESC
            `;
            const docsResult = await pool.query(docsQuery, [director.id]);
            documents = docsResult.rows;
        }

        // Fetch director's available leave days (jours_dispo)
        let jours_dispo = 0;
        if (director && director.id) {
            const QDirectorConge = `
                SELECT jours_dispo
                FROM conges
                WHERE user_id = $1
                ORDER BY id DESC
                LIMIT 1
            `;
            const directorCongeResult = await pool.query(QDirectorConge, [director.id]);
            jours_dispo = directorCongeResult.rows[0]?.jours_dispo || 0;
        }

        res.render('director-portal', {
            director,
            employees,
            sousDirections,
            demandes,
            pendingDemandes,
            notificationsCount,
            stats,
            searchQuery,
            selectedSousDirectionId,
            directorDemandes, // Pass director's own demandes for Historique
            documents, // Pass director's documents to EJS
            jours_dispo // Pass director's available leave days
        });
    } catch (err) {
        console.error('Error loading director portal:', err);
        res.status(500).send('Erreur lors du chargement du portail directeur.');
    }
});
// Director approves a sous-director's leave request
app.post('/director/update-etat/:id', async (req, res) => {
    const demandeId = req.params.id;
    const directorId = req.session.user.id;
    try {
        await pool.query(
            'UPDATE demandes SET etat = $1, approved_by = $2 WHERE id = $3 AND etat = 0',
            [1, directorId, demandeId]
        );
        res.redirect('/director-portal');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la mise à jour de l'état par le directeur");
    }
});
// Director refuses a sous-director's leave request
app.post('/director/annuler-demande/:id', async (req, res) => {
    const demandeId = req.params.id;
    const directorId = req.session.user.id;
    try {
        await pool.query(
            'UPDATE demandes SET etat = $1, approved_by = $2 WHERE id = $3 AND etat = 0',
            [2, directorId, demandeId]
        );
        res.redirect('/director-portal');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la suppression de la demande par le directeur");
    }
});
// --- Sous-Director Leave Request Submission ---
app.post('/submit-sous-director-leave-request', async (req, res) => {
    if (!req.session.user || req.session.user.groupeid !== 2) {
        return res.status(403).send('Unauthorized');
    }
    const { nature, date_debut, date_fin, motif } = req.body;
    if (!nature || !date_debut || !date_fin || !motif) {
        return res.status(400).send('Tous les champs sont requis.');
    }
    try {
        await pool.query(
            'INSERT INTO demandes (user_id, nature, date_debut, date_fin, motif, etat, date_dmd) VALUES ($1, $2, $3, $4, $5, 0, NOW())',
            [req.session.user.id, nature, date_debut, date_fin, motif]
        );
        res.redirect('/sous-director-portal?success=1');
    } catch (err) {
        console.error('Erreur lors de la soumission de la demande de congé sous-directeur:', err);
        res.redirect('/sous-director-portal?error=1');
    }
}); 

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
});

// Error handling for the server
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    switch (error.code) {
        case 'EACCES':
            console.error(`Port ${PORT} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`Port ${PORT} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});
// Delete a demande
app.delete('/demandes/:id', async (req, res) => {
    const demandeId = req.params.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get the demande to check if it's pending
        const demandeResult = await client.query('SELECT * FROM demandes WHERE id = $1', [demandeId]);
        
        if (demandeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(404).json({ message: 'Demande non trouvée' });
            }
            return res.redirect('back');
        }
        
        const demande = demandeResult.rows[0];
        
        // Only allow deletion if the demande is pending
        if (demande.etat !== 0) {
            await client.query('ROLLBACK');
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(400).json({ message: 'Seules les demandes en attente peuvent être supprimées' });
            }
            return res.redirect('back');
        }
        
        // Delete the demande
        await client.query('DELETE FROM demandes WHERE id = $1', [demandeId]);
        
        await client.query('COMMIT');

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({ 
                success: true,
                message: 'Demande supprimée avec succès'
            });
        }

        // For regular form submission, redirect back to the same page
        res.redirect('back');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting demande:', error);
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({ message: 'Erreur lors de la suppression de la demande' });
        }
        res.redirect('back');
    } finally {
        client.release();
    }
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Delete demande route
app.delete('/delete-demande/:id', async (req, res) => {
    try {
        const demandeId = req.params.id;
        
        // Check if the demande exists and is in pending state
        const demandeResult = await pool.query(
            'SELECT * FROM demandes WHERE id = $1 AND etat = 0',
            [demandeId]
        );

        if (demandeResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Demande non trouvée ou déjà traitée' 
            });
        }

        // Delete the demande
        await pool.query('DELETE FROM demandes WHERE id = $1', [demandeId]);

        // Send success response
        res.json({ 
            success: true,
            message: 'Demande supprimée avec succès' 
        });
    } catch (error) {
        console.error('Error deleting demande:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la suppression de la demande' 
        });
    }
});

// Route to handle sending document
app.post('/send-document/:requestId', async (req, res) => {
    try {
        const requestId = req.params.requestId;
        
        // Get document details
        const query = `
            SELECT d.*, u.nomcomplet, u.email, u.matricule
            FROM demandes d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = $1
        `;
        const result = await pool.query(query, [requestId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Document non trouvé' });
        }

        const document = result.rows[0];
        
        // Log document details to terminal
        console.log('\n=== Document Details ===');
        console.log('Employee:', document.nomcomplet);
        console.log('Matricule:', document.matricule);
        console.log('Email:', document.email);
        console.log('Leave Type:', document.nature);
        console.log('Start Date:', document.date_debut);
        console.log('End Date:', document.date_fin);
        console.log('Duration:', document.jour_pres, 'days');
        console.log('Status:', document.etat === 1 ? 'Approved' : 'Rejected');
        console.log('======================\n');

        res.json({ 
            success: true, 
            message: 'Document envoyé avec succès' 
        });
    } catch (error) {
        console.error('Error sending document:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de l\'envoi du document' 
        });
    }
});

// Delete document route
app.delete('/delete-document/:id', async (req, res) => {
    try {
        const documentId = req.params.id;
        
        // Update the document_generated flag and clear document data
        const result = await pool.query(
            `UPDATE demandes 
             SET document_generated = false,
                 document_data = NULL,
                 document_generated_at = NULL
             WHERE id = $1 
             RETURNING *`,
            [documentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Document non trouvé' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Document supprimé avec succès' 
        });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la suppression du document' 
        });
    }
});

// Route to generate document
app.post('/generate-document/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Get leave request details
        const [rows] = await pool.query(`
            SELECT d.*, e.nom as employee_nom, e.prenom as employee_prenom, 
                   a.nom as admin_nom, a.prenom as admin_prenom
            FROM demandes d
            LEFT JOIN employees e ON d.employee_id = e.id
            LEFT JOIN admins a ON d.admin_id = a.id
            WHERE d.id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Demande non trouvée' });
        }

        const demande = rows[0];

        // Generate PDF document
        const doc = new PDFDocument();
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        
        // Add content to PDF
        doc.fontSize(20).text('Attestation de Congé', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString('fr-FR')}`);
        doc.moveDown();
        doc.text(`Je soussigné(e) ${demande.admin_prenom} ${demande.admin_nom}, certifie que ${demande.employee_prenom} ${demande.employee_nom} a effectué un congé du ${new Date(demande.date_debut).toLocaleDateString('fr-FR')} au ${new Date(demande.date_fin).toLocaleDateString('fr-FR')}.`);
        doc.moveDown();
        doc.text(`Type de congé: ${demande.type_conge}`);
        doc.moveDown();
        doc.text(`Statut: ${demande.statut}`);
        doc.moveDown();
        doc.text('Signature:');
        doc.moveDown(2);
        doc.text('_________________');
        
        doc.end();

        // Convert PDF to buffer
        const pdfBuffer = Buffer.concat(buffers);

        // Update the document in database
        await pool.query(`
            UPDATE demandes 
            SET document_generated = true,
                document_data = ?,
                document_generated_at = NOW()
            WHERE id = ?
        `, [pdfBuffer, id]);

        res.json({ success: true, message: 'Document généré avec succès' });
    } catch (error) {
        console.error('Error generating document:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la génération du document' });
    }
});


// Mark all notifications as read
app.post('/api/notifications/mark-all-read', async (req, res) => {
    try {
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const userId = req.session.user.id;
        
        // Mark all leave requests as read
        await pool.query(
            'UPDATE demandes SET lu = true WHERE user_id = $1 AND lu = false AND etat != 0',
            [userId]
        );
        
        // Mark all reports as read
        await pool.query(
            'UPDATE rapports SET lu = true WHERE user_id = $1 AND lu = false',
            [userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Mark a single report as read
app.post('/api/rapports/:id/mark-read', async (req, res) => {
    try {
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const { id } = req.params;
        const userId = req.session.user.id;
        
        await pool.query(
            'UPDATE rapports SET lu = true WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking report as read:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Mark a single demande as read
app.post('/api/demandes/:id/mark-read', async (req, res) => {
    try {
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const { id } = req.params;
        const userId = req.session.user.id;
        
        await pool.query(
            'UPDATE demandes SET lu = true WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking demande as read:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Route to download document
app.get('/download-document/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const [rows] = await pool.query(`
            SELECT document_data, document_generated
            FROM demandes
            WHERE id = ?
        `, [id]);

        if (rows.length === 0 || !rows[0].document_generated) {
            return res.status(404).json({ success: false, message: 'Document non trouvé' });
        }

        const documentData = rows[0].document_data;
        
        // Use a simple filename without special characters
        const filename = `document_${id}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(documentData);
    } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du téléchargement du document' });
    }
});
