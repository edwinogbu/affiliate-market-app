const mysql = require('mysql');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt'); // Optional, for hashing pins

dotenv.config();

// Create a pool of MySQL connections
const pool = mysql.createPool({
    connectionLimit: process.env.CONNECTION_LIMIT,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Helper function to execute SQL queries
function query(sql, args) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) return reject(err);
            connection.query(sql, args, (err, rows) => {
                connection.release();
                if (err) return reject(err);
                resolve(rows);
            });
        });
    });
}

// Create Pins table if it doesn't exist
const createPinsTableQuery = `
CREATE TABLE IF NOT EXISTS pins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pin_code VARCHAR(255) NOT NULL,  -- Adjusted for hashed length if using bcrypt
    studentId INT DEFAULT NULL,
    marketerId INT DEFAULT NULL,
    walletId INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (marketerId) REFERENCES marketers(id) ON DELETE CASCADE,
    FOREIGN KEY (walletId) REFERENCES wallets(id) ON DELETE CASCADE,
    CONSTRAINT chk_student_marketer CHECK (
        (studentId IS NOT NULL AND marketerId IS NULL) OR
        (studentId IS NULL AND marketerId IS NOT NULL)
    )
);
`;

// Execute table creation for Pins
async function createPinsTable() {
    try {
        await query(createPinsTableQuery);
        console.log('Pins table created successfully');
    } catch (error) {
        console.error('Error creating Pins table:', error);
    }
}

// Call to create Pins table
(async () => {
    await createPinsTable();
})();

// CRUD operations for Wallets, Transactions, and Pins
const pinServices = {};

// Utility to hash the pin code (if desired for added security)
async function hashPin(pin) {
    const saltRounds = 10;
    return await bcrypt.hash(pin, saltRounds);
}

// === Pin CRUD Operations ===

// Create a pin for a student's wallet
pinServices.createStudentPin = async (pinData) => {
    try {
        const hashedPin = await hashPin(pinData.pin_code);
        const sql = `INSERT INTO pins (pin_code, studentId, walletId) VALUES (?, ?, ?)`;
        const args = [hashedPin, pinData.studentId, pinData.walletId];
        return query(sql, args);
    } catch (error) {
        console.error('Error creating student pin:', error);
        throw error;
    }
};

// Create a pin for a marketer's wallet
pinServices.createMarketerPin = async (pinData) => {
    try {
        const hashedPin = await hashPin(pinData.pin_code);
        const sql = `INSERT INTO pins (pin_code, marketerId, walletId) VALUES (?, ?, ?)`;
        const args = [hashedPin, pinData.marketerId, pinData.walletId];
        return query(sql, args);
    } catch (error) {
        console.error('Error creating marketer pin:', error);
        throw error;
    }
};

// Retrieve pin details by student ID
pinServices.getStudentPin = async (studentId) => {
    try {
        const sql = `SELECT * FROM pins WHERE studentId = ?`;
        return query(sql, [studentId]);
    } catch (error) {
        console.error('Error retrieving student pin:', error);
        throw error;
    }
};

// Retrieve pin details by marketer ID
pinServices.getMarketerPin = async (marketerId) => {
    try {
        const sql = `SELECT * FROM pins WHERE marketerId = ?`;
        return query(sql, [marketerId]);
    } catch (error) {
        console.error('Error retrieving marketer pin:', error);
        throw error;
    }
};

// Update a pin by student ID and wallet ID
pinServices.updateStudentPin = async (studentId, walletId, newPinCode) => {
    try {
        const hashedPin = await hashPin(newPinCode);
        const sql = `UPDATE pins SET pin_code = ? WHERE studentId = ? AND walletId = ?`;
        return query(sql, [hashedPin, studentId, walletId]);
    } catch (error) {
        console.error('Error updating student pin:', error);
        throw error;
    }
};

// Update a pin by marketer ID and wallet ID
pinServices.updateMarketerPin = async (marketerId, walletId, newPinCode) => {
    try {
        const hashedPin = await hashPin(newPinCode);
        const sql = `UPDATE pins SET pin_code = ? WHERE marketerId = ? AND walletId = ?`;
        return query(sql, [hashedPin, marketerId, walletId]);
    } catch (error) {
        console.error('Error updating marketer pin:', error);
        throw error;
    }
};

// Delete a pin by student ID and wallet ID
pinServices.deleteStudentPin = async (studentId, walletId) => {
    try {
        const sql = `DELETE FROM pins WHERE studentId = ? AND walletId = ?`;
        return query(sql, [studentId, walletId]);
    } catch (error) {
        console.error('Error deleting student pin:', error);
        throw error;
    }
};

