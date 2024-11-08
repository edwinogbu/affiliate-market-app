// controllers/walletController.js
const walletService = require('../services/walletAndTransactionsService');

const walletController = {};

// Create a wallet for a student
walletController.createStudentsWallet = async (req, res) => {
    try {
        const { studentId } = req.body;
        const wallet = await walletService.createStudentsWallet(studentId);
        res.status(201).json({ success: true, wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a wallet for a marketer
walletController.createMarketersWallet = async (req, res) => {
    try {
        const { marketerId } = req.body;
        const wallet = await walletService.createMarketersWallet(marketerId);
        res.status(201).json({ success: true, wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Retrieve wallet details for a student
walletController.getStudentsWallet = async (req, res) => {
    try {
        const { studentId } = req.params;
        const wallet = await walletService.getStudentsWallet(studentId);
        res.status(200).json({ success: true, wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Retrieve wallet details for a marketer
walletController.getMarketersWallet = async (req, res) => {
    try {
        const { marketerId } = req.params;
        const wallet = await walletService.getMarketersWallet(marketerId);
        res.status(200).json({ success: true, wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update wallet balance for a student
walletController.updateStudentsBalance = async (req, res) => {
    try {
        const { studentId, amount } = req.body;
        await walletService.updateStudentsBalance(studentId, amount);
        res.status(200).json({ success: true, message: 'Balance updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update wallet balance for a marketer
walletController.updateMarketersBalance = async (req, res) => {
    try {
        const { marketerId, amount } = req.body;
        await walletService.updateMarketersBalance(marketerId, amount);
        res.status(200).json({ success: true, message: 'Balance updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a transaction
walletController.createTransaction = async (req, res) => {
    try {
        const transactionData = req.body;
        const transaction = await walletService.createTransaction(transactionData);
        res.status(201).json({ success: true, transaction });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all transactions for a student
walletController.getStudentsTransactions = async (req, res) => {
    try {
        const { studentId } = req.params;
        const transactions = await walletService.getStudentsTransactions(studentId);
        res.status(200).json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all transactions for a marketer
walletController.getMarketersTransactions = async (req, res) => {
    try {
        const { marketerId } = req.params;
        const transactions = await walletService.getMarketersTransactions(marketerId);
        res.status(200).json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = walletController;
