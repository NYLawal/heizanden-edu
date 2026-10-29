const Question = require('../models/Question');

const validClasses = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
const validTypes = ['mcq', 'true_false', 'short_answer', 'structured', 'practical'];

async function addQuestion(req, res) {
  try {
    const {
      studentClass,
      topic,
      questionType = 'mcq',
      questionText,
      options,
      correctAnswer,
      trueFalseAnswer,
      answerKey,
      acceptableAnswers,
      parts,
      practicalInstructions,
      marks
    } = req.body;

    if (
      !validClasses.includes(studentClass) ||
      typeof topic !== 'string' ||
      !topic.trim() ||
      typeof questionText !== 'string' ||
      !questionText.trim() ||
      !validTypes.includes(questionType)
    ) {
      return res.status(400).json({
        message: 'Please provide a valid class, topic, question and question type.'
      });
    }

    if (questionType === 'mcq') {
      if (
        !Array.isArray(options) ||
        options.length !== 4 ||
        options.some(option => typeof option !== 'string' || !option.trim()) ||
        !['A', 'B', 'C', 'D'].includes(correctAnswer)
      ) {
        return res.status(400).json({
          message: 'MCQs require four non-empty options and a correct answer from A to D.'
        });
      }
    }

    if (
      questionType === 'true_false' &&
      !['True', 'False'].includes(trueFalseAnswer)
    ) {
      return res.status(400).json({
        message: 'True/false questions require an answer of True or False.'
      });
    }

    if (
      questionType === 'short_answer' &&
      (typeof answerKey !== 'string' || !answerKey.trim())
    ) {
      return res.status(400).json({
        message: 'Short-answer questions require an answer key.'
      });
    }

    if (questionType === 'structured') {
      if (
        !Array.isArray(parts) ||
        parts.length === 0 ||
        parts.some(part =>
          !part ||
          typeof part.partLabel !== 'string' ||
          !part.partLabel.trim() ||
          typeof part.questionText !== 'string' ||
          !part.questionText.trim()
        )
      ) {
        return res.status(400).json({
          message: 'Structured questions require at least one valid question part.'
        });
      }
    }

    if (
      questionType === 'practical' &&
      typeof practicalInstructions !== 'string'
    ) {
      return res.status(400).json({
        message: 'Practical questions require practical instructions.'
      });
    }

    if (
      marks !== undefined &&
      (!Number.isFinite(Number(marks)) || Number(marks) < 0)
    ) {
      return res.status(400).json({
        message: 'Marks must be a non-negative number.'
      });
    }

    if (
      acceptableAnswers !== undefined &&
      (!Array.isArray(acceptableAnswers) ||
        acceptableAnswers.some(answer => typeof answer !== 'string'))
    ) {
      return res.status(400).json({
        message: 'Acceptable answers must be a list of text answers.'
      });
    }

    const question = await Question.create({
      schoolId: process.env.SCHOOL_ID,
      studentClass,
      topic: topic.trim(),
      questionType,
      questionText: questionText.trim(),
      options: questionType === 'mcq'
        ? options.map(option => option.trim())
        : [],
      ...(questionType === 'mcq' && { correctAnswer }),
      ...(questionType === 'true_false' && { trueFalseAnswer }),
      ...(['short_answer', 'structured', 'practical'].includes(questionType) && {
        answerKey: typeof answerKey === 'string' ? answerKey.trim() : ''
      }),
      ...(questionType === 'short_answer' && {
        acceptableAnswers: (acceptableAnswers || [])
          .map(answer => answer.trim())
          .filter(Boolean)
      }),
      ...(questionType === 'structured' && {
        parts: parts.map(part => ({
          partLabel: part.partLabel.trim(),
          questionText: part.questionText.trim(),
          marks: part.marks === undefined ? 1 : Number(part.marks),
          answerKey: typeof part.answerKey === 'string'
            ? part.answerKey.trim()
            : ''
        }))
      }),
      ...(questionType === 'practical' && {
        practicalInstructions: practicalInstructions.trim()
      }),
      marks: marks === undefined ? 1 : Number(marks)
    });

    return res.status(201).json({
      message: 'Question added successfully.',
      question
    });
  } catch (error) {
    console.error('Add question error:', error.message);
    return res.status(500).json({
      message: 'Could not add question.'
    });
  }
}

