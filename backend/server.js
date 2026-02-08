const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// GitHub OAuth Config
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'YOUR_CLIENT_ID';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://72.61.5.158:3001/auth/github/callback';

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database
const db = new sqlite3.Database('./devdashboard.db');
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    github_id TEXT UNIQUE,
    username TEXT,
    email TEXT,
    avatar_url TEXT,
    access_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Health check
app.get('/api/health', (req, res) => res.json({status: 'ok', time: new Date().toISOString()}));

// GitHub OAuth Initiate
app.get('/auth/github', (req, res) => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=read:user,repo`;
    res.redirect(url);
});

// GitHub OAuth Callback
app.get('/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({error: 'No code provided'});
    
    try {
        // Exchange code for token
        const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI
        }, { headers: { Accept: 'application/json' } });
        
        const accessToken = tokenRes.data.access_token;
        
        // Get user info
        const userRes = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const { id, login, email, avatar_url } = userRes.data;
        
        // Save user
        db.run(`INSERT OR REPLACE INTO users (github_id, username, email, avatar_url, access_token) 
                VALUES (?, ?, ?, ?, ?)`, [id, login, email, avatar_url, accessToken]);
        
        res.redirect('/dashboard.html?user=' + login);
    } catch (err) {
        console.error('Auth error:', err.message);
        res.status(500).json({error: 'Authentication failed'});
    }
});

// Get dashboard data
app.get('/api/dashboard', async (req, res) => {
    // Mock data for now - in production, fetch from GitHub API
    res.json({
        user: { username: 'developer', avatar: 'https://github.com/github.png' },
        stats: {
            prs_to_review: 3,
            open_issues: 7,
            meetings_today: 2,
            focus_time: '4.5h'
        },
        prs: [
            {number: 42, title: 'Add user authentication', author: 'teammate1', created: '2h ago', repo: 'myproject'},
            {number: 41, title: 'Fix dashboard layout on mobile', author: 'teammate2', created: '5h ago', repo: 'myproject'},
            {number: 40, title: 'Update dependencies', author: 'dependabot', created: '1d ago', repo: 'myproject'}
        ],
        issues: [
            {number: 38, title: 'API timeout on large repositories', priority: 'high', labels: ['bug']},
            {number: 37, title: 'Mobile view broken on iOS', priority: 'medium', labels: ['bug', 'mobile']},
            {number: 36, title: 'Dark mode toggle', priority: 'low', labels: ['feature']}
        ],
        meetings: [
            {title: 'Daily Standup', time: '9:00 AM', duration: '15 min'},
            {title: 'Sprint Planning', time: '2:00 PM', duration: '1 hour'}
        ],
        focus_tasks: [
            {title: 'Ship HN Radar MVP', status: 'in_progress', priority: 'high'},
            {title: 'Review open PRs', status: 'pending', priority: 'high'},
            {title: 'Write documentation', status: 'pending', priority: 'medium'}
        ]
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ DevDashboard API running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Dashboard: http://0.0.0.0:${PORT}/api/dashboard`);
    console.log(`🔐 GitHub Auth: http://0.0.0.0:${PORT}/auth/github`);
});
