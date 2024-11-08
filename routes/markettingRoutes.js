const express = require('express');
const router = express.Router();
const marketerController = require('./../controller/markettingController');

// Get all marketers
router.get('/marketers', marketerController.getAllMarketers);

// Get a marketer by ID
router.get('/marketers/:id', marketerController.getMarketerById);

// Create or update a marketer
router.post('/marketers', marketerController.createOrUpdateMarketer);

// Register a new student
router.post('/students/register', marketerController.registerStudent);

// Get all students
router.get('/students', marketerController.getAllStudents);

// Get a student by ID
router.get('/students/:id', marketerController.getStudentById);

// Get marketer dashboard stats
router.get('/marketers/:marketerId/stats', marketerController.getMarketerDashboardStats);

// Get referred students
router.get('/marketers/:marketerId/referred-students', marketerController.getReferredStudents);

module.exports = router;


// const express = require('express');
// const router = express.Router();
// const markettingController = require('../controller/markettingController');

// // Marketer routes
// router.post('/create', markettingController.createMarketer);
// router.get('/view/:id', markettingController.getMarketerById);
// router.get('/marketers', markettingController.getAllMarketers);
// router.put('/update/:id', markettingController.updateMarketer);
// router.delete('/delete/:id', markettingController.deleteMarketer);

// // Student routes
// router.post('/create', markettingController.createStudent);
// router.get('/students', markettingController.getAllStudents);
// router.get('/view/:id', markettingController.getStudentById);
// router.put('/update/:id', markettingController.updateStudent);
// router.delete('/delete/:id', markettingController.deleteStudent);
// router.get('/filter/category/:category', markettingController.getStudentsByCategory);


// // Route to register a new student
// router.post('/register', marketingController.registerStudent);
// module.exports = router;