async function updateQuestion(req, res) {
  try {
    const {
      studentClass,
      topic,
      questionType = 'mcq',
      questionText,
      options,
      correctAnswer,
      trueFalseAnswer,
      answerKey,
      acceptableAnswers,
      parts,
      practicalInstructions,
      marks
    } = req.body;

    if (
      !validClasses.includes(studentClass) ||
      typeof topic !== 'string' ||
      !topic.trim() ||
      typeof questionText !== 'string' ||
      !questionText.trim() ||
      !validTypes.includes(questionType)
    ) {
      return res.status(400).json({
        message: 'Please provide a valid class, topic, question and question type.'
      });
    }

    if (questionType === 'mcq') {
      if (
        !Array.isArray(options) ||
        options.length !== 4 ||
        options.some(option => typeof option !== 'string' || !option.trim()) ||
        !['A', 'B', 'C', 'D'].includes(correctAnswer)
      ) {
        return res.status(400).json({
          message: 'MCQs require four non-empty options and a correct answer from A to D.'
        });
      }
    }

    if (
      questionType === 'true_false' &&
      !['True', 'False'].includes(trueFalseAnswer)
    ) {
      return res.status(400).json({
        message: 'True/false questions require an answer of True or False.'
      });
    }

    if (
      questionType === 'short_answer' &&
      (typeof answerKey !== 'string' || !answerKey.trim())
    ) {
      return res.status(400).json({
        message: 'Short-answer questions require an answer key.'
      });
    }

    if (questionType === 'structured') {
      if (
        !Array.isArray(parts) ||
        parts.length === 0 ||
        parts.some(part =>
          !part ||
          typeof part.partLabel !== 'string' ||
          !part.partLabel.trim() ||
          typeof part.questionText !== 'string' ||
          !part.questionText.trim()
        )
      ) {
        return res.status(400).json({
          message: 'Structured questions require at least one valid question part.'
        });
      }
    }

    if (
      questionType === 'practical' &&
      typeof practicalInstructions !== 'string'
    ) {
      return res.status(400).json({
        message: 'Practical questions require practical instructions.'
      });
    }

    if (
      marks !== undefined &&
      (!Number.isFinite(Number(marks)) || Number(marks) < 0)
    ) {
      return res.status(400).json({
        message: 'Marks must be a non-negative number.'
      });
    }

    if (
      acceptableAnswers !== undefined &&
      (!Array.isArray(acceptableAnswers) ||
        acceptableAnswers.some(answer => typeof answer !== 'string'))
    ) {
      return res.status(400).json({
        message: 'Acceptable answers must be a list of text answers.'
      });
    }

    const update = {
      studentClass,
      topic: topic.trim(),
      questionType,
      questionText: questionText.trim(),
      options: questionType === 'mcq'
        ? options.map(option => option.trim())
        : [],
      correctAnswer: questionType === 'mcq' ? correctAnswer : undefined,
      trueFalseAnswer: questionType === 'true_false' ? trueFalseAnswer : undefined,
      answerKey: ['short_answer', 'structured', 'practical'].includes(questionType)
        ? (typeof answerKey === 'string' ? answerKey.trim() : '')
        : undefined,
      acceptableAnswers: questionType === 'short_answer'
        ? (acceptableAnswers || []).map(answer => answer.trim()).filter(Boolean)
        : [],
      parts: questionType === 'structured'
        ? parts.map(part => ({
            partLabel: part.partLabel.trim(),
            questionText: part.questionText.trim(),
            marks: part.marks === undefined ? 1 : Number(part.marks),
            answerKey: typeof part.answerKey === 'string'
              ? part.answerKey.trim()
              : ''
          }))
        : [],
      practicalInstructions: questionType === 'practical'
        ? practicalInstructions.trim()
        : undefined,
      marks: marks === undefined ? 1 : Number(marks)
    };

    const question = await Question.findOneAndUpdate(
      { _id: req.params.id, schoolId: process.env.SCHOOL_ID },
      { $set: update },
      { returnDocument: 'after', runValidators: true }
    );

    if (!question) {
      return res.status(404).json({
        message: 'Question not found.'
      });
    }

    return res.json({
      message: 'Question updated successfully.',
      question
    });
  } catch (error) {
    console.error('Update question error:', error.message);
    return res.status(500).json({
      message: 'Could not update question.'
    });
  }
}

async function deleteQuestion(req, res) {
  try {
    const question = await Question.findOneAndDelete({
      _id: req.params.id,
      schoolId: process.env.SCHOOL_ID
    });

    if (!question) {
      return res.status(404).json({
        message: 'Question not found.'
      });
    }

    return res.json({
      message: 'Question deleted successfully.'
    });
  } catch (error) {
    console.error('Delete question error:', error.message);
    return res.status(500).json({
      message: 'Could not delete question.'
    });
  }
}

async function listQuestions(req, res) {
  try {
    const filter = {
  schoolId: process.env.SCHOOL_ID
};

    if (req.query.studentClass) {
      if (!validClasses.includes(req.query.studentClass)) {
        return res.status(400).json({
          message: 'Invalid class.'
        });
      }

      filter.studentClass = req.query.studentClass;
    }

    if (req.query.topic) {
      filter.topic = req.query.topic;
    }
    if (req.query.search) {
  const search = req.query.search.trim();

  if (search) {
    filter.$or = [
      { questionText: { $regex: search, $options: 'i' } },
      { topic: { $regex: search, $options: 'i' } }
    ];
  }
}

    if (req.query.questionType) {
      if (!validTypes.includes(req.query.questionType)) {
        return res.status(400).json({
          message: 'Invalid question type.'
        });
      }

      filter.questionType = req.query.questionType;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const [questions, count] = await Promise.all([
      Question.find(filter)
        .select('-__v')
        .sort({ studentClass: 1, topic: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Question.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(count / limit));

    return res.json({
      count,
      page,
      limit,
      totalPages,
      questions
    });
  } catch (error) {
    console.error('List questions error:', error.message);

    return res.status(500).json({
      message: 'Could not retrieve questions.'
    });
  }
}

module.exports = {
  addQuestion,
  listQuestions,
  updateQuestion,
  deleteQuestion
};
