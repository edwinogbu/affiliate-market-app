const mysql = require('mysql');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');


dotenv.config();

// Create a pool of MySQL connections
const pool = mysql.createPool({
    connectionLimit: process.env.CONNECTION_LIMIT || 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Helper function to execute SQL queries
function query(sql, args) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            connection.query(sql, args, (err, rows) => {
                connection.release();

                if (err) {
                    return reject(err);
                }

                resolve(rows);
            });
        });
    });
}

// Table creation SQL statements
const createCoursesTable = `
    CREATE TABLE IF NOT EXISTS courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        overview TEXT NOT NULL,
        duration VARCHAR(50) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
`;



const createStudentsTable = `
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phoneNumber VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    location VARCHAR(20) NOT NULL,
    referredByMarketerId INT,
    discountReceived BOOLEAN DEFAULT FALSE,
    role ENUM('Admin', 'Referral', 'Student') NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referredByMarketerId) REFERENCES marketters(id) ON DELETE SET NULL
);
`;

const createMarkettersTable = `
  CREATE TABLE IF NOT EXISTS marketters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId INT,
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phoneNumber VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    location VARCHAR(20) NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    amount_earned DECIMAL(15, 2) DEFAULT 0.00,
    service_charge DECIMAL(15, 2) DEFAULT 0.00,
    totalEarning DECIMAL(15, 2) DEFAULT 0.00,
    referralCode VARCHAR(255) NOT NULL UNIQUE,
    referralUrl VARCHAR(255) NOT NULL,
    totalReferrals INT DEFAULT 0,
    role ENUM('Marketer', 'Student') NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const createAdminTable = `
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId INT, 
    marketterId INT,  
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phoneNumber VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Referral', 'Student') NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (marketterId) REFERENCES marketters(id) ON DELETE CASCADE
);
`;

async function createTables() {
    try {
        // Create the students table first
        
        // Then create the marketters table
        await query(createMarkettersTable);
        
        await query(createStudentsTable);
        // Then create the admins table
        await query(createAdminTable);
        
        // Finally create the courses table
        await query(createCoursesTable);
        
        console.log('All tables created successfully');
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
}


createTables();

const markettingService = {};

// Utility function to generate a 6-digit unique voucher number
function generateReferralCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Function to check if a phone number exists
markettingService.phoneExists = async (phoneNumber) => {
    const result = await query(`SELECT id FROM marketters WHERE phoneNumber = ?`, [phoneNumber]);
    return result.length > 0;
};

// Function to check if an email exists
markettingService.emailExists = async (email) => {
    const result = await query(`SELECT id FROM marketters WHERE email = ?`, [email]);
    return result.length > 0;
};


// Get all courses and format them
markettingService.getCourses = async () => {
    try {
        const selectQuery = 'SELECT * FROM courses';
        const rows = await query(selectQuery);

        // Format the course data
        const courses = rows.map(course => ({
            id: course.id, // Include the course ID
            name: course.name,
            price: course.price.toFixed(2), // Format price to two decimal places
            overview: course.overview,
            duration: course.duration
        }));

        return courses;
    } catch (error) {
        throw new Error(`Error retrieving courses: ${error.message}`);
    }
};


markettingService.referralCodeExists = async (referralCode) => {
    try {
        const queryCode = `SELECT id FROM marketters WHERE referralCode = ?`;
        const result = await query(queryCode, [referralCode]);
        return result.length > 0;
    } catch (error) {
        throw error;
    }
};


markettingService.incrementMarketerEarnings = async (id, additionalEarning) => {
    try {
        const updateEarningsQuery = `
            UPDATE marketters
            SET totalEarning = totalEarning + ?
            WHERE id = ?
        `;
        const result = await query(updateEarningsQuery, [additionalEarning, id]);

        if (result.affectedRows === 0) {
            throw new Error(`Marketer with ID ${id} not found`);
        }

        return { message: 'Earnings updated successfully' };
    } catch (error) {
        throw error;
    }
};

function generateReferralCode(marketerId) {
    return `REF-${marketerId}-${Date.now().toString(36)}`;
}

// Generate referral URL based on the referral code
function generateReferralUrl(referralCode) {
    return `https://localhost:3005/api/afiliat/students/register?referralCode=${referralCode}`;
}

