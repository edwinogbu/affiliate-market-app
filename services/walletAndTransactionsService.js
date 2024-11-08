
const mysql = require('mysql');
const dotenv = require('dotenv');

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
        // Get a connection from the pool
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            // Execute the query using the acquired connection
            connection.query(sql, args, (err, rows) => {
                // Release the connection back to the pool
                connection.release();

                if (err) {
                    return reject(err);
                }

                resolve(rows);
            });
        });
    });
}

// Create Wallets table if it doesn't exist
const createWalletsTableQuery = `
CREATE TABLE IF NOT EXISTS wallets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet_type ENUM('student', 'marketter') NOT NULL,
    studentId INT,
    marketterId INT,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    merchant_fee DECIMAL(15, 2) DEFAULT 0.00,
    service_charge DECIMAL(15, 2) DEFAULT 0.00,
    FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (marketterId) REFERENCES marketters(id) ON DELETE CASCADE
);
`;




const createTransactionsTableQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId INT, 
    marketterId INT,  
    transaction_type ENUM('credit', 'debit', 'transfer') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    transaction_status ENUM('pending', 'accepted', 'processed', 'rejected') DEFAULT 'pending',
    customer_transaction_approval ENUM('incomplete', 'completed', 'unsatisfactory') DEFAULT 'incomplete',
    fee DECIMAL(15, 2) DEFAULT 0.00,
    metadata JSON,
    transaction_hash VARCHAR(255),
    confirmations INT DEFAULT 0,
    transaction_fee_currency VARCHAR(10),
    transaction_fee_amount DECIMAL(15, 2) DEFAULT 0.00,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    status_message TEXT,
    transaction_category ENUM('transfer', 'payment', 'refund') NOT NULL,
    merchant_fee_amount DECIMAL(15, 2) DEFAULT 0.00,
    FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (marketterId) REFERENCES marketters(id) ON DELETE CASCADE
);

`

// Alter Wallets table to add nullable reference column
const alterWalletsTableQuery = `
    ALTER TABLE wallets
    ADD COLUMN service_charge DECIMAL(15, 2) DEFAULT 0.00;

    ADD COLUMN reference VARCHAR(255) NULL,
    ADD UNIQUE KEY reference (reference);
`;

// Alter Wallets table to add nullable reference column
const alterTransactionsTableQuery = `
    ALTER TABLE transactions
    ADD COLUMN service_charge DECIMAL(15, 2) DEFAULT 0.00;


    ADD COLUMN  transaction_disput_message TEXT DEFAULT NULL, 
    ADD COLUMN metadata JSON DEFAULT NULL, 
    ADD COLUMN transaction_hash VARCHAR(255) DEFAULT NULL;


`;

// Function to create Wallets table
async function createWalletsTable() {
    try {
        await query(createWalletsTableQuery);
        console.log('Wallets table created successfully');
    } catch (error) {
        console.error('Error creating Wallets table:', error);
    }
}


// Function to alter Wallets table
async function alterWalletsTable() {
    try {
        await query(alterWalletsTableQuery);
        await query(alterTransactionsTableQuery);
        console.log('Wallets table altered successfully');
    } catch (error) {
        console.error('Error altering Wallets table:', error);
    }
}


// Execute table creation and alteration queries
(async () => {
    await createWalletsTable();
    // await alterWalletsTable();
    await query(createTransactionsTableQuery);
    console.log('Tables created successfully');
})();

// CRUD operations for Wallets and Transactions
const walletAndTransactionsService = {};

// Create a wallet for a student
walletAndTransactionsService.createStudentsWallet = async (studentId) => {
    const sql = `INSERT INTO wallets (wallet_type, studentId) VALUES (?, ?)`;
    const args = ['student', studentId];
    return query(sql, args);
};

// Create a wallet for a marketer
// walletAndTransactionsService.createMarketersWallet = async (marketerId) => {
//     const sql = `INSERT INTO wallets (wallet_type, marketterId, balance) VALUES (?, ?, ?)`;
//     const args = ['marketter', marketerId];
//     return query(sql, args);
// };


// Create a wallet for a marketer and return full wallet details
// walletAndTransactionsService.createMarketersWallet = async (marketerId) => {
//     const sql = `
//         INSERT INTO wallets (wallet_type, marketterId, balance)
//         VALUES (?, ?, ?);
//         SELECT * FROM wallets WHERE id = LAST_INSERT_ID();
//     `;
//     const args = ['marketter', marketerId, 0.00];

