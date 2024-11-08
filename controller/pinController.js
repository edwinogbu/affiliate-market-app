// pinController.js
const pinServices = require('./../services/pinServices');

// Controller for creating a pin for a student
async function createStudentPin (req, res) {
    const { pin_code, studentId, walletId } = req.body;
    try {
        const result = await pinServices.createStudentPin({ pin_code, studentId, walletId });
        res.status(201).json({ success: true, message: 'Student pin created successfully', data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating student pin', error: error.message });
    }
};

// Controller for creating a pin for a marketer
async function createMarketerPin (req, res) {
    const { pin_code, marketerId, walletId } = req.body;
    try {
        const result = await pinServices.createMarketerPin({ pin_code, marketerId, walletId });
        res.status(201).json({ success: true, message: 'Marketer pin created successfully', data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating marketer pin', error: error.message });
    }
};

// Controller for retrieving a student's pin
async function getStudentPin (req, res) {
    const { studentId } = req.params;
    try {
        const pin = await pinServices.getStudentPin(studentId);
        if (!pin) {
            return res.status(404).json({ success: false, message: 'Student pin not found' });
        }
        res.json({ success: true, data: pin });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving student pin', error: error.message });
    }
};

// Controller for retrieving a marketer's pin
async function  getMarketerPin (req, res){
    const { marketerId } = req.params;
    try {
        const pin = await pinServices.getMarketerPin(marketerId);
        if (!pin) {
            return res.status(404).json({ success: false, message: 'Marketer pin not found' });
        }
        res.json({ success: true, data: pin });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving marketer pin', error: error.message });
    }
};

// Controller for updating a student's pin
async function updateStudentPin (req, res) {
    const { studentId, walletId } = req.params;
    const { newPinCode } = req.body;
    try {
        const result = await pinServices.updateStudentPin(studentId, walletId, newPinCode);
        res.json({ success: true, message: 'Student pin updated successfully', data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating student pin', error: error.message });
    }
};

// Controller for updating a marketer's pin
async function updateMarketerPin (req, res){
    const { marketerId, walletId } = req.params;
    const { newPinCode } = req.body;
    try {
        const result = await pinServices.updateMarketerPin(marketerId, walletId, newPinCode);
        res.json({ success: true, message: 'Marketer pin updated successfully', data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating marketer pin', error: error.message });
    }
};

// Controller for deleting a student's pin
async function deleteStudentPin(req, res){
    const { studentId, walletId } = req.params;
    try {
        await pinServices.deleteStudentPin(studentId, walletId);
        res.json({ success: true, message: 'Student pin deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting student pin', error: error.message });
    }
};

// Controller for deleting a marketer's pin
async function deleteMarketerPin (req, res) {
    const { marketerId, walletId } = req.params;
    try {
        await pinServices.deleteMarketerPin(marketerId, walletId);
        res.json({ success: true, message: 'Marketer pin deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting marketer pin', error: error.message });
    }
};

module.exports = {
    createStudentPin,
    createMarketerPin,
    getStudentPin,
    getMarketerPin,
    updateStudentPin,
    updateMarketerPin,
    deleteStudentPin,
    deleteMarketerPin,
}