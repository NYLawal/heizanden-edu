const mammoth = require('mammoth');

async function previewWordQuestions(req, res) {
  if (!req.file) {
    return res.status(400).json({
      message: 'Please upload a Word document (.docx).'
    });
  }

  try {
    const result = await mammoth.extractRawText({
      buffer: req.file.buffer
    });

    const text = result.value.trim();

    if (!text) {
      return res.status(400).json({
        message: 'No readable text was found in this document.'
      });
    }

    return res.json({
      message: 'Word document text extracted for review.',
      text,
      warnings: result.messages
        .filter(item => item.type === 'warning')
        .map(item => item.message)
    });
  } catch (error) {
    console.error('Word import error:', error.message);

    return res.status(400).json({
      message:
        'Could not read this Word document. Please check that it is a valid .docx file.'
    });
  }
}

module.exports = { previewWordQuestions };