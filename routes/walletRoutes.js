// routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const walletController = require('../controller/walletController');

// Routes for student wallets
router.post('/students/wallet', walletController.createStudentsWallet);
router.get('/students/wallet/:studentId', walletController.getStudentsWallet);
router.put('/students/wallet/balance', walletController.updateStudentsBalance);
router.get('/students/:studentId/transactions', walletController.getStudentsTransactions);

// Routes for marketer wallets
router.post('/marketers/wallet', walletController.createMarketersWallet);
router.get('/marketers/wallet/:marketerId', walletController.getMarketersWallet);
router.put('/marketers/wallet/balance', walletController.updateMarketersBalance);
router.get('/marketers/:marketerId/transactions', walletController.getMarketersTransactions);

// Create transaction
router.post('/transactions', walletController.createTransaction);

module.exports = router;
