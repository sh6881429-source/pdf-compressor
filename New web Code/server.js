const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Database Setup
const adapter = new FileSync('db.json');
const db = low(adapter);

// Initial database state
db.defaults({ 
  messages: [], 
  admin: {
    email: 'admin@freetools.dev',
    // Default password is 'admin123' (hashed)
    password: '$2b$10$XODS3TIpLy/iV6yw4x48OOi7EqU0hncfipuvS2kAHckc3tLX8ggL.' 
  } 
}).write();

const app = express();
const PORT = 3457; // Different from the dev server to avoid conflicts

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'freetools-admin-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Serve static files from the root and admin directories
app.use(express.static(path.join(__dirname)));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.adminId) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// ═══════════════════ API ROUTES ═══════════════════

// Public: Submit Contact Form
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const newMessage = {
    id: uuidv4(),
    name,
    email,
    message,
    date: new Date().toISOString(),
    status: 'unread'
  };

  db.get('messages').push(newMessage).write();
  res.json({ success: true, message: 'Message sent successfully!' });
});
// Basic Rate Limiting
const loginAttempts = new Map();

// Admin: Login
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;

  // Rate limiting check
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, last: 0 };
  
  if (attempts.count >= 5 && (now - attempts.last) < 60000) {
    return res.status(429).json({ success: false, message: 'Too many attempts. Try again in 1 minute.' });
  }

  const admin = db.get('admin').value();

  if (email === admin.email && await bcrypt.compare(password, admin.password)) {
    req.session.adminId = 'admin';
    loginAttempts.delete(ip); // Reset on success
    res.json({ success: true, message: 'Login successful' });
  } else {
    loginAttempts.set(ip, { count: attempts.count + 1, last: now });
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Admin: Logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Admin: Get Dashboard Stats
app.get('/api/admin/stats', isAuthenticated, (req, res) => {
  const messages = db.get('messages').value();
  const unreadCount = messages.filter(m => m.status === 'unread').length;
  
  res.json({
    totalMessages: messages.length,
    unreadMessages: unreadCount,
    recentMessages: messages.slice(-5).reverse()
  });
});

// Admin: Get All Messages
app.get('/api/admin/messages', isAuthenticated, (req, res) => {
  const messages = db.get('messages').value();
  res.json(messages.slice().reverse());
});

// Admin: Mark Message as Read/Unread
app.patch('/api/admin/messages/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.get('messages')
    .find({ id })
    .assign({ status })
    .write();
    
  res.json({ success: true });
});

// Admin: Delete Message
app.delete('/api/admin/messages/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  db.get('messages').remove({ id }).write();
  res.json({ success: true });
});

// Admin: Update Credentials
app.patch('/api/admin/credentials', isAuthenticated, async (req, res) => {
  const { email, newPassword } = req.body;
  const updateData = {};
  
  if (email) updateData.email = email;
  if (newPassword) {
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  db.get('admin').assign(updateData).write();
  res.json({ success: true, message: 'Credentials updated successfully' });
});

// Catch-all to serve index.html for root or other pages
app.use((req, res) => {
  const reqPath = req.path;
  if (reqPath.startsWith('/admin')) {
    // Basic session redirect for HTML pages in /admin
    if (!req.session.adminId && reqPath !== '/admin/login.html') {
      return res.redirect('/admin/login.html');
    }
  }
  
  // Clean up path
  let targetFile = reqPath.endsWith('.html') ? reqPath : (reqPath === '/' ? 'index.html' : reqPath + '.html');
  
  res.sendFile(path.join(__dirname, targetFile), (err) => {
    if (err) {
      // If .html version doesn't exist, try just the path
      res.sendFile(path.join(__dirname, reqPath), (err2) => {
        if (err2) res.status(404).send('Page not found');
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Admin Backend running on http://localhost:${PORT}`);
});
