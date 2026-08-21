const express = require('express');
const machineController = require('../controllers/machineController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
    bookMachineValidator,
    machineBookedTimesValidator,
    cancelBookingValidator,
    machinePayloadValidator
} = require('../validators/machineValidators');

const router = express.Router();

// ── Public endpoints: View machines and availability ─────────────────────────
router.get('/', machineController.listMachines);
router.get('/available', machineController.listAvailable);
router.get('/:id/booked-times', validate(machineBookedTimesValidator), machineController.bookedTimes);

// ── User only: booking operations ─────────────────────────────────────────────
router.get('/bookings', authenticate, authorize('user'), machineController.history);
router.post('/book', authenticate, authorize('user'), validate(bookMachineValidator), machineController.book);
router.delete('/cancel', authenticate, authorize('user'), validate(cancelBookingValidator), machineController.cancel);

// ── Admin only: CRUD + crowd + all bookings ────────────────────────────────────
router.post('/', authenticate, authorize('admin'), validate(machinePayloadValidator), machineController.createMachine);
router.put('/:id', authenticate, authorize('admin'), validate(machinePayloadValidator), machineController.updateMachine);
router.delete('/:id', authenticate, authorize('admin'), machineController.deleteMachine);
router.post('/crowd', authenticate, authorize('admin'), machineController.addCrowdSnapshot);
router.get('/all-bookings', authenticate, authorize('admin'), machineController.listAllBookings);

module.exports = router;
