const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const Student = require('../models/Student');
const School = require('../models/School');
const Question = require('../models/Question');
const AssessmentResult = require('../models/AssessmentResult');

const validClasses = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];

async function createAccessCode() {
  let accessCode;

  do {
    accessCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  } while (await Student.exists({ accessCode }));

  return accessCode;
}

async function generateCode(req, res) {
  try {
    const { name, admissionNumber, studentClass } = req.body;
    const schoolId = process.env.SCHOOL_ID;

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof admissionNumber !== 'string' ||
      !admissionNumber.trim() ||
      !validClasses.includes(studentClass)
    ) {
      return res.status(400).json({
        message: 'Enter a valid student name, admission number, and class.'
      });
    }

    const cleanAdmissionNumber = admissionNumber.trim();

    const existingStudent = await Student.findOne({
      schoolId,
      admissionNumber: cleanAdmissionNumber
    });

    if (existingStudent) {
      return res.status(409).json({
        message: 'This admission number is already registered in this school.'
      });
    }

    const student = await Student.create({
      name: name.trim(),
      admissionNumber: cleanAdmissionNumber,
      studentClass,
      accessCode: await createAccessCode(),
      schoolId
    });

    return res.status(201).json({
      message: 'Student created and access code generated successfully.',
      student
    });
  } catch (error) {
    console.error('Generate code error:', error.message);

    if (error.code === 11000 && error.keyPattern?.admissionNumber) {
      return res.status(409).json({
        message: 'This admission number is already registered in this school.'
      });
    }

    return res.status(500).json({
      message: 'Could not create student or generate access code.'
    });
  }
}

async function importStudents(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'Please upload a CSV file.'
      });
    }

    const rows = parse(req.file.buffer, {
      columns: headers =>
        headers.map(header =>
          header.trim().toLowerCase().replace(/\s+/g, '')
        ),
      skip_empty_lines: true,
      trim: true,
      bom: true
    });

    const existingStudents = await Student.find({ schoolId: process.env.SCHOOL_ID })
      .select('name studentClass')
      .lean();

    const seen = new Set(
      existingStudents.map(student =>
        `${student.name.trim().toLowerCase()}|${student.studentClass}`
      )
    );

    let imported = 0;
    const skipped = [];

    for (let i = 0; i < rows.length; i++) {
      const name = rows[i].name;
      const studentClass = (
        rows[i].studentclass || rows[i].class || ''
      ).toUpperCase();

      if (
        !name ||
        !name.trim() ||
        !validClasses.includes(studentClass)
      ) {
        skipped.push({
          row: i + 2,
          reason: 'Missing name or invalid class.'
        });
        continue;
      }

      const cleanName = name.trim();
      const key = `${cleanName.toLowerCase()}|${studentClass}`;

      if (seen.has(key)) {
        skipped.push({
          row: i + 2,
          name: cleanName,
          reason: 'This student already exists in this class.'
        });
        continue;
      }

      try {
        await Student.create({
          name: cleanName,
          studentClass,
          accessCode: await createAccessCode(),
          schoolId: process.env.SCHOOL_ID
        });

        seen.add(key);
        imported++;
      } catch (error) {
        if (error.code === 11000) {
          skipped.push({
            row: i + 2,
            name: cleanName,
            reason: 'Duplicate record or access code.'
          });
        } else {
          throw error;
        }
      }
    }

    res.json({
      message: 'CSV import processed.',
      imported,
      skippedCount: skipped.length,
      skipped
    });
  } catch (error) {
    console.error('CSV import error:', error.message);
    res.status(400).json({
      message: 'Could not process the CSV. Check its format and headings.'
    });
  }
}

async function listStudents(req, res) {
  try {
    const archived = req.query.archived === 'true';

    const students = await Student.find({
      schoolId: process.env.SCHOOL_ID,
      isArchived: archived
    })
      .select('-__v')
      .sort({ name: 1 })
      .lean();

    res.json({ count: students.length, students });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not retrieve students.' });
  }
}

async function archiveStudent(req, res) {
  try {
    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: process.env.SCHOOL_ID,
        isArchived: false
      },
      {
        isArchived: true,
        archivedAt: new Date()
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        message: 'Active student not found.'
      });
    }

    res.json({
      message: 'Student archived successfully.',
      student
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid student ID.' });
  }
}

async function restoreStudent(req, res) {
  try {
    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: process.env.SCHOOL_ID,
        isArchived: true
      },
      {
        isArchived: false,
        archivedAt: null
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        message: 'Archived student not found.'
      });
    }

    res.json({
      message: 'Student restored successfully.',
      student
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid student ID.' });
  }
}

