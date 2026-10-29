const mammoth = require('mammoth');
const Question = require('../models/Question');

function parseQuestions(text) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const blocks = paragraphs;

  const questions = [];
  const warnings = [];

  blocks.forEach((block, index) => {
    const numberMatch = block.match(/^\s*(\d+)\s*[.)]/);
    const questionNumber = numberMatch ? Number(numberMatch[1]) : null;

    const markers = [
      ...block.matchAll(
        /(?:\(\s*([a-d])\s*\)|\b([a-d])\s*[.)])\s*/gi
      )
    ];

    const labels = markers.map(marker =>
      (marker[1] || marker[2]).toUpperCase()
    );

    const isMCQ =
      labels.length === 4 &&
      labels.join('') === 'ABCD';

    const isTrueFalse =
      /\b(true\s*\/\s*false|true\s+or\s+false)\b/i.test(block) ||
      (
        labels.length === 2 &&
        labels.includes('A') &&
        labels.includes('B') &&
        /\b(true|false)\b/i.test(block)
      );

    const isStructured =
      /\(\s*[a-z]\s*\)\s*/i.test(block) && !isMCQ;

    const isPractical =
      /\b(practical|perform|create|design|develop|construct|demonstrate|write a program)\b/i.test(block);

    let questionType = 'short_answer';
    let questionText = block;
    let options = { A: '', B: '', C: '', D: '' };
    let subQuestions = [];

    if (isMCQ) {
      questionType = 'mcq';

      questionText = block
        .slice(0, markers[0].index)
        .replace(/^\s*\d+\s*[.)]\s*/, '')
        .trim();

      const optionTexts = markers.map((marker, optionIndex) => {
        const start = marker.index + marker[0].length;
        const end =
          optionIndex < markers.length - 1
            ? markers[optionIndex + 1].index
            : block.length;

        return block.slice(start, end).trim();
      });

      options = {
        A: optionTexts[0],
        B: optionTexts[1],
        C: optionTexts[2],
        D: optionTexts[3]
      };

      if (!questionText || optionTexts.some(option => !option)) {
        warnings.push(
          `Question ${questionNumber ?? index + 1}: an MCQ question or option is empty.`
        );
      }
    } else if (isTrueFalse) {
      questionType = 'true_false';
      questionText = block
        .replace(/^\s*\d+\s*[.)]\s*/, '')
        .trim();
    } else if (isStructured) {
      questionType = 'structured';

      const parts = [
        ...block.matchAll(/\(\s*([a-z])\s*\)\s*/gi)
      ];

      if (parts.length) {
        questionText = block.slice(0, parts[0].index).trim();

        subQuestions = parts.map((part, partIndex) => {
          const start = part.index + part[0].length;
          const end =
            partIndex < parts.length - 1
              ? parts[partIndex + 1].index
              : block.length;

          return {
            label: part[1].toLowerCase(),
            questionText: block.slice(start, end).trim()
          };
        });
      }
    } else if (isPractical) {
      questionType = 'practical';
      questionText = block
        .replace(/^\s*\d+\s*[.)]\s*/, '')
        .trim();
    } else {
      questionText = block
        .replace(/^\s*\d+\s*[.)]\s*/, '')
        .trim();
    }

    if (!questionText) {
      warnings.push(
        `Question ${questionNumber ?? index + 1}: could not identify the main question text.`
      );
      return;
    }

    questions.push({
      questionNumber,
      questionType,
      questionText,
      options,
      subQuestions,
      correctAnswer: null,
      trueFalseAnswer: null,
      answerKey: '',
      marks: null
    });
  });

  return { questions, warnings };
}

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

    const parsed = parseQuestions(text);

    const warnings = [
      ...result.messages
        .filter(item => item.type === 'warning')
        .map(item => item.message),
      ...parsed.warnings
    ];

    return res.json({
      message: parsed.questions.length
        ? `Extracted ${parsed.questions.length} question(s) for review.`
        : 'Text extracted, but no questions matched the expected format.',
      text,
      parsedQuestions: parsed.questions,
      warnings
    });
  } catch (error) {
    console.error('Word import error:', error.message);

    return res.status(400).json({
      message:
        'Could not read this Word document. Please check that it is a valid .docx file.'
    });
  }
}

async function importApprovedWordQuestions(req, res) {
  try {
    const { questions, studentClass, topic } = req.body;

    const allowedClasses = [
      'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'
    ];

    if (!allowedClasses.includes(studentClass)) {
      return res.status(400).json({
        message: 'Please select a valid class.'
      });
    }

    if (!topic || !topic.trim()) {
      return res.status(400).json({
        message: 'Please enter the topic.'
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: 'There are no questions to import.'
      });
    }

    if (questions.length > 100) {
      return res.status(400).json({
        message: 'Import no more than 100 questions at a time.'
      });
    }

    const issues = [];

    questions.forEach((question, index) => {
      const number = question.questionNumber || index + 1;
      const options = question.options || {};

      if (!question.questionText?.trim()) {
        issues.push(`Question ${number}: question text is missing.`);
      }

      for (const letter of ['A', 'B', 'C', 'D']) {
        if (!options[letter]?.trim()) {
          issues.push(`Question ${number}: option ${letter} is missing.`);
        }
      }

      if (!['A', 'B', 'C', 'D'].includes(question.correctAnswer)) {
        issues.push(`Question ${number}: correct answer is missing.`);
      }
    });

    if (issues.length) {
      return res.status(400).json({
        message: 'Please correct these issues before importing.',
        issues
      });
    }

    const documents = questions.map(question => ({
  schoolId: process.env.SCHOOL_ID,
  studentClass,
  topic: topic.trim(),
  questionType: 'mcq',
  questionText: question.questionText.trim(),
  options: [
    question.options.A.trim(),
    question.options.B.trim(),
    question.options.C.trim(),
    question.options.D.trim()
  ],
  correctAnswer: question.correctAnswer,
  answerKey: question.answerKey || '',
  marks: question.marks || 1,
  isActive: true
}));

const normalizeQuestion = text =>
  text.trim().replace(/\s+/g, ' ').toLowerCase();

const existingQuestions = await Question.find({
  schoolId: process.env.SCHOOL_ID,
  studentClass,
  questionText: {
    $in: documents.map(doc => doc.questionText)
  }
}).select('questionText');

const existingTexts = new Set(
  existingQuestions.map(q => normalizeQuestion(q.questionText))
);

const newDocuments = documents.filter(
  doc => !existingTexts.has(normalizeQuestion(doc.questionText))
);

if (newDocuments.length === 0) {
  return res.status(200).json({
    message: 'All these questions already exist. Nothing was imported.',
    count: 0,
    skipped: documents.length
  });
}

const savedQuestions = await Question.insertMany(newDocuments);

return res.status(201).json({
  message: `Imported ${savedQuestions.length} new question(s); skipped ${documents.length - savedQuestions.length} duplicate(s).`,
  count: savedQuestions.length,
  skipped: documents.length - savedQuestions.length
});

    return res.status(201).json({
      message: `Successfully imported ${savedQuestions.length} question(s).`,
      count: savedQuestions.length
    });
  } catch (error) {
    console.error('Word question import error:', error);

    return res.status(400).json({
      message: 'Import failed. Please check the questions and try again.'
    });
  }
}

module.exports = { previewWordQuestions, importApprovedWordQuestions };