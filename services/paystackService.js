const axios = require('axios');
const mysql = require('mysql');
const dotenv = require('dotenv');
const crypto = require('crypto');

const walletAndTransactionsService = require('../services/walletAndTransactionsService'); // Import your wallet service

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

// Create Payments table if it doesn't exist
const createPaymentsTableQuery = `CREATE TABLE IF NOT EXISTS payments (
    id INT NOT NULL AUTO_INCREMENT,
    reference VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    status VARCHAR(50),
    paymentPlan ENUM('full', 'installment', '') NULL,
    studentId INT,
    PRIMARY KEY (id),
    UNIQUE KEY reference (reference),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;


// Updated createDisputesTableQuery
const createDisputesTableQuery = `
     CREATE TABLE IF NOT EXISTS disputes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    raised_by ENUM('customer', 'skill_provider') NOT NULL,
    raised_by_customer_id INT,  -- Customer raising the dispute
    raised_by_skill_provider_id INT,  -- Skill provider raising the dispute
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'resolved', 'rejected') DEFAULT 'pending',
    
    -- Foreign keys
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (raised_by_customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (raised_by_skill_provider_id) REFERENCES skill_providers(id) ON DELETE CASCADE
);
`;

// Function to create Payments table
async function createPaymentsTable() {
    try {
        await query(createPaymentsTableQuery);
        await query(createDisputesTableQuery);
        console.log('Payments and Disputes tables created successfully');
    } catch (error) {
        console.error('Error creating Payments or Disputes table:', error);
    }
}

// Execute table creation queries
(async () => {
    await createPaymentsTable();
    console.log('Tables created successfully');
})();

const paystackService = {};



// Function to get student details from the database
paystackService.getStudentDetails = async (studentId) => {
    const sql = `SELECT firstName, lastName, email, phone FROM students WHERE id = ?`;
    
    try {
        const results = await query(sql, [studentId]);
        if (results.length > 0) {
            const customer = results[0];
            return {
                full_name: `${customer.firstName} ${customer.lastName}`,
                first_name: customer.firstName,
                last_name: customer.lastName,
                email: customer.email,
                phone: customer.phone,
            }; // Return the customer details needed for the Paystack transaction
        } else {  
            
            throw new Error('Customer not found');
        }
    } catch (error) {
        throw new Error(`Database Error: ${error.message}`);
    }
};



// Function to initiate a Paystack transaction
paystackService.initiateTransaction = async (studentId, amount) => {
    try {
        // Fetch customer details
        const student = await paystackService.getStudentDetails(studentId);

        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            amount: amount * 100, // Convert to kobo
            email: student.email,
            full_name: student.full_name,
            first_name: student.first_name,
            last_name: student.last_name,
            // Optionally include phone if required by Paystack
            phone: student.phone,
        }, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.data.status) {
            // Save the transaction in the database
            await paystackService.recordTransaction({
                reference: response.data.data.reference,
                amount,
                email: student.email,
                full_name: student.full_name,
                first_name: student.first_name,
                last_name: student.last_name,
                status: 'pending',
                studentId, // Add studentId for future reference
            });

            return response.data.data; // Return the payment link and other details
        } else {
            throw new Error('Failed to initiate transaction');
        }
    } catch (error) {
        throw new Error(`Paystack Transaction Error: ${error.response.data.message || error.message}`);
    }
};

// Function to verify a Paystack transaction
paystackService.verifyTransaction = async (reference) => {
    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
        });

        if (response.data.status) {
            return response.data.data; // Return transaction details
        } else {
            throw new Error('Transaction not found or verification failed');
        }
    } catch (error) {
        throw new Error(`Paystack Verification Error: ${error.response.data.message || error.message}`);
    }
};

// Function to handle the callback from Paystack after payment
paystackService.handlePaymentCallback = async (transactionData) => {
    const { status, amount, reference, studentId } = transactionData;

    if (status === 'success') {
        // Fetch student details from the database
        const student = await paystackService.getStudentDetails(studentId);
        
        // Update the transaction status in the database
        await paystackService.updateTransactionStatus(reference, 'success');

        const amountInNaira = amount; // Convert kobo back to Naira
        // const amountInNaira = amount / 100; // Convert kobo back to Naira

        // Credit the customer's wallet
        await walletAndTransactionsService.creditStudentWalletAccount(studentId, amountInNaira, `Payment for transaction ${reference}`);
        
        return {
            message: 'Payment processed successfully',
            transactionReference: reference,
        };
    } else {
        // Update the transaction status in the database
        await paystackService.updateTransactionStatus(reference, 'failed');
        throw new Error('Payment was not successful');
    }
};

// Function to record a transaction in the database
paystackService.recordTransaction = async (transactionData) => {
    const { reference, amount, email, full_name, status, studentId } = transactionData;
    const sql = `INSERT INTO payments (reference, amount, email, full_name, status, studentId) VALUES (?, ?, ?, ?, ?, ?)`;
    
    try {
        await query(sql, [reference, amount, email, full_name, status, studentId]);
    } catch (error) {
        throw new Error(`Database Error: ${error.message}`);
    }
};

// Function to update transaction status in the database
paystackService.updateTransactionStatus = async (reference, status) => {
    const sql = `UPDATE payments SET status = ? WHERE reference = ?`;
    
    try {
        await query(sql, [status, reference]);
    } catch (error) {
        throw new Error(`Database Update Error: ${error.message}`);
    }
};

// New method to get student wallet details along with student information
paystackService.getStudeWalletDetails = async (studentId) => {
    const sql = `
        SELECT w.id AS wallet_id, w.wallet_type, w.balance, 
               c.firstName, c.lastName, c.email, c.phone
        FROM wallets w
        JOIN customers c ON w.studentId = c.id
        WHERE w.studentId = ? AND w.wallet_type = 'customer';
    `;
    
    try {
        const results = await query(sql, [studentId]);
        if (results.length > 0) {
            const walletDetails = results[0];
            return {
                wallet_id: walletDetails.wallet_id,
                wallet_type: walletDetails.wallet_type,
                balance: walletDetails.balance,
                customer: {
                    first_name: walletDetails.firstName,
                    last_name: walletDetails.lastName,
                    email: walletDetails.email,
                    phone: walletDetails.phone,
                },
            };
        } else {
            throw new Error('Wallet not found for the customer');
        }
    } catch (error) {
        throw new Error(`Database Error: ${error.message}`);
    }
};

// New method to get skill provider wallet details along with skill provider information
paystackService.getSkillProviderWalletDetails = async (skillProviderId) => {
    const sql = `
        SELECT w.id AS wallet_id, w.wallet_type, w.balance, 
               s.firstName, s.lastName, s.email, s.phone
        FROM wallets w
        JOIN skill_providers s ON w.skillProviderId = s.id
        WHERE w.skillProviderId = ? AND w.wallet_type = 'skill_provider';
    `;
    
    try {
        const results = await query(sql, [skillProviderId]);  // Execute the query with the provided skillProviderId
        if (results.length > 0) {  // Check if any results were found
            const walletDetails = results[0];  // Get the first result (assuming a skill provider has only one wallet)
            return {
                wallet_id: walletDetails.wallet_id,  // Wallet ID
                wallet_type: walletDetails.wallet_type,  // Wallet type ('skill_provider')
                balance: walletDetails.balance,  // Balance of the wallet
                skill_provider: {
                    first_name: walletDetails.firstName,  // Skill provider's first name
                    last_name: walletDetails.lastName,  // Skill provider's last name
                    email: walletDetails.email,  // Skill provider's email
                    phone: walletDetails.phone,  // Skill provider's phone
                },
            };
        } else {
            throw new Error('Wallet not found for the skill provider');  // If no wallet is found, throw an error
        }
    } catch (error) {
        throw new Error(`Database Error: ${error.message}`);  // Handle any database errors
    }
};



paystackService.getSkillProviderWalletDetails = async (skillProviderId) => {
    try {
        // First check if the skillProviderId exists in both wallets and skill_providers tables
        const checkSkillProviderSql = `
            SELECT COUNT(*) as count 
            FROM wallets w
            JOIN skill_providers s ON w.skillProviderId = s.id
            WHERE w.skillProviderId = ? AND w.wallet_type = 'skill_provider';
        `;
        
        // Execute the query to check if the skill provider exists
        const checkResult = await query(checkSkillProviderSql, [skillProviderId]);
        if (checkResult[0].count === 0) {
            // If no wallet or skill provider is found, throw an error
            throw new Error('Skill provider or wallet not found');
        }

        // If the skill provider exists, proceed with fetching wallet details
        const fetchWalletDetailsSql = `
            SELECT w.id AS wallet_id, w.wallet_type, w.balance, 
                   s.firstName, s.lastName, s.email, s.phone
            FROM wallets w
            JOIN skill_providers s ON w.skillProviderId = s.id
            WHERE w.skillProviderId = ? AND w.wallet_type = 'skill_provider';
        `;

        // Fetch the wallet and skill provider details
        const results = await query(fetchWalletDetailsSql, [skillProviderId]);
        if (results.length > 0) {
            const walletDetails = results[0];
            return {
                wallet_id: walletDetails.wallet_id,
                wallet_type: walletDetails.wallet_type,
                balance: walletDetails.balance,
                skill_provider: {
                    first_name: walletDetails.firstName,
                    last_name: walletDetails.lastName,
                    email: walletDetails.email,
                    phone: walletDetails.phone,
                },
            };
        } else {
            throw new Error('Wallet not found for the skill provider');
        }

    } catch (error) {
        throw new Error(`Database Error: ${error.message}`);
    }
};


paystackService.transferToAccount = async (senderPhone, recipientPhone, amount, description, metadata) => { 
    // Set service charge as 4% of the transaction amount
    const serviceCharge = amount * 0.04;
    const merchantFee = 0.00;

    try {
        // Start SQL transaction
        await query('START TRANSACTION');

        // Fetch sender and recipient wallets
        const senderWallet = await walletAndTransactionsService.getWalletByPhone(senderPhone, 'customer');
        const recipientWallet = await walletAndTransactionsService.getWalletByPhone(recipientPhone, 'skill_provider');

        // Check sender balance
        const senderBalance = await walletAndTransactionsService.getBalance(senderWallet.id);
        if (senderBalance < amount) {
            throw new Error('Insufficient balance');
        }

        // Calculate net amount to credit the recipient (after service charge deduction)
        const netAmount = amount - serviceCharge;

        // Deduct the amount from the sender's wallet (without service charge)
        await query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [amount, senderWallet.id]);

        // Credit the net amount (after service charge) to the recipient's wallet
        await query('UPDATE wallets SET balance = balance + ?, service_charge = ? WHERE id = ?', [netAmount, serviceCharge, recipientWallet.id]);

        // Generate a unique transaction hash (using SHA256 for example)
        const transactionHash = crypto.createHash('sha256')
            .update(`${senderWallet.id}${recipientWallet.id}${amount}${Date.now()}`)
            .digest('hex');

        // Generate a unique invoice number (e.g., INV + timestamp)
        const invoiceNumber = `INV${Date.now()}`;

        // Set note to be the same as the description
        const note = description;

        // Convert metadata to a JSON string, or set it as NULL if not provided
        // Add actual amount and net amount in metadata
        const metadataJSON = metadata ? JSON.stringify({ 
            ...metadata, 
            invoiceNumber, 
            note, 
            actualAmount: amount, 
            amountAfterDeductions: netAmount 
        }) : JSON.stringify({ 
            invoiceNumber, 
            note, 
            actualAmount: amount, 
            amountAfterDeductions: netAmount 
        });

        // Insert transaction record for sender
        const insertSenderTransactionQuery = `
            INSERT INTO transactions 
            (sender_customer_id, recipient_skill_provider_id, transaction_type, amount, description, transaction_status, fee, transaction_category, service_charge, transaction_hash, metadata) 
            VALUES (?, ?, 'transfer', ?, ?, 'completed', ?, 'transfer', 0, ?, ?)
        `;
        await query(insertSenderTransactionQuery, [
            senderWallet.studentId,
            recipientWallet.skillProviderId,
            amount,
            description,
            merchantFee, // Fee for the sender
            transactionHash,
            metadataJSON // Metadata for the sender including actual amount and amount after deductions
        ]);

        // Insert transaction record for recipient (credit with service charge deducted)
        const insertRecipientTransactionQuery = `
            INSERT INTO transactions 
            (sender_customer_id, recipient_skill_provider_id, transaction_type, amount, description, transaction_status, fee, transaction_category, service_charge, transaction_hash, metadata) 
            VALUES (?, ?, 'transfer', ?, ?, 'completed', 0, 'transfer', ?, ?, ?)
        `;
        const recipientTransactionResult = await query(insertRecipientTransactionQuery, [
            senderWallet.studentId,
            recipientWallet.skillProviderId,
            netAmount,  // Amount after deductions
            description,
            serviceCharge, // Service charge applies to the recipient
            transactionHash,
            metadataJSON // Metadata for the recipient including actual amount and amount after deductions
        ]);

        // Commit the transaction
        await query('COMMIT');

        // Fetch the transaction details
        const selectTransactionQuery = 'SELECT * FROM transactions WHERE id = ?';
        const transaction = await query(selectTransactionQuery, [recipientTransactionResult.insertId]);

        return {
            success: true,
            message: 'Transfer completed successfully',
            transaction: transaction[0]
        };

    } catch (error) {
        // Rollback the transaction in case of any error
        await query('ROLLBACK');
        throw new Error(`Transfer failed: ${error.message}`);
    }
};


paystackService.debitSkillProviderWalletAccount = async (skillProviderId, amount) => {
    // Set service charge as 4% of the transaction amount
    const serviceCharge = amount * 0.04;

    try {
        // Ensure the amount and skillProviderId are provided
        if (!skillProviderId || !amount) {
            throw new Error('SkillProviderId and amount are required');
        }

        // Start SQL transaction
        await query('START TRANSACTION');

        // Step 1: Get the current balance of the skill provider's wallet
        const walletDetails = await paystackService.getSkillProviderWalletDetails(skillProviderId);

        // Step 2: Check if the wallet has sufficient funds
        if (walletDetails.balance < amount + serviceCharge) {
            throw new Error('Insufficient funds for withdrawal');
        }

        // Step 3: Update the wallet balance (deducting the total amount including service charge)
        const newBalance = walletDetails.balance - (amount + serviceCharge);
        const updateBalanceSql = `UPDATE wallets SET balance = ?, service_charge = service_charge + ? WHERE skillProviderId = ?`;
        await query(updateBalanceSql, [newBalance, serviceCharge, skillProviderId]);

        // Step 4: Record the transaction in the transactions table, including the service charge
        const insertTransactionSql = `
            INSERT INTO transactions (sender_customer_id, recipient_skill_provider_id, amount, service_charge, transaction_type, transaction_date)
            VALUES (?, ?, ?, ?, 'debit', NOW())
        `;
        await query(insertTransactionSql, [null, skillProviderId, amount, serviceCharge]);

        // Step 5: Commit the transaction
        await query('COMMIT');

        // Return the updated wallet details
        return {
            wallet_id: walletDetails.id,
            new_balance: newBalance,
            service_charge: serviceCharge,
        };
    } catch (error) {
        await query('ROLLBACK');
        throw new Error(`Debit Wallet Error: ${error.message}`);
    }
};



paystackService.makeSkillProviderWalletWithdrawal = async (skillProviderId, amount) => {
    try {
        // Step 1: Get skill provider's wallet details
        const walletDetails = await paystackService.getSkillProviderWalletDetails(skillProviderId);

        // Step 2: Check if the skill provider has enough balance
        if (walletDetails.balance < amount) {
            throw new Error('Insufficient balance in wallet');
        }

        // Step 3: Deduct the amount from the skill provider's wallet
        const updatedWallet = await walletAndTransactionsService.debitSkillProviderWalletAccount(
            skillProviderId,
            amount,
            `Wallet withdrawal for amount: ${amount}`
        );

        // Step 4: Record the withdrawal transaction in the database
        await paystackService.recordTransaction({
            reference: `WTH-${Date.now()}`, // Generate a unique reference for the transaction
            amount,
            email: walletDetails.skill_provider.email,
            full_name: `${walletDetails.skill_provider.first_name} ${walletDetails.skill_provider.last_name}`,
            status: 'successful',
            skillProviderId: skillProviderId,
        });

        return {
            message: 'Withdrawal successfully processed from wallet',
            walletBalance: updatedWallet.balance,
            transactionReference: `WTH-${Date.now()}`,
        };
    } catch (error) {
        throw new Error(`Withdrawal Error: ${error.message}`);
    }
};



// Fetch Skill Provider Transaction History
paystackService.getSkillProviderTransactionHistory = async (skillProviderId) => {
    const sql = `
        SELECT t.id AS transaction_id, 
               t.transaction_type, 
               t.amount, 
               t.description, 
               t.customer_transaction_approval, 
               t.transaction_disput_message, 
               t.transaction_status, 
               t.transaction_date,   
               t.completed_at,
               t.transaction_category,
               t.merchant_fee_amount,
               t.metadata,
               c.firstName AS customer_first_name,
               c.lastName AS customer_last_name,
               c.email AS customer_email,
               c.phone AS customer_phone,
               sp.firstName AS skill_provider_first_name,
               sp.lastName AS skill_provider_last_name,
               sp.email AS skill_provider_email,
               sp.phone AS skill_provider_phone
        FROM transactions t
        JOIN customers c ON t.sender_customer_id = c.id
        JOIN skill_providers sp ON t.recipient_skill_provider_id = sp.id
        WHERE t.recipient_skill_provider_id = ?;
    `;

    try {
        const results = await query(sql, [skillProviderId]);
        if (results.length > 0) {
            const transactions = results.map(transaction => ({
                transaction_id: transaction.transaction_id,
                transaction_type: transaction.transaction_type,
                amount: transaction.amount,
                description: transaction.description,
                transaction_status: transaction.transaction_status,
                customer_transaction_approval: transaction.customer_transaction_approval,
                transaction_disput_message: transaction.transaction_disput_message,
                transaction_date: transaction.transaction_date,
                completed_at: transaction.completed_at,
                transaction_category: transaction.transaction_category,
                merchant_fee_amount: transaction.merchant_fee_amount,
                metadata: transaction.metadata,
                senderDetails: {
                    first_name: transaction.customer_first_name,
                    last_name: transaction.customer_last_name,
                    email: transaction.customer_email,
                    phone: transaction.customer_phone,
                },
                recieverDetails: {
                    first_name: transaction.skill_provider_first_name,
                    last_name: transaction.skill_provider_last_name,
                    email: transaction.skill_provider_email,
                    phone: transaction.skill_provider_phone,
                }
            }));

            return transactions;
        } else {
            throw new Error('No transactions found for the skill provider');
        }
    } catch (error) {
        throw new Error(`Error fetching skill provider transaction history: ${error.message}`);
    }
};

// Fetch Customer Transaction History
paystackService.getCustomerTransactionHistory = async (studentId) => {
    const sql = `
        SELECT t.id AS transaction_id, 
               t.transaction_type, 
               t.amount, 
               t.description, 
               t.transaction_status, 
               t.transaction_date,
               t.completed_at,
               t.transaction_category,
               t.merchant_fee_amount,
               sp.firstName AS skill_provider_first_name,
               sp.lastName AS skill_provider_last_name,
               sp.email AS skill_provider_email,
               sp.phone AS skill_provider_phone,
               c.firstName AS customer_first_name,
               c.lastName AS customer_last_name,
               c.email AS customer_email,
               c.phone AS customer_phone
        FROM transactions t
        JOIN skill_providers sp ON t.recipient_skill_provider_id = sp.id
        JOIN customers c ON t.sender_customer_id = c.id
        WHERE t.sender_customer_id = ?;
    `;

    try {
        const results = await query(sql, [studentId]);
        if (results.length > 0) {
            const transactions = results.map(transaction => ({
                transaction_id: transaction.transaction_id,
                transaction_type: transaction.transaction_type,
                amount: transaction.amount,
                description: transaction.description,
                transaction_status: transaction.transaction_status,
                transaction_date: transaction.transaction_date,
                completed_at: transaction.completed_at,
                transaction_category: transaction.transaction_category,
                merchant_fee_amount: transaction.merchant_fee_amount,
                customer: {
                    first_name: transaction.customer_first_name,
                    last_name: transaction.customer_last_name,
                    email: transaction.customer_email,
                    phone: transaction.customer_phone,
                },
                skill_provider: {
                    first_name: transaction.skill_provider_first_name,
                    last_name: transaction.skill_provider_last_name,
                    email: transaction.skill_provider_email,
                    phone: transaction.skill_provider_phone,
                }
            }));

            return transactions;
        } else {
            throw new Error('No transactions found for the customer');
        }
    } catch (error) {
        throw new Error(`Error fetching customer transaction history: ${error.message}`);
    }
};

// Method to get transaction details by transaction ID
paystackService.getTransactionById = async (transactionId) => {
    const sql = `
        SELECT *
        FROM transactions
        WHERE id = ?;
    `;

    try {
        const results = await query(sql, [transactionId]);
        if (results.length > 0) {
            return results[0]; // Return the first transaction found
        } else {
            throw new Error('Transaction not found');
        }
    } catch (error) {
        throw new Error(`Error retrieving transaction: ${error.message}`);
    }
};


paystackService.confirmCustomerPayment = async (transactionId, status, disputeMessage = null) => {
    try {
        // Start SQL transaction to ensure atomicity
        await query('START TRANSACTION');

        // Fetch the transaction record by transactionId
        const selectTransactionQuery = 'SELECT * FROM transactions WHERE id = ?';
        const transactionResult = await query(selectTransactionQuery, [transactionId]);

        if (!transactionResult.length) {
            throw new Error('Transaction not found');
        }
        const transaction = transactionResult[0];

        // Check if the transaction is already confirmed
        if (transaction.transaction_status === 'completed') {
            throw new Error('Transaction is already completed');
        }

        // Check if the status is either 'completed' or 'unsatisfactory'
        if (status !== 'completed' && status !== 'unsatisfactory') {
            throw new Error('Invalid status: Status must be either "completed" or "unsatisfactory"');
        }

        // Get the recipient's skill_provider_id from the transaction
        const recipientSkillProviderId = transaction.recipient_skill_provider_id;

        // Fetch the recipient's phone number from the skill_providers table
        const selectSkillProviderQuery = 'SELECT phone FROM skill_providers WHERE id = ?';
        const skillProviderResult = await query(selectSkillProviderQuery, [recipientSkillProviderId]);

        if (!skillProviderResult.length) {
            throw new Error('Skill provider not found');
        }
        const recipientPhone = skillProviderResult[0].phone;

        // Fetch recipient's wallet by phone
        const recipientWallet = await walletAndTransactionsService.getWalletByPhone(recipientPhone, 'skill_provider');

        // If status is 'completed', proceed with payment completion logic
        if (status === 'completed') {
            // Calculate service charge (4% of the transaction amount)
            // const serviceCharge = transaction.amount * 0.04;
            const serviceCharge = transaction.amount * 0.00;
            const netAmount = transaction.amount - serviceCharge;

            // Credit the net amount (after service charge) to the recipient's wallet
            await query('UPDATE wallets SET balance = balance + ?, service_charge = ? WHERE id = ?', [netAmount, serviceCharge, recipientWallet.id]);

            // Generate a unique transaction hash (using SHA256)
            const transactionHash = crypto.createHash('sha256')
                .update(`${transaction.sender_customer_id}${recipientWallet.id}${transaction.amount}${Date.now()}`)
                .digest('hex');

            // Generate a unique invoice number (e.g., INV + timestamp)
            const invoiceNumber = `INV${Date.now()}`;

            // Set note to be the same as the description
            const note = transaction.description;

            // Convert metadata to a JSON string, or set it as NULL if not provided
            const metadataJSON = transaction.metadata ? JSON.stringify({ 
                ...JSON.parse(transaction.metadata), 
                invoiceNumber, 
                note, 
                actualAmount: transaction.amount, 
                amountAfterDeductions: netAmount 
            }) : JSON.stringify({ 
                invoiceNumber, 
                note, 
                actualAmount: transaction.amount, 
                amountAfterDeductions: netAmount 
            });

            // Update the transaction as 'completed' and set completed_at timestamp
            const updateTransactionQuery = `
                UPDATE transactions 
                SET transaction_status = 'completed', 
                    customer_transaction_approval = 'completed', 
                    completed_at = NOW(),
                    transaction_hash = ?, 
                    metadata = ?
                WHERE id = ?
            `;
            await query(updateTransactionQuery, [transactionHash, metadataJSON, transactionId]);

            // **Record the credit transaction for the recipient**
            const insertCreditTransactionQuery = `
                INSERT INTO transactions 
                (sender_customer_id, recipient_skill_provider_id, transaction_type, amount, description, transaction_status, customer_transaction_approval, fee, transaction_category, service_charge, transaction_hash, metadata) 
                VALUES (?, ?, 'credit', ?, ?, 'processed', 'completed', 0, 'credit', ?, ?, ?)
            `;
            await query(insertCreditTransactionQuery, [
                transaction.sender_customer_id,  // Sender customer ID
                recipientSkillProviderId,        // Recipient skill provider ID
                netAmount,                       // Net amount credited after service charge
                note,                            // Note same as description
                serviceCharge,                   // Service charge deducted
                transactionHash,                 // Same transaction hash
                metadataJSON                     // Metadata for the recipient's credit transaction
            ]);

        } else if (status === 'unsatisfactory') {
            // Handle unsatisfactory case: update status to unsatisfactory and add a dispute message
            const updateUnsatisfactoryTransactionQuery = `
                UPDATE transactions 
                SET transaction_status = 'unsatisfactory', 
                    customer_transaction_approval = 'unsatisfactory', 
                    status_message = ? 
                WHERE id = ?
            `;
            await query(updateUnsatisfactoryTransactionQuery, [disputeMessage || 'Dispute raised by customer', transactionId]);
        }

        // Commit the transaction
        await query('COMMIT');

        // Fetch updated transaction details
        const updatedTransaction = await query(selectTransactionQuery, [transactionId]);

        return {
            success: true,
            message: `Transaction ${status === 'completed' ? 'completed' : 'marked as unsatisfactory'} successfully`,
            transaction: updatedTransaction[0]
        };

    } catch (error) {
        // Rollback the transaction in case of error
        await query('ROLLBACK');
        return {
            success: false,
            message: `Error confirming customer payment: ${error.message}`
        };
    }
};



paystackService.confirmSkillProviderPayment = async (transactionId, status, disputeMessage = null) => {
    // Check if status is either 'accepted' or 'rejected'
    if (!['accepted', 'rejected'].includes(status)) {
        throw new Error('Invalid status. Only "accepted" or "rejected" are allowed.');
    }

    // Prepare the base SQL query
    let sql = `
        UPDATE transactions 
        SET transaction_status = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND transaction_status = 'pending';
    `;

    // If the status is 'rejected', add the dispute message to the SQL query
    if (status === 'rejected' && disputeMessage) {
        sql = `
            UPDATE transactions 
            SET transaction_status = ?,
                transaction_dispute_message = ?,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND transaction_status = 'pending';
        `;
    }

    try {
        let result;
        
        // Execute the query based on the status
        if (status === 'accepted') {
            result = await query(sql, [status, transactionId]);
        } else if (status === 'rejected') {
            result = await query(sql, [status, disputeMessage, transactionId]);
        }

        // Check if the transaction was updated
        if (result.affectedRows > 0) {
            return { success: true, message: `Transaction ${status} successfully.` };
        } else {
            return { success: false, message: 'Transaction not found or already confirmed.' };
        }
    } catch (error) {
        throw new Error(`Error updating transaction status: ${error.message}`);
    }
};


paystackService.processedPayment = async (senderPhone, recipientPhone, amount, description, metadata) => {
    // const serviceCharge = amount * 0.04; // 4% service charge
    const serviceCharge = 0.00; // 4% service charge
    const merchantFee = 0.00; // No fee for sender
    
    try {
        // Start SQL transaction
        await query('START TRANSACTION');
        
        // Fetch sender and recipient wallets
        const senderWallet = await walletAndTransactionsService.getWalletByPhone(senderPhone, 'customer');
        const recipientWallet = await walletAndTransactionsService.getWalletByPhone(recipientPhone, 'skill_provider');
        
        // Check sender balance
        const senderBalance = await walletAndTransactionsService.getBalance(senderWallet.id);
        if (senderBalance < amount) {
            throw new Error('Insufficient balance');
        }
        
        // Deduct the amount from the sender's wallet
        await query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [amount, senderWallet.id]);
        
        // Insert transaction record for sender (outflow without service charge)
        const transactionHash = crypto.createHash('sha256')
            .update(`${senderWallet.id}${recipientWallet.id}${amount}${Date.now()}`)
            .digest('hex');
        const invoiceNumber = `INV${Date.now()}`;
        const metadataJSON = metadata ? JSON.stringify({
            ...metadata,
            invoiceNumber,
            description,
            actualAmount: amount,
        }) : JSON.stringify({
            invoiceNumber,
            description,
            actualAmount: amount,
        });
        

        // Insert transaction record for recipient (credit with service charge deducted, but wallet not yet credited)
        const netAmount = amount - serviceCharge;
        await query(`
            INSERT INTO transactions 
            (sender_customer_id, recipient_skill_provider_id, transaction_type, amount, description, transaction_status, fee, transaction_category, service_charge, transaction_hash, metadata)
            VALUES (?, ?, 'transfer', ?, ?, 'pending', 0, 'transfer', ?, ?, ?)
        `, [
            senderWallet.studentId,
            recipientWallet.skillProviderId,
            netAmount,
            description,
            serviceCharge,
            transactionHash,
            metadataJSON,
        ]);
        
        // Commit the transaction
        await query('COMMIT');
        
        return { success: true, message: 'Payment processed successfully, awaiting confirmation.' };
        
    } catch (error) {
        await query('ROLLBACK');
        throw new Error(`Processed payment failed: ${error.message}`);
    }
};

paystackService.processedPaymentAndConfirmations = async (transactionId, customerStatus, skillProviderStatus) => {
    try {
        // Confirm customer payment
        const customerConfirmation = await paystackService.confirmCustomerPayment(transactionId, customerStatus);
        if (!customerConfirmation.success) {
            throw new Error('Customer payment confirmation failed');
        }
        
        // Confirm skill provider payment
        const skillProviderConfirmation = await paystackService.confirmSkillProviderPayment(transactionId, skillProviderStatus);
        if (!skillProviderConfirmation.success) {
            throw new Error('Skill provider payment confirmation failed');
        }
        
        // Both parties confirmed, now credit the skill provider's wallet
        const transaction = await query('SELECT * FROM transactions WHERE id = ?', [transactionId]);
        if (!transaction.length) {
            throw new Error('Transaction not found');
        }
        
        const { sender_customer_id, recipient_skill_provider_id, amount, service_charge } = transaction[0];
        const netAmount = amount - service_charge;

        // Credit the recipient's wallet with the net amount (after service charge deduction)
        await query('UPDATE wallets SET balance = balance + ? WHERE skill_provider_id = ?', [netAmount, recipient_skill_provider_id]);

        return { success: true, message: 'Transaction completed and payment credited to the skill provider.' };
        
    } catch (error) {
        throw new Error(`Processed payment and confirmation failed: ${error.message}`);
    }
};


paystackService.raiseDispute = async (transactionId, raisedBy, raisedById, description) => {
    try {
        const raiseDisputeQuery = `
            INSERT INTO disputes (transaction_id, raised_by, raised_by_customer_id, raised_by_skill_provider_id, description)
            VALUES (?, ?, ?, ?, ?);
        `;
        
        // Assign the raisedById based on the type of dispute
        const raisedBystudentId = raisedBy === 'customer' ? raisedById : null;
        const raisedBySkillProviderId = raisedBy === 'skill_provider' ? raisedById : null;

        await query(raiseDisputeQuery, [transactionId, raisedBy, raisedBystudentId, raisedBySkillProviderId, description]);
        return { success: true, message: 'Dispute raised successfully.' };
    } catch (error) {
        throw new Error('Error raising dispute: ' + error.message);
    }
};


paystackService.getCustomerDisputes = async (studentId) => {
    try {
        const getCustomerDisputesQuery = `
            SELECT 
                d.id AS dispute_id,
                d.transaction_id,
                d.raised_by,
                d.description,
                d.created_at,
                d.status,
                CASE
                    WHEN d.raised_by = 'customer' THEN CONCAT(c.firstName, ' ', c.lastName)
                    WHEN d.raised_by = 'skill_provider' THEN CONCAT(sp.firstName, ' ', sp.lastName)
                END AS raised_by_name,
                c.id AS customer_id,
                c.firstName AS customer_first_name,
                c.lastName AS customer_last_name,
                sp.id AS skill_provider_id,
                sp.firstName AS skill_provider_first_name,
                sp.lastName AS skill_provider_last_name
            FROM 
                disputes d
            LEFT JOIN 
                transactions t ON d.transaction_id = t.id
            LEFT JOIN 
                customers c ON t.sender_customer_id = c.id
            LEFT JOIN 
                skill_providers sp ON t.recipient_skill_provider_id = sp.id
            WHERE 
                d.raised_by = 'customer' AND d.raised_by_customer_id = ?
            ORDER BY 
                d.created_at DESC;
        `;
        
        const disputes = await query(getCustomerDisputesQuery, [studentId]);
        return { success: true, disputes };
    } catch (error) {
        throw new Error('Error retrieving customer disputes: ' + error.message);
    }
};


// Export the service
module.exports = paystackService;