// Delete a pin by marketer ID and wallet ID
pinServices.deleteMarketerPin = async (marketerId, walletId) => {
    try {
        const sql = `DELETE FROM pins WHERE marketerId = ? AND walletId = ?`;
        return query(sql, [marketerId, walletId]);
    } catch (error) {
        console.error('Error deleting marketer pin:', error);
        throw error;
    }
};

module.exports = pinServices;


// const mysql = require('mysql');
// const dotenv = require('dotenv');

// dotenv.config();

// // Create a pool of MySQL connections
// const pool = mysql.createPool({
//     connectionLimit: process.env.CONNECTION_LIMIT,
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

// // Create Pins table if it doesn't exist
// const createPinsTableQuery = `
// CREATE TABLE IF NOT EXISTS pins (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     pin_code VARCHAR(10) NOT NULL,
//     studentId INT DEFAULT NULL,
//     marketterId INT DEFAULT NULL,
//     walletId INT NOT NULL,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
//     FOREIGN KEY (marketterId) REFERENCES marketters(id) ON DELETE CASCADE,
//     FOREIGN KEY (walletId) REFERENCES wallets(id) ON DELETE CASCADE,
//     CONSTRAINT chk_student_marketer CHECK (
//         (studentId IS NOT NULL AND marketterId IS NULL) OR
//         (studentId IS NULL AND marketterId IS NOT NULL)
//     )
// );
// `;

// // Execute table creation for Pins
// async function createPinsTable() {
//     try {
//         await query(createPinsTableQuery);
//         console.log('Pins table created successfully');
//     } catch (error) {
//         console.error('Error creating Pins table:', error);
//     }
// }

// // Call to create Pins table
// (async () => {
//     await createPinsTable();
// })();

// // CRUD operations for Wallets, Transactions, and Pins
// const pinServices = {};

// // === Pin CRUD Operations ===

// // Create a pin for a student's wallet
// pinServices.createStudentPin = async (pinData) => {
//     const sql = `INSERT INTO pins (pin_code, studentId, walletId) VALUES (?, ?, ?)`;
//     const args = [
//         pinData.pin_code,
//         pinData.studentId || null,
//         pinData.walletId
//     ];
//     return query(sql, args);
// };

// // Create a pin for a marketer's wallet
// pinServices.createMarketerPin = async (pinData) => {
//     const sql = `INSERT INTO pins (pin_code, marketterId, walletId) VALUES (?, ?, ?)`;
//     const args = [
//         pinData.pin_code,
//         pinData.marketterId || null,
//         pinData.walletId
//     ];
//     return query(sql, args);
// };

// // Retrieve pin details by student ID
// pinServices.getStudentPin = async (studentId) => {
//     const sql = `SELECT * FROM pins WHERE studentId = ?`;
//     const args = [studentId];
//     return query(sql, args);
// };

// // Retrieve pin details by marketer ID
// pinServices.getMarketerPin = async (marketerId) => {
//     const sql = `SELECT * FROM pins WHERE marketterId = ?`;
//     const args = [marketerId];
//     return query(sql, args);
// };

// // Update a pin by student ID and wallet ID
// pinServices.updateStudentPin = async (studentId, walletId, newPinCode) => {
//     const sql = `UPDATE pins SET pin_code = ? WHERE studentId = ? AND walletId = ?`;
//     const args = [newPinCode, studentId, walletId];
//     return query(sql, args);
// };

// // Update a pin by marketer ID and wallet ID
// pinServices.updateMarketerPin = async (marketerId, walletId, newPinCode) => {
//     const sql = `UPDATE pins SET pin_code = ? WHERE marketterId = ? AND walletId = ?`;
//     const args = [newPinCode, marketerId, walletId];
//     return query(sql, args);
// };

// // Delete a pin by student ID and wallet ID
// pinServices.deleteStudentPin = async (studentId, walletId) => {
//     const sql = `DELETE FROM pins WHERE studentId = ? AND walletId = ?`;
//     const args = [studentId, walletId];
//     return query(sql, args);
// };

// // Delete a pin by marketer ID and wallet ID
// pinServices.deleteMarketerPin = async (marketerId, walletId) => {
//     const sql = `DELETE FROM pins WHERE marketterId = ? AND walletId = ?`;
//     const args = [marketerId, walletId];
//     return query(sql, args);
// };

// module.exports = pinServices;
