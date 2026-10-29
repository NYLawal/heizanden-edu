
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  admissionNumber: {
    type: String,
    trim: true,
    default: null
  },
  studentClass: {
    type: String,
    required: true,
    enum: ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']
  },
  accessCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  schoolId: {
    type: String,
    required: true,
    default: 'default'
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  hasSubmitted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Admission numbers must be unique within a school
// when supplied. Multiple students may have no number yet.
studentSchema.index(
  { schoolId: 1, admissionNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      admissionNumber: { $type: 'string' }
    }
  }
);

module.exports = mongoose.model('Student', studentSchema);
