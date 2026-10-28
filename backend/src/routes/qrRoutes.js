const express = require('express');
const { listarActivosQR } = require('../controllers/qrController');

const router = express.Router();

router.get('/activos', listarActivosQR);

module.exports = router;