// Function to create or update marketer and generate referral URL, referral code, and JWT token
markettingService.createOrUpdateMarketer = async (marketerData) => {
    try {
        const { firstName, lastName, email, phoneNumber, password, location, amount, totalEarning } = marketerData;

         // Hash the password
         const hashedPassword = await bcrypt.hash(password, 12);

        // Insert or update marketer data in `marketters` table
        // const insertOrUpdateMarketerQuery = `
        //     INSERT INTO marketters (firstName, lastName, email, phoneNumber, password, location, amount, totalEarning)
        //     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        //     ON DUPLICATE KEY UPDATE firstName = VALUES(firstName), lastName = VALUES(lastName), email = VALUES(email), phoneNumber = VALUES(phoneNumber),  password = VALUES(password), location = VALUES(location), amount = VALUES(amount), totalEarning = VALUES(totalEarning);
        // `;

        const insertOrUpdateMarketerQuery = `
            INSERT INTO marketters (firstName, lastName, email, phoneNumber, password, location, balance, totalEarning)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE firstName = VALUES(firstName), lastName = VALUES(lastName), email = VALUES(email), phoneNumber = VALUES(phoneNumber), password = VALUES(password), location = VALUES(location), balance = VALUES(balance), totalEarning = VALUES(totalEarning);
        `;

        
        const result = await query(insertOrUpdateMarketerQuery, [firstName, lastName, email, phoneNumber, hashedPassword, location, amount, totalEarning]);
        
        // Get marketer ID (for new insertions, it’s the last inserted ID; for updates, fetch the existing ID)
        const marketerId = result.insertId || (await query(`SELECT id FROM marketters WHERE email = ?`, [email]))[0].id;
        
        // Generate referral code and URL using the marketer ID
        const referralCode = generateReferralCode(marketerId);
        const referralUrl = generateReferralUrl(referralCode);
        
        // Update marketer with the generated referral code and URL
        await query(`UPDATE marketters SET referralCode = ?, referralUrl = ? WHERE id = ?`, [referralCode, referralUrl, marketerId]);
        
        // Generate JWT token using the marketer ID
        const token = jwt.sign(
            { id: marketerId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Return all marketer data
        return {
            id: marketerId,
            firstName,
            lastName,
            email,
            phoneNumber,
            location,
            amount,
            totalEarning,
            referralCode,
            referralUrl,
            token
        };
    } catch (error) {
        throw error;
    }
};


markettingService.getMarketerById = async (id) => {
    try {
        const getMarketerQuery = `SELECT * FROM marketters WHERE id = ?`;
        const result = await query(getMarketerQuery, [id]);
        if (result.length === 0) {
            throw new Error(`Marketer with ID ${id} not found`);
        }
        return result[0];
    } catch (error) {
        throw error;
    }
};


markettingService.getAllMarketers = async () => {
    try {
        const getAllQuery = `SELECT * FROM marketters`;
        const marketers = await query(getAllQuery);
        return marketers;
    } catch (error) {
        throw error;
    }
};


// Function to register a new student
// markettingService.registerStudent = async (studentData, referralCode) => {
//     try {
//         const {
//             firstName,
//             lastName,
//             email,
//             password,
//             phoneNumber,
//             location,
//             role = 'Student'
//         } = studentData;

//         // Check if email or phone already exists
//         const phoneExists = await markettingService.phoneExists(phoneNumber);
//         if (phoneExists) {
//             throw new Error('Phone number already exists');
//         }

//         const emailExists = await markettingService.emailExists(email);
//         if (emailExists) {
//             throw new Error('Email already exists');
//         }

//         // Hash the password
//         const hashedPassword = await bcrypt.hash(password, 12);

//         let referredByMarketerId = null;

//         // Check if a referral code is provided
//         if (referralCode) {
//             // Check if the referral code exists
//             const marketerQuery = `SELECT id FROM marketters WHERE referralCode = ?`;
//             const marketerResult = await query(marketerQuery, [referralCode]);

//             if (marketerResult.length > 0) {
//                 referredByMarketerId = marketerResult[0].id;
//             } else {
//                 throw new Error('Invalid referral code');
//             }
//         }

//         // Insert the new student into the database
//         const insertStudentQuery = `
//             INSERT INTO students (firstName, lastName, email, phoneNumber, location, referredByMarketerId, role)
//             VALUES (?, ?, ?, ?, ?, ?, ?)
//         `;
//         const studentResult = await query(insertStudentQuery, [
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             location,
//             referredByMarketerId,
//             role
//         ]);

//         // Check if student insertion was successful
//         if (!studentResult.insertId) {
//             throw new Error('Failed to register student');
//         }

//         // Generate JWT token for student (optional)
//         const token = jwt.sign({ id: studentResult.insertId }, process.env.JWT_SECRET, { expiresIn: '1d' });

//         return {
//             id: studentResult.insertId,
//             token,
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             location,
//             referredByMarketerId
//         };
//     } catch (error) {
//         throw error;
//     }
// };

// markettingService.registerStudent = async (studentData, referralCode) => {
//     try {
//         const {
//             firstName,
//             lastName,
//             email,
//             password,
//             phoneNumber,
//             location,
//             role = 'Student'
//         } = studentData;

//         // Check if email or phone already exists
//         const phoneExists = await markettingService.phoneExists(phoneNumber);
//         if (phoneExists) {
//             throw new Error('Phone number already exists');
//         }

//         const emailExists = await markettingService.emailExists(email);
//         if (emailExists) {
//             throw new Error('Email already exists');
//         }

//         // Hash the password
//         const hashedPassword = await bcrypt.hash(password, 12);

//         let referredByMarketerId = null;

//         // Check if a referral code is provided
//         if (referralCode) {
//             // Validate the referral code and retrieve the marketer ID
//             const marketerQuery = `SELECT id FROM marketters WHERE referralCode = ?`;
//             const marketerResult = await query(marketerQuery, [referralCode]);

//             if (marketerResult.length > 0) {
//                 referredByMarketerId = marketerResult[0].id;
//             } else {
//                 throw new Error('Invalid referral code');
//             }
//         }

//         // Insert the new student into the database
//         const insertStudentQuery = `
//             INSERT INTO students (firstName, lastName, email, phoneNumber, password, location, referredByMarketerId, role)
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//         `;
//         const studentResult = await query(insertStudentQuery, [
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             hashedPassword,
//             location,
//             referredByMarketerId,
//             role
//         ]);

//         if (!studentResult.insertId) {
//             throw new Error('Failed to register student');
//         }

//         // If referred by a marketer, update the marketer's total referrals
//         if (referredByMarketerId) {
//             const updateMarketerQuery = `
//                 UPDATE marketters
//                 SET totalReferrals = totalReferrals + 1
//                 WHERE id = ?
//             `;
//             await query(updateMarketerQuery, [referredByMarketerId]);
//         }

//         // Generate JWT token for student (optional)
//         const token = jwt.sign({ id: studentResult.insertId }, process.env.JWT_SECRET, { expiresIn: '1d' });

//         return {
//             id: studentResult.insertId,
//             token,
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             location,
//             referredByMarketerId
//         };
//     } catch (error) {
//         throw error;
//     }
// };

markettingService.registerStudent = async (studentData, referralCode) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            phoneNumber,
            location,
            role = 'Student'
        } = studentData;

        // Check if email or phone already exists
        const phoneExists = await markettingService.phoneExists(phoneNumber);
        if (phoneExists) {
            throw new Error('Phone number already exists');
        }

        const emailExists = await markettingService.emailExists(email);
        if (emailExists) {
            throw new Error('Email already exists');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        let referredByMarketerId = null;

        // Check if a referral code is provided
        if (referralCode) {
            // Check if the referral code exists
            const marketerQuery = `SELECT id FROM marketters WHERE referralCode = ?`;
            const marketerResult = await query(marketerQuery, [referralCode]);

            if (marketerResult.length > 0) {
                referredByMarketerId = marketerResult[0].id;

                // Increment the total referrals for the marketer
                const updateReferralsQuery = `
                    UPDATE marketters
                    SET totalReferrals = totalReferrals + 1
                    WHERE id = ?
                `;
                await query(updateReferralsQuery, [referredByMarketerId]);
            } else {
                throw new Error('Invalid referral code');
            }
        }

        // Insert the new student into the database
        const insertStudentQuery = `
            INSERT INTO students (firstName, lastName, email, password, phoneNumber, location, referredByMarketerId, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const studentResult = await query(insertStudentQuery, [
            firstName,
            lastName,
            email,
            hashedPassword,
            phoneNumber,
            location,
            referredByMarketerId,
            role
        ]);

        // Check if student insertion was successful
        if (!studentResult.insertId) {
            throw new Error('Failed to register student');
        }

        // Generate JWT token for student
        const token = jwt.sign({ id: studentResult.insertId }, process.env.JWT_SECRET, { expiresIn: '1d' });

        // Return response data with hashed password
        return {
            id: studentResult.insertId,
            token,
            firstName,
            lastName,
            email,
            phoneNumber,
            location,
            referredByMarketerId,
            password: hashedPassword, // Return hashed password as value for "password"
        };
    } catch (error) {
        throw error;
    }
};


markettingService.getAllStudents = async () => {
    try {
        const getAllStudentsQuery = `SELECT * FROM students`;
        const students = await query(getAllStudentsQuery);
        return students;
    } catch (error) {
        throw error;
    }
};

markettingService.getStudentById = async (id) => {
    try {
        const getStudentQuery = `SELECT * FROM students WHERE id = ?`;
        const result = await query(getStudentQuery, [id]);
        if (result.length === 0) {
            throw new Error(`Student with ID ${id} not found`);
        }
        return result[0];
    } catch (error) {
        throw error;
    }
};

// Get total referrals and bonuses for a marketer
markettingService.getMarketerDashboardStats = async (marketerId) => {
    try {
        const referralStatsQuery = `
            SELECT 
                COUNT(students.id) AS totalReferrals,
                marketters.totalEarning AS totalBonuses
            FROM 
                students
            JOIN 
                marketters ON students.referredByMarketerId = marketters.id
            WHERE 
                marketters.id = ?;
        `;

        const result = await query(referralStatsQuery, [marketerId]);
        return result[0]; // Should return { totalReferrals: x, totalBonuses: y }
    } catch (error) {
        throw error;
    }
};

// Get all referred students for a specific marketer
markettingService.getReferredStudents = async (marketerId) => {
    try {
        const studentsQuery = `
            SELECT 
                id, firstName, lastName, email, discountReceived, createdAt
            FROM 
                students
            WHERE 
                referredByMarketerId = ?;
        `;
        const students = await query(studentsQuery, [marketerId]);
        return students;
    } catch (error) {
        throw error;
    }
};


module.exports = markettingService;



// const mysql = require('mysql');
// const dotenv = require('dotenv');

// dotenv.config();

// // Create a pool of MySQL connections
// const pool = mysql.createPool({
//     connectionLimit: process.env.CONNECTION_LIMIT || 10,
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
// });

// // Helper function to execute SQL queries
// function query(sql, args) {
//     return new Promise((resolve, reject) => {
//         pool.getConnection((err, connection) => {
//             if (err) {
//                 return reject(err);
//             }

//             connection.query(sql, args, (err, rows) => {
//                 connection.release();

//                 if (err) {
//                     return reject(err);
//                 }

//                 resolve(rows);
//             });
//         });
//     });
// }

// // Table creation SQL statements
// const createCoursesTable = `
//     CREATE TABLE IF NOT EXISTS courses (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         name VARCHAR(100) NOT NULL,
//         price DECIMAL(10, 2) NOT NULL,
//         overview TEXT NOT NULL,
//         duration VARCHAR(50) NOT NULL,
//         createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     );
// `;



// const createStudentsTable = `
// CREATE TABLE IF NOT EXISTS students (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     firstName VARCHAR(50) NOT NULL,
//     lastName VARCHAR(50) NOT NULL,
//     email VARCHAR(100) NOT NULL UNIQUE,
//     phoneNumber VARCHAR(20) NOT NULL,
//     location VARCHAR(20) NOT NULL,
//     referredByMarketerId INT,
//     discountReceived BOOLEAN DEFAULT FALSE,
//     role ENUM('Admin', 'Referral', 'Student') NOT NULL,
//     createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     FOREIGN KEY (referredByMarketerId) REFERENCES marketters(id) ON DELETE SET NULL
// );
// `;

// const createMarkettersTable = `
//   CREATE TABLE IF NOT EXISTS marketters (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     studentId INT,
//     firstName VARCHAR(50) NOT NULL,
//     lastName VARCHAR(50) NOT NULL,
//     email VARCHAR(100) NOT NULL UNIQUE,
//     phoneNumber VARCHAR(20) NOT NULL,
//     location VARCHAR(20) NOT NULL,
//     amount DECIMAL(15, 2) NOT NULL,
//     totalEarning DECIMAL(15, 2) NOT NULL,
//     referralCode VARCHAR(255) NOT NULL UNIQUE,
//     referralUrl VARCHAR(255) NOT NULL,
//     totalReferrals INT DEFAULT 0,
//     role ENUM('Marketer', 'Student') NOT NULL,
//     createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );
// `;

// const createAdminTable = `
// CREATE TABLE IF NOT EXISTS admins (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     studentId INT, 
//     marketterId INT,  
//     firstName VARCHAR(50) NOT NULL,
//     lastName VARCHAR(50) NOT NULL,
//     email VARCHAR(100) NOT NULL UNIQUE,
//     phoneNumber VARCHAR(20) NOT NULL,
//     role ENUM('Admin', 'Referral', 'Student') NOT NULL,
//     createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
//     FOREIGN KEY (marketterId) REFERENCES marketters(id) ON DELETE CASCADE
// );
// `;

// async function createTables() {
//     try {
//         // Create the students table first
        
//         // Then create the marketters table
//         await query(createMarkettersTable);
        
//         await query(createStudentsTable);
//         // Then create the admins table
//         await query(createAdminTable);
        
//         // Finally create the courses table
//         await query(createCoursesTable);
        
//         console.log('All tables created successfully');
//     } catch (error) {
//         console.error('Error creating tables:', error);
//         throw error;
//     }
// }


// createTables();

// const markettingService = {};

// // Utility function to generate a 6-digit unique voucher number
// function generateReferralCode() {
//     return Math.floor(100000 + Math.random() * 900000).toString();
// }

// // Function to check if a phone number exists
// markettingService.phoneExists = async (phoneNumber) => {
//     const result = await query(`SELECT id FROM marketters WHERE phoneNumber = ?`, [phoneNumber]);
//     return result.length > 0;
// };

// // Function to check if an email exists
// markettingService.emailExists = async (email) => {
//     const result = await query(`SELECT id FROM marketters WHERE email = ?`, [email]);
//     return result.length > 0;
// };


// // Get all courses and format them
// markettingService.getCourses = async () => {
//     try {
//         const selectQuery = 'SELECT * FROM courses';
//         const rows = await query(selectQuery);

//         // Format the course data
//         const courses = rows.map(course => ({
//             id: course.id, // Include the course ID
//             name: course.name,
//             price: course.price.toFixed(2), // Format price to two decimal places
//             overview: course.overview,
//             duration: course.duration
//         }));

//         return courses;
//     } catch (error) {
//         throw new Error(`Error retrieving courses: ${error.message}`);
//     }
// };



// // Function to create a new marketer
// // markettingService.createMarketer = async (marketerData) => {
// //     try {
// //         const {
// //             studentId,
// //             firstName,
// //             lastName,
// //             email,
// //             password,
// //             phoneNumber,
// //             location,
// //             amount,
// //             totalEarning,
// //             referralCode,
// //             referralUrl,
// //             role = 'Marketer'
// //         } = marketerData;

// //         // Check if email or phone already exists
// //         const phoneExists = await markettingService.phoneExists(phoneNumber);
// //         if (phoneExists) {
// //             throw new Error('Phone number already exists');
// //         }

// //         const emailExists = await markettingService.emailExists(email);
// //         if (emailExists) {
// //             throw new Error('Email already exists');
// //         }

// //         // Hash the password
// //         const hashedPassword = await bcrypt.hash(password, 12);

// //         // Generate referral code if not provided
// //         const generatedReferralCode = referralCode || generateReferralCode();

// //         // Insert data into marketters table
// //         const insertMarketerQuery = `
// //             INSERT INTO marketters (studentId, firstName, lastName, email, phoneNumber, location, amount, totalEarning, referralCode, referralUrl, role)
// //             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
// //         `;
// //         const marketerResult = await query(insertMarketerQuery, [
// //             studentId,
// //             firstName,
// //             lastName,
// //             email,
// //             phoneNumber,
// //             location,
// //             amount,
// //             totalEarning,
// //             generatedReferralCode,
// //             referralUrl,
// //             role
// //         ]);

// //         // Retrieve marketerId
// //         const marketerId = marketerResult.insertId;

// //         // Insert data into users table with marketerId
// //         const insertUserQuery = `
// //             INSERT INTO users (firstName, lastName, email, phone, password, role, userType, marketerId)
// //             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
// //         `;
// //         const userResult = await query(insertUserQuery, [
// //             firstName,
// //             lastName,
// //             email,
// //             phoneNumber,
// //             hashedPassword,
// //             'user',
// //             'Marketer',
// //             marketerId
// //         ]);

// //         // Check if user insertion was successful
// //         if (!userResult.insertId) {
// //             throw new Error('Failed to insert user');
// //         }

// //         // Generate JWT token
// //         const token = jwt.sign({ id: userResult.insertId }, process.env.JWT_SECRET, { expiresIn: '1d' });

// //         // Return the newly created marketer data along with the token
// //         return {
// //             id: userResult.insertId,
// //             token,
// //             ...marketerData,
// //             referralCode: generatedReferralCode
// //         };

// //     } catch (error) {
// //         throw error;
// //     }
// // };


// markettingService.referralCodeExists = async (referralCode) => {
//     try {
//         const queryCode = `SELECT id FROM marketters WHERE referralCode = ?`;
//         const result = await query(queryCode, [referralCode]);
//         return result.length > 0;
//     } catch (error) {
//         throw error;
//     }
// };


// markettingService.incrementMarketerEarnings = async (id, additionalEarning) => {
//     try {
//         const updateEarningsQuery = `
//             UPDATE marketters
//             SET totalEarning = totalEarning + ?
//             WHERE id = ?
//         `;
//         const result = await query(updateEarningsQuery, [additionalEarning, id]);

//         if (result.affectedRows === 0) {
//             throw new Error(`Marketer with ID ${id} not found`);
//         }

//         return { message: 'Earnings updated successfully' };
//     } catch (error) {
//         throw error;
//     }
// };

// function generateReferralCode(marketerId) {
//     return `REF-${marketerId}-${Date.now().toString(36)}`;
// }

// // Generate referral URL based on the referral code
// function generateReferralUrl(referralCode) {
//     return `https://pagetechnology.com/register?referralCode=${referralCode}`;
// }

// // Function to create or update marketer with a referral URL
// markettingService.createOrUpdateMarketer = async (marketerData) => {
//     try {
//         // Extract marketer data
//         const { id, firstName, lastName, email, phoneNumber, amount, totalEarning } = marketerData;

//         // Generate referral code and URL
//         const referralCode = generateReferralCode(id);
//         const referralUrl = generateReferralUrl(referralCode);

//         // Insert or update marketer data in `marketters` table
//         const insertOrUpdateMarketerQuery = `
//             INSERT INTO marketters (id, firstName, lastName, email, phoneNumber, amount, totalEarning, referralCode, referralUrl)
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//             ON DUPLICATE KEY UPDATE referralCode = VALUES(referralCode), referralUrl = VALUES(referralUrl);
//         `;
//         await query(insertOrUpdateMarketerQuery, [
//             id, firstName, lastName, email, phoneNumber, amount, totalEarning, referralCode, referralUrl
//         ]);

//         return { referralCode, referralUrl };
//     } catch (error) {
//         throw error;
//     }
// };


// // Function to register a new student
// markettingService.registerStudent = async (studentData, referralCode) => {
//     try {
//         const {
//             firstName,
//             lastName,
//             email,
//             password,
//             phoneNumber,
//             location,
//             role = 'Student'
//         } = studentData;

//         // Check if email or phone already exists
//         const phoneExists = await markettingService.phoneExists(phoneNumber);
//         if (phoneExists) {
//             throw new Error('Phone number already exists');
//         }

//         const emailExists = await markettingService.emailExists(email);
//         if (emailExists) {
//             throw new Error('Email already exists');
//         }

//         // Hash the password
//         const hashedPassword = await bcrypt.hash(password, 12);

//         let referredByMarketerId = null;

//         // Check if a referral code is provided
//         if (referralCode) {
//             // Check if the referral code exists
//             const marketerQuery = `SELECT id FROM marketters WHERE referralCode = ?`;
//             const marketerResult = await query(marketerQuery, [referralCode]);

//             if (marketerResult.length > 0) {
//                 referredByMarketerId = marketerResult[0].id;
//             } else {
//                 throw new Error('Invalid referral code');
//             }
//         }

//         // Insert the new student into the database
//         const insertStudentQuery = `
//             INSERT INTO students (firstName, lastName, email, phoneNumber, location, referredByMarketerId, role)
//             VALUES (?, ?, ?, ?, ?, ?, ?)
//         `;
//         const studentResult = await query(insertStudentQuery, [
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             location,
//             referredByMarketerId,
//             role
//         ]);

//         // Check if student insertion was successful
//         if (!studentResult.insertId) {
//             throw new Error('Failed to register student');
//         }

//         // Generate JWT token for student (optional)
//         const token = jwt.sign({ id: studentResult.insertId }, process.env.JWT_SECRET, { expiresIn: '1d' });

//         return {
//             id: studentResult.insertId,
//             token,
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             location,
//             referredByMarketerId
//         };
//     } catch (error) {
//         throw error;
//     }
// };




// markettingService.getMarketerById = async (id) => {
//     try {
//         const getMarketerQuery = `SELECT * FROM marketters WHERE id = ?`;
//         const result = await query(getMarketerQuery, [id]);
//         if (result.length === 0) {
//             throw new Error(`Marketer with ID ${id} not found`);
//         }
//         return result[0];
//     } catch (error) {
//         throw error;
//     }
// };


// markettingService.getAllMarketers = async () => {
//     try {
//         const getAllQuery = `SELECT * FROM marketters`;
//         const marketers = await query(getAllQuery);
//         return marketers;
//     } catch (error) {
//         throw error;
//     }
// };

// //  updateMarketers 
// markettingService.updateMarketer = async (id, updatedData) => {
//     try {
//         const {
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             location,
//             amount,
//             totalEarning,
//             referralCode,
//             referralUrl,
//             role
//         } = updatedData;

//         // Update the marketer's information
//         const updateMarketerQuery = `
//             UPDATE marketters
//             SET 
//                 firstName = ?,
//                 lastName = ?,
//                 email = ?,
//                 phoneNumber = ?,
//                 location = ?,
//                 amount = ?,
//                 totalEarning = ?,
//                 referralCode = ?,
//                 referralUrl = ?,
//                 role = ?
//             WHERE id = ?
//         `;

//         const result = await query(updateMarketerQuery, [
//             firstName,
//             lastName,
//             email,
//             phoneNumber,
//             location,
//             amount,
//             totalEarning,
//             referralCode,
//             referralUrl,
//             role,
//             id
//         ]);

//         if (result.affectedRows === 0) {
//             throw new Error(`Marketer with ID ${id} not found`);
//         }

//         // Return the updated marketer's data
//         return { message: 'Marketer updated successfully' };
//     } catch (error) {
//         throw error;
//     }
// };



// markettingService.deleteMarketer = async (id) => {
//     try {
//         // Delete the marketer's entry in the users table first (if there's a foreign key constraint)
//         const deleteUserQuery = `DELETE FROM users WHERE marketerId = ?`;
//         await query(deleteUserQuery, [id]);

//         // Delete marketer from marketters table
//         const deleteMarketerQuery = `DELETE FROM marketters WHERE id = ?`;
//         const result = await query(deleteMarketerQuery, [id]);

//         if (result.affectedRows === 0) {
//             throw new Error(`Marketer with ID ${id} not found`);
//         }

//         return { message: 'Marketer deleted successfully' };
//     } catch (error) {
//         throw error;
//     }
// };


// markettingService.createStudent = async (studentData) => {
//     try {
//         const { firstName, lastName, email, phoneNumber, location, preferredCourse, category } = studentData;
//         let { referralCode } = studentData;

//         // Check if email or phone already exists
//         const emailExists = await query(`SELECT id FROM students WHERE email = ?`, [email]);
//         if (emailExists.length > 0) {
//             throw new Error('Email already exists');
//         }

//         const phoneExists = await query(`SELECT id FROM students WHERE phoneNumber = ?`, [phoneNumber]);
//         if (phoneExists.length > 0) {
//             throw new Error('Phone number already exists');
//         }

//         // Generate a referral code if not provided
//         if (!referralCode) {
//             referralCode = generateReferralCode();
//         }

//         // Insert student into students table
//         const insertStudentQuery = `
//             INSERT INTO students (firstName, lastName, email, phoneNumber, location, preferredCourse, category, referralCode, role)
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Student')
//         `;
//         const result = await query(insertStudentQuery, [firstName, lastName, email, phoneNumber, location, preferredCourse, category, referralCode]);

//         // Return created student data
//         return { id: result.insertId, referralCode, ...studentData };
//     } catch (error) {
//         throw error;
//     }
// };

// markettingService.getAllStudents = async () => {
//     try {
//         const getAllStudentsQuery = `SELECT * FROM students`;
//         const students = await query(getAllStudentsQuery);
//         return students;
//     } catch (error) {
//         throw error;
//     }
// };

// markettingService.getStudentById = async (id) => {
//     try {
//         const getStudentQuery = `SELECT * FROM students WHERE id = ?`;
//         const result = await query(getStudentQuery, [id]);
//         if (result.length === 0) {
//             throw new Error(`Student with ID ${id} not found`);
//         }
//         return result[0];
//     } catch (error) {
//         throw error;
//     }
// };


// markettingService.updateStudent = async (id, updatedData) => {
//     try {
//         const { phoneNumber, location, preferredCourse, category } = updatedData;

//         // Check if the phone number is already in use by another student
//         if (phoneNumber) {
//             const phoneExistsQuery = `SELECT id FROM students WHERE phoneNumber = ? AND id != ?`;
//             const phoneExists = await query(phoneExistsQuery, [phoneNumber, id]);
//             if (phoneExists.length > 0) {
//                 throw new Error('Phone number already exists for another student');
//             }
//         }

//         // Update student data
//         const updateStudentQuery = `
//             UPDATE students
//             SET phoneNumber = COALESCE(?, phoneNumber),
//                 location = COALESCE(?, location),
//                 preferredCourse = COALESCE(?, preferredCourse),
//                 category = COALESCE(?, category)
//             WHERE id = ?
//         `;
//         const result = await query(updateStudentQuery, [phoneNumber, location, preferredCourse, category, id]);

//         if (result.affectedRows === 0) {
//             throw new Error(`Student with ID ${id} not found`);
//         }

//         return { message: 'Student updated successfully' };
//     } catch (error) {
//         throw error;
//     }
// };

// markettingService.deleteStudent = async (id) => {
//     try {
//         const deleteStudentQuery = `DELETE FROM students WHERE id = ?`;
//         const result = await query(deleteStudentQuery, [id]);

//         if (result.affectedRows === 0) {
//             throw new Error(`Student with ID ${id} not found`);
//         }

//         return { message: 'Student deleted successfully' };
//     } catch (error) {
//         throw error;
//     }
// };

// markettingService.getStudentsByCategory = async (category) => {
//     try {
//         const getByCategoryQuery = `SELECT * FROM students WHERE category = ?`;
//         const students = await query(getByCategoryQuery, [category]);
//         return students;
//     } catch (error) {
//         throw error;
//     }
// };



// // Get total referrals and bonuses for a marketer
// markettingService.getMarketerDashboardStats = async (marketerId) => {
//     try {
//         const referralStatsQuery = `
//             SELECT 
//                 COUNT(students.id) AS totalReferrals,
//                 marketters.totalEarning AS totalBonuses
//             FROM 
//                 students
//             JOIN 
//                 marketters ON students.referredByMarketerId = marketters.id
//             WHERE 
//                 marketters.id = ?;
//         `;

//         const result = await query(referralStatsQuery, [marketerId]);
//         return result[0]; // Should return { totalReferrals: x, totalBonuses: y }
//     } catch (error) {
//         throw error;
//     }
// };

// // Get all referred students for a specific marketer
// markettingService.getReferredStudents = async (marketerId) => {
//     try {
//         const studentsQuery = `
//             SELECT 
//                 id, firstName, lastName, email, discountReceived, createdAt
//             FROM 
//                 students
//             WHERE 
//                 referredByMarketerId = ?;
//         `;
//         const students = await query(studentsQuery, [marketerId]);
//         return students;
//     } catch (error) {
//         throw error;
//     }
// };


// module.exports = markettingService;