async function deleteStudent(req, res) {
  try {
    const student = await Student.findOneAndDelete({
      _id: req.params.id,
      schoolId: process.env.SCHOOL_ID,
      isArchived: true
    });

    if (!student) {
      return res.status(404).json({
        message: 'Archived student not found. Archive the student first.'
      });
    }

    res.json({
      message: 'Student record permanently deleted.'
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid student ID.' });
  }
}


async function editStudent(req, res) {
  try {
    const { name, studentClass, admissionNumber } = req.body;

    if (name !== undefined && (
      typeof name !== 'string' || !name.trim()
    )) {
      return res.status(400).json({
        message: 'Student name cannot be empty.'
      });
    }

    if (
      studentClass !== undefined &&
      !validClasses.includes(studentClass)
    ) {
      return res.status(400).json({
        message: 'Invalid student class.'
      });
    }

    if (
      admissionNumber !== undefined &&
      admissionNumber !== null &&
      typeof admissionNumber !== 'string'
    ) {
      return res.status(400).json({
        message: 'Invalid admission number.'
      });
    }

    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (studentClass !== undefined) updates.studentClass = studentClass;

    if (admissionNumber !== undefined) {
      updates.admissionNumber = admissionNumber.trim() || null;
    }

    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        schoolId: process.env.SCHOOL_ID
      },
      { $set: updates },
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).select('-__v');

    if (!student) {
      return res.status(404).json({
        message: 'Student not found.'
      });
    }

    res.json({
      message: 'Student details updated successfully.',
      student
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'That admission number is already assigned to another student.'
      });
    }

    console.error('Edit student error:', error.message);

    res.status(400).json({
      message: 'Could not update student details.'
    });
  }
}

async function registerStudent(req, res) {
  try {
    const { name, admissionNumber, studentClass, schoolId } = req.body;

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof admissionNumber !== 'string' ||
      !admissionNumber.trim() ||
      typeof schoolId !== 'string' ||
      !schoolId.trim() ||
      !validClasses.includes(studentClass)
    ) {
      return res.status(400).json({
        message: 'Enter your name, admission number, class, and School ID.'
      });
    }

    const cleanSchoolId = schoolId.trim().toUpperCase();
    const cleanAdmissionNumber = admissionNumber.trim();

    const school = await School.findOne({
      schoolId: cleanSchoolId,
      isActive: true
    });

    if (!school) {
      return res.status(400).json({
        message: 'School ID not found or school is inactive. Check with your school.'
      });
    }

    const existingStudent = await Student.findOne({
      schoolId: cleanSchoolId,
      admissionNumber: cleanAdmissionNumber
    });

    if (existingStudent) {
      return res.status(409).json({
        message: 'This admission number is already registered in your school.'
      });
    }

    const accessCode = await createAccessCode();

    const student = await Student.create({
      name: name.trim(),
      admissionNumber: cleanAdmissionNumber,
      studentClass,
      schoolId: cleanSchoolId,
      accessCode
    });

    return res.status(201).json({
      message: 'Registration successful. Keep your access code safe; you will need it to access your assessments.',
      accessCode: student.accessCode,
      schoolName: school.name,
      student: {
        name: student.name,
        admissionNumber: student.admissionNumber,
        studentClass: student.studentClass
      }
    });
  } catch (error) {
    console.error('Student registration error:', error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This admission number or access code is already in use. Please try again.'
      });
    }

    return res.status(500).json({
      message: 'Registration failed. Please try again later.'
    });
  }
}


async function loginStudent(req, res) {
  try {
    const { accessCode } = req.body;

    if (typeof accessCode !== 'string' || !accessCode.trim()) {
      return res.status(400).json({
        message: 'Please enter your access code.'
      });
    }

    const student = await Student.findOne({
      accessCode: accessCode.trim().toUpperCase(),
      isArchived: false
    });

    if (!student) {
      return res.status(401).json({
        message: 'Invalid access code. Please check and try again.'
      });
    }

    const school = await School.findOne({
      schoolId: student.schoolId,
      isActive: true
    });

    if (!school) {
      return res.status(403).json({
        message: 'Your school account is inactive. Please contact your school.'
      });
    }

    req.session.studentId = student._id.toString();
    req.session.schoolId = student.schoolId;

    return req.session.save(error => {
      if (error) {
        console.error('Student session error:', error.message);
        return res.status(500).json({
          message: 'Login failed. Please try again.'
        });
      }

      return res.status(200).json({
        message: 'Login successful.',
        student: {
          id: student._id,
          name: student.name,
          admissionNumber: student.admissionNumber,
          studentClass: student.studentClass,
          schoolId: student.schoolId,
          schoolName: school.name
        }
      });
    });
  } catch (error) {
    console.error('Student login error:', error.message);

    return res.status(500).json({
      message: 'Login failed. Please try again later.'
    });
  }
}

