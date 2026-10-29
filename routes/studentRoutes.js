
const express = require('express');
const multer = require('multer');

const router = express.Router();

const {
  generateCode,
   registerStudent,
  importStudents,
  listStudents,
  archiveStudent,
  restoreStudent,
  deleteStudent,
  editStudent
} = require('../controllers/studentController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a CSV file.'));
    }
  }
});

// Teacher password protection
function requireTeacher(req, res, next) {
  const password = req.headers['x-teacher-password'];

  if (!process.env.TEACHER_PASSWORD) {
    return res.status(500).json({
      message: 'Teacher password is not configured.'
    });
  }

  if (password !== process.env.TEACHER_PASSWORD) {
    return res.status(401).json({
      message: 'Unauthorised. Teacher access required.'
    });
  }

  next();
}

// Generate a code for one student
router.post('/generate-code', requireTeacher, generateCode);
router.post('/register', registerStudent);

// Import students from a CSV file
router.post(
  '/import-csv',
  requireTeacher,
  upload.single('file'),
  importStudents
);

// List active or archived students
router.get('/', requireTeacher, listStudents);

// Edit student details
router.patch('/:id', requireTeacher, editStudent);

// Archive an active student
router.patch('/:id/archive', requireTeacher, archiveStudent);

// Restore an archived student
router.patch('/:id/restore', requireTeacher, restoreStudent);

// Permanently delete an archived student
router.delete('/:id', requireTeacher, deleteStudent);

module.exports = router;
