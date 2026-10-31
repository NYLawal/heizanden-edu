const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
require('dotenv').config();

const studentRoutes = require('./routes/studentRoutes');
const questionRoutes = require('./routes/questionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: [
    'https://heizanden-eduassess.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));

app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: 2 * 60 * 60 * 1000
  }
}));
function requireStudent(req, res, next) {
  if (!req.session || !req.session.studentId) {
    return res.redirect('/');
  }

  next();
}

app.get(
  '/student-dashboard.html',
  requireStudent,
  (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
  }
);
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Digital Technologies Quiz server is running.');
});

app.get('/test-student-model', (req, res) => {
  res.send('Student model loaded successfully.');
});

app.use('/students', studentRoutes);
app.use('/questions', questionRoutes);

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }
}

startServer();
