const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB maximum
  },
  fileFilter: (req, file, cb) => {
    const isDocx =
      file.originalname.toLowerCase().endsWith('.docx') &&
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isDocx) {
      return cb(new Error('Please upload a Word document (.docx) only.'));
    }

    cb(null, true);
  }
});

module.exports = upload;