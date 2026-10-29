const mongoose = require('mongoose');

const submittedAnswerSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
    },
    selectedOption: {
        type: String,
        default: null
    },
    isCorrect: {
        type: Boolean,
        required: true
    },
    marksAwarded: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const assessmentResultSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    schoolId: {
        type: String,
        required: true
    },
    studentClass: {
        type: String,
        required: true
    },
    attemptNumber: {
        type: Number,
        required: true,
        enum: [1, 2]
    },
    answers: {
        type: [submittedAnswerSchema],
        required: true
    },
    score: {
        type: Number,
        required: true,
        min: 0
    },
    totalMarks: {
        type: Number,
        required: true,
        min: 0
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

assessmentResultSchema.index(
    { studentId: 1, schoolId: 1, studentClass: 1, attemptNumber: 1 },
    { unique: true }
);

module.exports = mongoose.model('AssessmentResult', assessmentResultSchema);