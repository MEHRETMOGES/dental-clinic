const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { registerPatient, getAllPatients, getPatientById, updatePatient } = require('../controllers/patientController');

router.use(requireAuth);
router.post('/', registerPatient);
router.get('/', getAllPatients);
router.get('/:id', getPatientById);
router.put('/:id', updatePatient);

module.exports = router;