//     // Execute both the insert and select in a single query
//     const result = await query(sql, args);

//     // Return the wallet data from the second query result
//     return result[1][0]; // MySQL returns results as an array, so we use [1][0] for the second query's first row
// };



// walletAndTransactionsService.createMarketersWallet = async (marketerId) => {
//     try {
//         // Query to check if a wallet exists for the marketer
//         const walletExistsQuery = `SELECT * FROM wallets WHERE marketterId = ?`;
//         const walletRows = await query(walletExistsQuery, [marketerId]);
        
//         if (walletRows.length > 0) {
//             // Wallet exists, return the existing wallet data
//             return {
//                 status: 200,
//                 message: 'Wallet already exists.',
//                 data: walletRows[0]
//             };
//         } else {
//             // Wallet does not exist, so create a new one
//             const createWalletQuery = `
//                 INSERT INTO wallets (wallet_type, marketterId, balance)
//                 VALUES (?, ?, ?);
//             `;
//             const createWalletArgs = ['marketter', marketerId, 0.00];
            
//             // Insert the new wallet
//             const result = await query(createWalletQuery, createWalletArgs);
            
//             // Retrieve the newly created wallet data using the inserted ID
//             const newWalletQuery = `SELECT * FROM wallets WHERE id = ?`;
//             const newWalletData = await query(newWalletQuery, [result.insertId]);
            
//             // Return the newly created wallet data
//             return {
//                 status: 201,
//                 message: 'Wallet created successfully.',
//                 data: newWalletData[0]  // Access the newly created wallet data
//             };
//         }
//     } catch (error) {
//         console.error('Error in createOrGetMarketersWallet:', error);
//         return {
//             status: 500,
//             message: 'An error occurred while creating or retrieving the wallet.',
//             error: error.message
//         };
//     }
// };

walletAndTransactionsService.createMarketersWallet = async (marketerId) => {
    try {
        // Query to check if a wallet exists for the marketer
        const walletExistsQuery = `
            SELECT id, wallet_type, marketterId, balance, merchant_fee, service_charge
            FROM wallets
            WHERE marketterId = ?
        `;
        const walletRows = await query(walletExistsQuery, [marketerId]);
        
        if (walletRows.length > 0) {
            // Wallet exists, return the existing wallet data
            return {
                status: 200,
                message: 'Wallet already exists.',
                data: walletRows[0] // Select the first row, which contains the wallet details
            };
        } else {
            // Wallet does not exist, so create a new one
            const createWalletQuery = `
                INSERT INTO wallets (wallet_type, marketterId, balance, merchant_fee, service_charge)
                VALUES (?, ?, 0.00, 0.00, 0.00);
            `;
            const createWalletArgs = ['marketter', marketerId];
            
            // Insert the new wallet
            const result = await query(createWalletQuery, createWalletArgs);
            
            // Retrieve the newly created wallet data using the inserted ID
            const newWalletQuery = `
                SELECT id, wallet_type, marketterId, balance, merchant_fee, service_charge
                FROM wallets
                WHERE id = ?
            `;
            const newWalletData = await query(newWalletQuery, [result.insertId]);
            
            // Return the newly created wallet data in the desired format
            return {
                status: 201,
                message: 'Wallet created successfully.',
                data: newWalletData[0] // Select the first row with the new wallet details
            };
        }
    } catch (error) {
        console.error('Error in createOrGetMarketersWallet:', error);
        return {
            status: 500,
            message: 'An error occurred while creating or retrieving the wallet.',
            error: error.message
        };
    }
};




// Retrieve wallet details by student ID
walletAndTransactionsService.getStudentsWallet = async (studentId) => {
    const sql = `SELECT * FROM wallets WHERE studentId = ?`;
    const args = [studentId];
    return query(sql, args);
};

// Retrieve wallet details by marketer ID
walletAndTransactionsService.getMarketersWallet = async (marketerId) => {
    const sql = `SELECT * FROM wallets WHERE marketterId = ?`;
    const args = [marketerId];
    return query(sql, args);
};

// Update wallet balance for a student
walletAndTransactionsService.updateStudentsBalance = async (studentId, amount) => {
    const sql = `UPDATE wallets SET balance = balance + ? WHERE studentId = ?`;
    const args = [amount, studentId];
    return query(sql, args);
};