async function getCurrentStudent(req, res) {
  try {
    if (!req.session || !req.session.studentId) {
      return res.status(401).json({
        message: 'Please log in first.'
      });
    }

    const student = await Student.findOne({
      _id: req.session.studentId,
      schoolId: req.session.schoolId,
      isArchived: false
    });

    if (!student) {
      return res.status(404).json({
        message: 'Student record not found.'
      });
    }

    const school = await School.findOne({
      schoolId: student.schoolId,
      isActive: true
    });

    if (!school) {
      return res.status(403).json({
        message: 'School account is inactive.'
      });
    }

    return res.status(200).json({
      student: {
        id: student._id,
        name: student.name,
        admissionNumber: student.admissionNumber,
        studentClass: student.studentClass,
        schoolId: student.schoolId,
        schoolName: school.name
      }
    });
  } catch (error) {
    console.error('Get current student error:', error.message);

    return res.status(500).json({
      message: 'Unable to load student details.'
    });
  }
}

async function getStudentQuestions(req, res) {
  try {
    if (!req.session || !req.session.studentId) {
      return res.status(401).json({
        message: 'Please log in first.'
      });
    }

    const student = await Student.findOne({
      _id: req.session.studentId,
      schoolId: req.session.schoolId,
      isArchived: false
    });

    if (!student) {
      return res.status(404).json({
        message: 'Student record not found.'
      });
    }

    
const baseFilter = {
  schoolId: student.schoolId,
  studentClass: student.studentClass
};


    const questions = await Question.find({
      schoolId: student.schoolId,
      studentClass: student.studentClass,
      $or: [
        { isActive: true },
        { isActive: { $exists: false } }
      ]
    })
      .select('studentClass topic questionType questionText options parts.partLabel parts.questionText parts.marks practicalInstructions marks createdAt')
      .sort({ topic: 1, createdAt: 1 })
      .lean();

    return res.status(200).json({
      count: questions.length,
      studentClass: student.studentClass,
      questions
    });
  } catch (error) {
    console.error('Get student questions error:', error.message);

    return res.status(500).json({
      message: 'Unable to load questions.'
    });
  }
}

async function submitStudentAnswers(req, res) {
  try {
    const student = await Student.findById(req.session.studentId);

    if (!student) {
      return res.status(401).json({
        message: 'Please log in again.'
      });
    }

    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        message: 'No answers were submitted.'
      });
    }

    const existingResults = await AssessmentResult.find({
      studentId: student._id,
      schoolId: student.schoolId,
      studentClass: student.studentClass
    }).sort({ attemptNumber: 1 });

    if (existingResults.length >= 2) {
      return res.status(409).json({
        message: 'You have used both attempts for this assessment. You can no longer submit'
      });
    }

    const attemptNumber = existingResults.length + 1;
    const submittedAnswers = [];
    let score = 0;
    let totalMarks = 0;

    for (const answer of answers) {
      const question = await Question.findOne({
        _id: answer.questionId,
        schoolId: student.schoolId,
        studentClass: student.studentClass,
        isActive: true
      });

      if (!question) {
        return res.status(400).json({
          message: 'An invalid question was submitted.'
        });
      }

      const marks = Number(question.marks) || 0;
      totalMarks += marks;

      let isCorrect = false;

      if (question.questionType === 'mcq') {
        isCorrect =
          typeof answer.selectedOption === 'string' &&
          answer.selectedOption === question.correctAnswer;
      } else if (question.questionType === 'true_false') {
        isCorrect =
          typeof answer.selectedOption === 'string' &&
          answer.selectedOption === question.trueFalseAnswer;
      } else {
        return res.status(400).json({
          message: 'Automatic marking is not yet available for this question type.'
        });
      }

      const marksAwarded = isCorrect ? marks : 0;
      score += marksAwarded;

      submittedAnswers.push({
        questionId: question._id,
        selectedOption: answer.selectedOption ?? null,
        isCorrect,
        marksAwarded
      });
    }

    const result = await AssessmentResult.create({
      studentId: student._id,
      schoolId: student.schoolId,
      studentClass: student.studentClass,
      attemptNumber,
      answers: submittedAnswers,
      score,
      totalMarks
    });

    return res.status(201).json({
      message: `Attempt ${attemptNumber} submitted successfully.`,
      attemptNumber: result.attemptNumber,
      score: result.score,
      totalMarks: result.totalMarks
    });
  }    catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'You have already used this attempt.'
      });
    }

    console.error('Submit student answers error:', error);

    return res.status(500).json({
      message: 'Unable to submit answers. Please try again.'
    });
  }
}

module.exports = {
  generateCode,
  registerStudent,
  loginStudent,
  getCurrentStudent,
  getStudentQuestions,
  submitStudentAnswers,
  importStudents,
  listStudents,
  archiveStudent,
  restoreStudent,
  deleteStudent,
  editStudent
};

