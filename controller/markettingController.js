const markettingService = require("./../services/markettingService");
const walletService = require('../services/walletAndTransactionsService');

const marketerController = {};

// Get all marketers
marketerController.getAllMarketers = async (req, res) => {
    try {
        const marketers = await markettingService.getAllMarketers();
        res.status(200).json(marketers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a marketer by ID
marketerController.getMarketerById = async (req, res) => {
    const { id } = req.params;
    try {
        const marketer = await markettingService.getMarketerById(id);
        res.status(200).json(marketer);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

// Create or update a marketer
// marketerController.createOrUpdateMarketer = async (req, res) => {
//     const marketerData = req.body;
//     try {
//         const { referralCode, referralUrl } = await markettingService.createOrUpdateMarketer(marketerData);
        
//         res.status(201).json({ referralCode, referralUrl });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// Create or update a marketer
// marketerController.createOrUpdateMarketer = async (req, res) => {
//     const marketerData = req.body;
//     try {
//         const {marketerData} = await markettingService.createOrUpdateMarketer(marketerData);

//         // Return success response with marketer data
//         res.status(201).json({
//             success: true,
//             message: 'Marketer created/updated successfully.',
//             data: marketerData,
//         });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };


//Controller function for creating or updating a marketer
// marketerController.createOrUpdateMarketer = async (req, res) => {
//     try {
//         const { firstName, lastName, email, phoneNumber, password, location, amount, totalEarning } = req.body;

//         // Ensure all required fields are provided
//         if (!firstName || !lastName || !email || !phoneNumber || !password || !amount || !totalEarning) {
//             return res.status(400).json({ success: false, message: 'All fields are required.' });
//         }

//         // Call service to create or update marketer and generate referral data and token
//         const marketerData = await markettingService.createOrUpdateMarketer({
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             location,
//             password,
//             amount,
//             totalEarning,
//         });

//         // Return success response with marketer data
//         res.status(201).json({
//             success: true,
//             message: 'Marketer created/updated successfully.',
//             data: marketerData,
//         });
//     } catch (error) {
//         console.error('Error in createOrUpdateMarketer:', error);
//         res.status(500).json({
//             success: false,
//             message: 'An error occurred while creating/updating the marketer.',
//             error: error.message,
//         });
//     }
// };

// Create or update a marketer and create a wallet for them
marketerController.createOrUpdateMarketer = async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, password, location, balance, totalEarning } = req.body;

        // Ensure all required fields are provided
        if (!firstName || !lastName || !email || !phoneNumber || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Call service to create or update marketer
        const marketerData = await markettingService.createOrUpdateMarketer({
            firstName,
            lastName,
            email,
            phoneNumber,
            location,
            password,
            balance,
            totalEarning,
        });

        // Create a wallet for the newly created marketer
        const walletData = await walletService.createMarketersWallet(marketerData.id);

        // Return success response with marketer and wallet data
        res.status(201).json({
            success: true,
            message: 'Marketer created/updated successfully.',
            data: {
                marketer: marketerData,
                wallet: walletData,
            },
        });
    } catch (error) {
        console.error('Error in createOrUpdateMarketer:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while creating/updating the marketer.',
            error: error.message,
        });
    }
};


// Register a new student
marketerController.registerStudent = async (req, res) => {
    const studentData = req.body;
    const { referralCode } = req.query; // Assuming the referral code is passed as a query parameter
    try {
        const newStudent = await markettingService.registerStudent(studentData, referralCode);
        res.status(201).json(newStudent);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all students
marketerController.getAllStudents = async (req, res) => {
    try {
        const students = await markettingService.getAllStudents();
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a student by ID
marketerController.getStudentById = async (req, res) => {
    const { id } = req.params;
    try {
        const student = await markettingService.getStudentById(id);
        res.status(200).json(student);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

// Get marketer dashboard stats
marketerController.getMarketerDashboardStats = async (req, res) => {
    const { marketerId } = req.params;
    try {
        const stats = await markettingService.getMarketerDashboardStats(marketerId);
        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get referred students
marketerController.getReferredStudents = async (req, res) => {
    const { marketerId } = req.params;
    try {
        const students = await markettingService.getReferredStudents(marketerId);
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = marketerController;


// const markettingService = require("./../services/markettingService");

// // Create a new marketer
// const createMarketer = async (req, res) => {
//     try {
//         const marketerData = req.body;
//         const newMarketerData = await markettingService.createMarketer(marketerData);
//         res.status(201).json({
//             success: true,
//             message: 'Marketer created successfully',
//             data: newMarketerData
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Error creating marketer'
//         });
//     }
// };

// // Get a marketer by ID
// const getMarketerById = async (req, res) => {
//     try {
//         const getMarketerId = req.params.id;
//         const getMarketer = await markettingService.getMarketerById(getMarketerId);
//         res.status(200).json({
//             success: true,
//             message: 'Marketer record fetched successfully',
//             data: getMarketer
//         });
//     } catch (error) {
//         res.status(404).json({
//             success: false,
//             message: error.message || 'Failed to fetch marketer'
//         });
//     }
// };

// // Get all marketers
// const getAllMarketers = async (req, res) => {
//     try {
//         const marketerData = await markettingService.getAllMarketers();
//         res.status(200).json({
//             success: true,
//             message: 'Marketers data retrieved successfully',
//             data: marketerData
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to retrieve marketers'
//         });
//     }
// };

// // Update a marketer
// const updateMarketer = async (req, res) => {
//     try {
//         const marketerId = req.params.id;
//         const marketerData = req.body;
//         const updatedMarketer = await markettingService.updateMarketer(marketerId, marketerData);
//         res.status(200).json({
//             success: true,
//             message: 'Marketer updated successfully',
//             data: updatedMarketer
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to update marketer'
//         });
//     }
// };

// // Delete a marketer
// const deleteMarketer = async (req, res) => {
//     try {
//         const marketerId = req.params.id;
//         await markettingService.deleteMarketer(marketerId);
//         res.status(200).json({
//             success: true,
//             message: 'Marketer deleted successfully'
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to delete marketer'
//         });
//     }
// };


// const registerStudent = async (req, res) => {
//     const { firstName, lastName, email, password, phoneNumber, location } = req.body;
//     const referralCode = req.query.referralCode; // Get referral code from query params

//     try {
//         const student = await markettingService.registerStudent({
//             firstName,
//             lastName,
//             email,
//             password,
//             phoneNumber,
//             location
//         }, referralCode);

//         return res.status(201).json({
//             success: true,
//             student
//         });
//     } catch (error) {
//         return res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// // Create a new student
// const createStudent = async (req, res) => {
//     try {
//         const studentData = req.body;
//         const newStudentData = await markettingService.createStudent(studentData);
//         res.status(201).json({
//             success: true,
//             message: 'Student created successfully',
//             data: newStudentData
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Error creating student'
//         });
//     }
// };

// // Get all students
// const getAllStudents = async (req, res) => {
//     try {
//         const studentsData = await markettingService.getAllStudents();
//         res.status(200).json({
//             success: true,
//             message: 'Students data retrieved successfully',
//             data: studentsData
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to retrieve students'
//         });
//     }
// };

// // Get a student by ID
// const getStudentById = async (req, res) => {
//     try {
//         const studentId = req.params.id;
//         const studentData = await markettingService.getStudentById(studentId);
//         res.status(200).json({
//             success: true,
//             message: 'Student record fetched successfully',
//             data: studentData
//         });
//     } catch (error) {
//         res.status(404).json({
//             success: false,
//             message: error.message || 'Failed to fetch student'
//         });
//     }
// };

// // Update a student
// const updateStudent = async (req, res) => {
//     try {
//         const studentId = req.params.id;
//         const studentData = req.body;
//         const updatedStudent = await markettingService.updateStudent(studentId, studentData);
//         res.status(200).json({
//             success: true,
//             message: 'Student updated successfully',
//             data: updatedStudent
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to update student'
//         });
//     }
// };

// // Delete a student
// const deleteStudent = async (req, res) => {
//     try {
//         const studentId = req.params.id;
//         await markettingService.deleteStudent(studentId);
//         res.status(200).json({
//             success: true,
//             message: 'Student deleted successfully'
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to delete student'
//         });
//     }
// };

// // Get students by category
// const getStudentsByCategory = async (req, res) => {
//     try {
//         const category = req.params.category;
//         const studentsByCategory = await markettingService.getStudentsByCategory(category);
//         res.status(200).json({
//             success: true,
//             message: 'Students by category retrieved successfully',
//             data: studentsByCategory
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to retrieve students by category'
//         });
//     }
// };

// // Export the functions
// module.exports = {
//     createMarketer,
//     getMarketerById,
//     getAllMarketers,
//     updateMarketer,
//     deleteMarketer,
//     createStudent,
//     getAllStudents,
//     getStudentById,
//     updateStudent,
//     deleteStudent,
//     getStudentsByCategory,
//     registerStudent,
// };
