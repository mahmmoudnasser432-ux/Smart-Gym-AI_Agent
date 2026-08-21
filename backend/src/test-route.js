const express = require('express');
const app = express();

const router = express.Router();
router.get('/', (req, res) => res.send('root'));
router.get('/available', (req, res) => res.send('available'));
router.get('/:id/booked-times', (req, res) => res.send('booked-times'));

router.post('/book', (req, res) => res.send('book'));
router.delete('/cancel', (req, res) => res.send('cancel'));
router.get('/bookings', (req, res) => res.send('bookings'));

app.use('/machine', router);

const req = { method: 'GET', url: '/machine/bookings' };
app._router.handle(req, {
    status: () => ({ json: () => {} }),
    send: (msg) => console.log('Match:', msg)
}, () => console.log('Not Found'));
