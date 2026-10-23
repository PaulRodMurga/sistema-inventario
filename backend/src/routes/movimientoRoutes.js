const express = require('express');

const {
    listarMovimientos,
    movimientosPorEquipo,
    movimientosPorImei,
    obtenerMovimientoPorId,
    registrarMovimiento
} = require('../controllers/movimientoController');

const router = express.Router();

router.get('/', listarMovimientos);

router.get('/:id', obtenerMovimientoPorId);

router.get('/equipo/:equipo_id', movimientosPorEquipo);

router.get('/imei/:imei', movimientosPorImei);

router.post('/', registrarMovimiento);

module.exports = router;