// pinRoutes.js
const express = require('express');
const pinController = require('./../controller/pinController');

const router = express.Router();

// Routes for student pins
router.post('/pins/student', pinController.createStudentPin);
router.get('/pins/student/:studentId', pinController.getStudentPin);
router.put('/pins/student/:studentId/wallet/:walletId', pinController.updateStudentPin);
router.delete('/pins/student/:studentId/wallet/:walletId', pinController.deleteStudentPin);

// {
//     "pin_code": "123456",
//     "studentId": 1,
//     "walletId": 1
// }



// Routes for marketer pins
router.post('/pins/marketer', pinController.createMarketerPin);
router.get('/pins/marketer/:marketerId', pinController.getMarketerPin);
router.put('/pins/marketer/:marketerId/wallet/:walletId', pinController.updateMarketerPin);
router.delete('/pins/marketer/:marketerId/wallet/:walletId', pinController.deleteMarketerPin);

// {
//     "pin_code": "654321",
//     "marketerId": 1,
//     "walletId": 1
// }

// updateMarketerPin
// {
//     "newPinCode": "111111"
// }


module.exports = router;
