
const mongoose = require('mongoose');

const questionPartSchema = new mongoose.Schema(
  {
    partLabel: {
      type: String,
      trim: true,
      required: true
    },
    questionText: {
      type: String,
      trim: true,
      required: true
    },
    marks: {
      type: Number,
      min: 0,
      default: 1
    },
    answerKey: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
    default: 'default'
  },

  studentClass: {
    type: String,
    required: true,
    enum: ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']
  },

  topic: {
    type: String,
    required: true,
    trim: true
  },

  questionType: {
    type: String,
    enum: ['mcq', 'true_false', 'short_answer', 'structured', 'practical'],
    default: 'mcq',
    required: true
  },

  questionText: {
    type: String,
    required: true,
    trim: true
  },

  // Used for MCQs only
  options: {
    type: [{
      type: String,
      trim: true
    }],
    default: [],
    validate: {
      validator: function (options) {
        return this.questionType !== 'mcq' ||
          (options.length === 4 && options.every(option => option.length > 0));
      },
      message: 'MCQs must have exactly four non-empty options.'
    }
  },

  // MCQ answer: A, B, C or D
  correctAnswer: {
    type: String,
    enum: ['A', 'B', 'C', 'D'],
    required: function () {
      return this.questionType === 'mcq';
    }
  },

  // True/false answer
  trueFalseAnswer: {
    type: String,
    enum: ['True', 'False'],
    required: function () {
      return this.questionType === 'true_false';
    }
  },

  // Short answers and general marking guidance
  answerKey: {
    type: String,
    trim: true,
    default: ''
  },

  // Alternative accepted responses for short-answer marking
  acceptableAnswers: {
    type: [{
      type: String,
      trim: true
    }],
    default: []
  },

  // Parts of structured questions
  parts: {
    type: [questionPartSchema],
    default: []
  },

  // Instructions for practical tasks
  practicalInstructions: {
    type: String,
    trim: true,
    default: ''
  },

  marks: {
    type: Number,
    min: 0,
    default: 1
  },

  isActive: {
    type: Boolean,
    default: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

questionSchema.index({
  schoolId: 1,
  studentClass: 1,
  topic: 1
});

module.exports = mongoose.model('Question', questionSchema);