// Update wallet balance for a marketer
walletAndTransactionsService.updateMarketersBalance = async (marketerId, amount) => {
    const sql = `UPDATE wallets SET balance = balance + ? WHERE marketterId = ?`;
    const args = [amount, marketerId];
    return query(sql, args);
};

// Create a transaction
walletAndTransactionsService.createTransaction = async (transactionData) => {
    const sql = `INSERT INTO transactions 
        (studentId, marketterId, transaction_type, amount, description, transaction_category, transaction_fee_currency, transaction_fee_amount, fee) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const args = [
        transactionData.studentId,
        transactionData.marketerId,
        transactionData.transaction_type,
        transactionData.amount,
        transactionData.description,
        transactionData.transaction_category,
        transactionData.transaction_fee_currency,
        transactionData.transaction_fee_amount,
        transactionData.fee
    ];
    return query(sql, args);
};

// Get all transactions for a student
walletAndTransactionsService.getStudentsTransactions = async (studentId) => {
    const sql = `SELECT * FROM transactions WHERE studentId = ?`;
    const args = [studentId];
    return query(sql, args);
};

// Get all transactions for a marketer
walletAndTransactionsService.getMarketersTransactions = async (marketerId) => {
    const sql = `SELECT * FROM transactions WHERE marketterId = ?`;
    const args = [marketerId];
    return query(sql, args);
};



// // Function to fetch wallet by phone number
// async function getWalletByPhoneNumber(phone, walletType) {
//     const selectWalletQuery = `
//         SELECT w.id, w.customerId, w.skillProviderId
//         FROM wallets w
//         JOIN ${walletType === 'customer' ? 'customers' : 'skill_providers'} p ON w.${walletType}Id = p.id
//         WHERE p.phone = ? AND w.wallet_type = ?
//     `;
//     const result = await query(selectWalletQuery, [phone, walletType]);

//     if (result.length === 0) {
//         throw new Error('Wallet not found for the provided phone number');
//     }

//     return result[0];
// }


// // Get balance for a wallet
// walletAndTransactionsService.getBalance = async (walletId) => {
//     try {
//         const selectQuery = 'SELECT balance FROM wallets WHERE id = ?';
//         const result = await query(selectQuery, [walletId]);
//         if (result.length === 0) {
//             throw new Error('Wallet not found');
//         }
//         return result[0].balance;
//     } catch (error) {
//         throw error;
//     }
// };

// // Get wallet owner name
// walletAndTransactionsService.getWalletOwnerName = async (walletId) => {
//     try {
//         const selectWalletQuery = 'SELECT wallet_type, customerId, skillProviderId FROM wallets WHERE id = ?';
//         const wallet = await query(selectWalletQuery, [walletId]);

//         if (wallet.length === 0) {
//             throw new Error('Wallet not found');
//         }

//         if (wallet[0].wallet_type === 'customer') {
//             const selectCustomerQuery = 'SELECT firstName, lastName FROM customers WHERE id = ?';
//             const customer = await query(selectCustomerQuery, [wallet[0].customerId]);
//             return `${customer[0].firstName} ${customer[0].lastName}`;
//         } else {
//             const selectSkillProviderQuery = 'SELECT firstName, lastName FROM skill_providers WHERE id = ?';
//             const skillProvider = await query(selectSkillProviderQuery, [wallet[0].skillProviderId]);
//             return `${skillProvider[0].firstName} ${skillProvider[0].lastName}`;
//         }
//     } catch (error) {
//         throw error;
//     }
// };


// // Create a new wallet account
// // walletAndTransactionsService.createAccount = async (walletData) => {
// //     try {
// //         const { wallet_type, customerId, skillProviderId } = walletData;

// //         const insertWalletQuery = `
// //             INSERT INTO wallets (wallet_type, customerId, skillProviderId)
// //             VALUES (?, ?, ?)
// //         `;
// //         const walletResult = await query(insertWalletQuery, [wallet_type, customerId, skillProviderId]);

// //         if (!walletResult.insertId) {
// //             throw new Error('Failed to create wallet');
// //         }

// //         return { id: walletResult.insertId };
// //     } catch (error) {
// //         throw error;
// //     }
// // };

// // Create a new wallet account with a balance of 0.00
// walletAndTransactionsService.createAccount = async (walletData) => {
//     try {
//         const { wallet_type, customerId, skillProviderId } = walletData;

//         const insertWalletQuery = `
//             INSERT INTO wallets (wallet_type, customerId, skillProviderId, balance)
//             VALUES (?, ?, ?, ?)
//         `;
//         const walletResult = await query(insertWalletQuery, [wallet_type, customerId, skillProviderId, 0.00]);

//         if (!walletResult.insertId) {
//             throw new Error('Failed to create wallet');
//         }

//         return { id: walletResult.insertId };
//     } catch (error) {
//         throw error;
//     }
// };

// // Method to get wallet details by wallet ID and filter by wallet type
// walletAndTransactionsService.getWalletDetailsById = async (walletId) => {
//     try {
//         const selectWalletQuery = `
//             SELECT id, wallet_type, customerId, skillProviderId, balance 
//             FROM wallets 
//             WHERE id = ?
//         `;
//         const wallet = await query(selectWalletQuery, [walletId]);

//         if (wallet.length === 0) {
//             throw new Error('Wallet not found');
//         }

//         const walletDetails = wallet[0];

//         if (walletDetails.wallet_type === 'customer') {
//             const selectCustomerQuery = `
//                 SELECT w.id, w.balance, c.firstName, c.lastName, c.email, c.phone 
//                 FROM wallets w 
//                 JOIN customers c ON w.customerId = c.id 
//                 WHERE w.id = ?
//             `;
//             const customerDetails = await query(selectCustomerQuery, [walletId]);
//             return customerDetails[0];
//         } else if (walletDetails.wallet_type === 'skill_provider') {
//             const selectSkillProviderQuery = `
//                 SELECT w.id, w.balance, sp.firstName, sp.lastName, sp.email, sp.phone 
//                 FROM wallets w 
//                 JOIN skill_providers sp ON w.skillProviderId = sp.id 
//                 WHERE w.id = ?
//             `;
//             const skillProviderDetails = await query(selectSkillProviderQuery, [walletId]);
//             return skillProviderDetails[0];
//         } else {
//             throw new Error('Invalid wallet type');
//         }
//     } catch (error) {
//         throw error;
//     }
// };



// // Function to get wallet details by customerId or skillProviderId
// walletAndTransactionsService.getWalletDetailsByCustomerOrSkillProviderId = async (id) => {
//     try {
//         // Query to check if a wallet exists for the provided ID
//         const walletExistsQuery = `
//             SELECT id, wallet_type, customerId, skillProviderId
//             FROM wallets
//             WHERE customerId = ? OR skillProviderId = ?
//         `;
//         const walletRows = await query(walletExistsQuery, [id, id]);

//         if (walletRows.length === 0) {
//             return {
//                 status: 'error',
//                 message: 'No wallet found for the provided ID'
//             };
//         }

//         const wallet = walletRows[0];

//         // If wallet exists, determine the type and fetch additional details
//         if (wallet.wallet_type === 'customer') {
//             const customerWalletQuery = `
//                 SELECT w.id AS walletId, w.balance, c.firstName, c.lastName, c.email, c.phone 
//                 FROM wallets w
//                 JOIN customers c ON w.customerId = c.id 
//                 WHERE w.customerId = ?
//             `;
//             const customerWalletDetails = await query(customerWalletQuery, [id]);

//             return {
//                 status: 'success',
//                 message: 'Customer wallet details retrieved successfully',
//                 data: customerWalletDetails[0]
//             };
//         } else if (wallet.wallet_type === 'skill_provider') {
//             const skillProviderWalletQuery = `
//                 SELECT w.id AS walletId, w.balance, sp.firstName, sp.lastName, sp.email, sp.phone 
//                 FROM wallets w
//                 JOIN skill_providers sp ON w.skillProviderId = sp.id 
//                 WHERE w.skillProviderId = ?
//             `;
//             const skillProviderWalletDetails = await query(skillProviderWalletQuery, [id]);

//             return {
//                 status: 'success',
//                 message: 'Skill provider wallet details retrieved successfully',
//                 data: skillProviderWalletDetails[0]
//             };
//         }

//         // If wallet type is neither 'customer' nor 'skill_provider'
//         return {
//             status: 'error',
//             message: 'Invalid wallet type found'
//         };
//     } catch (error) {
//         return {
//             status: 'error',
//             message: `Error retrieving wallet details: ${error.message}`
//         };
//     }
// };


// // Helper function to get wallet by phone number and type (customer or skill_provider)
// walletAndTransactionsService.getWalletByPhone = async (phone, walletType) => {
//     let selectWalletQuery;
//     if (walletType === 'customer') {
//         selectWalletQuery = `
//             SELECT w.id, w.customerId 
//             FROM wallets w 
//             JOIN customers c ON w.customerId = c.id 
//             WHERE c.phone = ? AND w.wallet_type = 'customer'
//         `;
//     } else if (walletType === 'skill_provider') {
//         selectWalletQuery = `
//             SELECT w.id, w.skillProviderId 
//             FROM wallets w 
//             JOIN skill_providers sp ON w.skillProviderId = sp.id 
//             WHERE sp.phone = ? AND w.wallet_type = 'skill_provider'
//         `;
//     } else {
//         throw new Error('Invalid wallet type');
//     }

//     const wallet = await query(selectWalletQuery, [phone]);
//     if (wallet.length === 0) {
//         throw new Error(`Wallet not found for ${walletType} with phone ${phone}`);
//     }

//     return wallet[0];
// };

// // Credit account using phone number
// walletAndTransactionsService.creditAccount = async (phone, amount, description) => {
//     const wallet = await walletAndTransactionsService.getWalletByPhone(phone, 'customer');

//     const merchantFee = 100 + (amount * 0.2);
//     const netAmount = amount - merchantFee;

//     const updateBalanceQuery = 'UPDATE wallets SET balance = balance + ? WHERE id = ?';
//     await query(updateBalanceQuery, [netAmount, wallet.id]);

//     const insertTransactionQuery = `
//         INSERT INTO transactions (sender_customer_id, transaction_type, amount, description, transaction_status, merchant_fee_amount, transaction_category)
//         VALUES (?, 'credit', ?, ?, 'completed', ?, 'credit')
//     `;
//     const result = await query(insertTransactionQuery, [wallet.customerId, amount, description, merchantFee]);

//     const selectTransactionQuery = 'SELECT * FROM transactions WHERE id = ?';
//     const transaction = await query(selectTransactionQuery, [result.insertId]);

//     return {
//         message: 'Account credited successfully',
//         transaction: transaction[0]
//     };
// };




// walletAndTransactionsService.creditCustomerWalletAccount = async (phone, amount, description) => {
//     // Calculate the merchant fee and net amount
//     const merchantFee = 100 + (amount * 0.2); // Fixed 100 plus 0.2% of the amount
//     const netAmount = amount - merchantFee;

//     const findWalletSql = `SELECT * FROM wallets WHERE phone = ?`;
//     const creditWalletSql = `UPDATE wallets SET balance = balance + ? WHERE phone = ?`;
//     const recordTransactionSql = `INSERT INTO transactions (phone, amount, type, description) VALUES (?, ?, 'credit', ?)`;

//     try {
//         // Check if wallet exists
//         const wallet = await query(findWalletSql, [phone]);
//         if (!wallet.length) {
//             return { success: false, message: 'Wallet not found' }; // Error message for wallet not found
//         }

//         // Update wallet balance with the net amount after merchant fee deduction
//         await query(creditWalletSql, [netAmount, phone]);

//         // Record the credit transaction with the original amount and mention the fee deduction in the description
//         await query(recordTransactionSql, [phone, netAmount, description + ` (Merchant Fee: ${merchantFee})`]);

//         return {
//             success: true,
//             message: 'Wallet credited successfully',
//             originalAmount: amount,
//             merchantFee,
//             netAmount,
//             phone
//         };
//     } catch (error) {
//         return { success: false, message: `Credit Wallet Error: ${error.message}` }; // Return error message
//     }
// };


// walletAndTransactionsService.creditCustomerWalletAccount = async (customerId, amount, description) => {
//     // Calculate the merchant fee and net amount
//     const merchantFee = 100 + (amount * 0.2); // Fixed 100 plus 0.2% of the amount
//     const netAmount = amount - merchantFee;

//     const findWalletSql = `SELECT * FROM wallets WHERE customerId = ?`;
//     const creditWalletSql = `UPDATE wallets SET balance = balance + ? WHERE customerId = ?`;
//     const recordTransactionSql = `INSERT INTO transactions (customerId, amount, type, description) VALUES (?, ?, 'credit', ?)`;

//     try {
//         // Check if wallet exists
//         const wallet = await query(findWalletSql, [customerId]);
//         if (!wallet.length) {
//             return { success: false, message: 'Wallet not found' }; // Error message for wallet not found
//         }

//         // Update wallet balance with the net amount after merchant fee deduction
//         await query(creditWalletSql, [netAmount, customerId]);

//         // Record the credit transaction with the original amount and mention the fee deduction in the description
//         await query(recordTransactionSql, [customerId, netAmount, description + ` (Merchant Fee: ${merchantFee})`]);

//         return {
//             success: true,
//             message: 'Wallet credited successfully',
//             originalAmount: amount,
//             merchantFee,
//             netAmount,
//             customerId
//         };
//     } catch (error) {
//         return { success: false, message: `Credit Wallet Error: ${error.message}` }; // Return error message
//     }
// };


// walletAndTransactionsService.creditCustomerWalletAccount = async (customerId, amount, description) => {
//     // Calculate the merchant fee and net amount
//     // const merchantFee = 100 + (amount * 0.2); // Fixed 100 plus 0.2% of the amount
//     const merchantFee = 0; // Fixed 0% of the amount
//     const netAmount = amount - merchantFee;

//     const findWalletSql = `SELECT * FROM wallets WHERE customerId = ?`;
//     const creditWalletSql = `UPDATE wallets SET balance = balance + ? WHERE customerId = ?`;
    
//     // SQL transaction start query (pseudo code, actual transaction syntax depends on your DB library)
//     const startTransactionSql = `START TRANSACTION`;
//     const commitTransactionSql = `COMMIT`;
//     const rollbackTransactionSql = `ROLLBACK`;

//     try {
//         // Start transaction
//         await query(startTransactionSql);

//         // Check if wallet exists
//         const wallet = await query(findWalletSql, [customerId]);
//         if (!wallet.length) {
//             await query(rollbackTransactionSql); // Rollback if wallet not found
//             return { success: false, message: 'Wallet not found' };
//         }

//         // Update wallet balance with the net amount after merchant fee deduction
//         await query(creditWalletSql, [netAmount, customerId]);

//         // Insert the transaction record into the transactions table
//         const insertTransactionQuery = `
//             INSERT INTO transactions (sender_customer_id, transaction_type, amount, description, transaction_status, customer_transaction_approval, merchant_fee_amount, transaction_category)
//             VALUES (?, 'credit', ?, ?, 'completed', 'completed', ?, 'credit')
//         `;
//         const result = await query(insertTransactionQuery, [customerId, amount, description, merchantFee]);

//         // Fetch the newly inserted transaction
//         const selectTransactionQuery = 'SELECT * FROM transactions WHERE id = ?';
//         const transaction = await query(selectTransactionQuery, [result.insertId]);

//         // Commit transaction
//         await query(commitTransactionSql);

//         return {
//             success: true,
//             message: 'Wallet credited successfully',
//             originalAmount: amount,
//             merchantFee,
//             netAmount,
//             customerId,
//             transaction: transaction[0]
//         };
//     } catch (error) {
//         // Rollback in case of error
//         await query(rollbackTransactionSql);
        
//         // Log the error for further investigation (could be console or a logging service)
//         console.error(`Credit Wallet Error: ${error.message}`);

//         return { success: false, message: `Credit Wallet Error: ${error.message}` };
//     }
// };


// // Transfer funds between accounts using phone numbers
// walletAndTransactionsService.transferToAccount = async (senderPhone, recipientPhone, amount, description) => {
//     const senderWallet = await walletAndTransactionsService.getWalletByPhone(senderPhone, 'customer');
//     const recipientWallet = await walletAndTransactionsService.getWalletByPhone(recipientPhone, 'skill_provider');

//     const senderBalance = await walletAndTransactionsService.getBalance(senderWallet.id);
//     if (senderBalance < amount) {
//         throw new Error('Insufficient balance');
//     }

//     const merchantFee = 100 + (amount * 0.05);
//     const netAmount = amount - merchantFee;

//     await query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [amount, senderWallet.id]);
//     await query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [netAmount, recipientWallet.id]);

//     const insertSenderTransactionQuery = `
//         INSERT INTO transactions (sender_customer_id, recipient_skill_provider_id, transaction_type, amount, description, transaction_status, fee, transaction_category)
//         VALUES (?, ?, 'transfer', ?, ?, 'completed', ?, 'transfer')
//     `;
//     await query(insertSenderTransactionQuery, [senderWallet.customerId, recipientWallet.skillProviderId, amount, description, merchantFee]);

//     const insertRecipientTransactionQuery = `
//         INSERT INTO transactions (sender_customer_id, recipient_skill_provider_id, transaction_type, amount, description, transaction_status, transaction_category)
//         VALUES (?, ?, 'transfer', ?, ?, 'completed', 'transfer')
//     `;
//     const recipientTransactionResult = await query(insertRecipientTransactionQuery, [senderWallet.customerId, recipientWallet.skillProviderId, netAmount, description]);

//     const selectTransactionQuery = 'SELECT * FROM transactions WHERE id = ?';
//     const transaction = await query(selectTransactionQuery, [recipientTransactionResult.insertId]);

//     return {
//         message: 'Transfer completed successfully',
//         transaction: transaction[0]
//     };
// };

// // Get wallet balance by wallet ID
// walletAndTransactionsService.getBalance = async (walletId) => {
//     const selectQuery = 'SELECT balance FROM wallets WHERE id = ?';
//     const result = await query(selectQuery, [walletId]);
//     if (result.length === 0) {
//         throw new Error('Wallet not found');
//     }
//     return result[0].balance;
// };

// // Get transactions for a customer by customer ID
// walletAndTransactionsService.getTransactionsForCustomer = async (customerId) => {
//     const selectQuery = `
//         SELECT 
//             t.id AS transaction_id,
//             CONCAT(sp.firstName, ' ', sp.lastName) AS receiver_name,
//             t.amount,
//             t.description,
//             t.transaction_date,
//             t.transaction_status,
//             t.fee AS transaction_fee,
//             t.merchant_fee_amount AS merchant_fee
//         FROM transactions t
//         LEFT JOIN skill_providers sp ON t.recipient_skill_provider_id = sp.id
//         WHERE t.sender_customer_id = ?
//         ORDER BY t.transaction_date DESC
//     `;
//     const transactions = await query(selectQuery, [customerId]);
//     return transactions;
// };

// // Get transactions for a skill provider by skill provider ID
// walletAndTransactionsService.getTransactionsForSkillProvider = async (skillProviderId) => {
//     const selectQuery = `
//         SELECT 
//             t.id AS transaction_id,
//             CONCAT(c.firstName, ' ', c.lastName) AS sender_name,
//             t.amount,
//             t.description,
//             t.transaction_date,
//             t.transaction_status,
//             t.fee AS transaction_fee,
//             t.merchant_fee_amount AS merchant_fee
//         FROM transactions t
//         LEFT JOIN customers c ON t.sender_customer_id = c.id
//         WHERE t.recipient_skill_provider_id = ?
//         ORDER BY t.transaction_date DESC
//     `;
//     const transactions = await query(selectQuery, [skillProviderId]);
//     return transactions;
// };


// // Verify and complete transaction
// walletAndTransactionsService.completeTransaction = async (reference) => {
//     // Verify Paystack transaction
//     const verificationResponse = await verifyTransaction(reference);
//     const transactionData = verificationResponse.data;

//     if (transactionData.status === 'success') {
//         const wallet = await walletAndTransactionsService.getWalletByPhoneNumber(transactionData.email, 'customer');

//         // Calculate fees and net amount
//         const amount = transactionData.amount / 100; // Convert kobo to currency
//         const merchantFee = 100 + (amount * 0.2);
//         const netAmount = amount - merchantFee;

//         // Update wallet balance
//         const updateBalanceQuery = 'UPDATE wallets SET balance = balance + ? WHERE id = ?';
//         await query(updateBalanceQuery, [netAmount, wallet.id]);

//         // Record transaction
//         const insertTransactionQuery = `
//             INSERT INTO transactions (sender_customer_id, transaction_type, amount, description, transaction_status, merchant_fee_amount, transaction_category)
//             VALUES (?, 'credit', ?, ?, 'completed', ?, 'credit')
//         `;
//         await query(insertTransactionQuery, [wallet.customerId, amount, description, merchantFee]);

//         return {
//             message: 'Account credited successfully',
//             transactionData
//         };
//     } else {
//         throw new Error('Transaction verification failed');
//     }
// };


module.exports = walletAndTransactionsService;


