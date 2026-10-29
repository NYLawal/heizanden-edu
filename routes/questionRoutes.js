const express = require('express');
const router = express.Router();

const wordUpload = require('../middleware/wordUpload');

const {
  previewWordQuestions
} = require('../controllers/wordImportController');

const {
  addQuestion,
  listQuestions,
  updateQuestion,
  deleteQuestion
} = require('../controllers/questionController');

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

router.post('/', requireTeacher, addQuestion);
router.get('/', requireTeacher, listQuestions);
router.put('/:id', requireTeacher, updateQuestion);
router.delete('/:id', requireTeacher, deleteQuestion);
router.post(
  '/import-word/preview',
  requireTeacher,
  wordUpload.single('wordFile'),
  previewWordQuestions
);

module.exports = router;
