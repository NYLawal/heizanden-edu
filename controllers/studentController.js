
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const Student = require('../models/Student');

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
    const schoolId = 'default';

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

    const existingStudents = await Student.find({ schoolId: 'default' })
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
          schoolId: 'default'
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
      schoolId: 'default',
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
        schoolId: 'default',
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
        schoolId: 'default',
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
      schoolId: 'default',
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
        schoolId: 'default'
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


module.exports = {
  generateCode,
  importStudents,
  listStudents,
  archiveStudent,
  restoreStudent,
  deleteStudent, 
  editStudent
};

