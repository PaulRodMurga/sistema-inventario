const express = require('express');
const { listarActivosQR, obtenerActivoQR } = require('../controllers/qrController');

const router = express.Router();

router.get('/activos', listarActivosQR);
router.get('/activo/:codigo', obtenerActivoQR);

module.exports = router;
