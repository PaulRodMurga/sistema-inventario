const express = require('express');
const {
    listarSesiones, crearSesion, obtenerSesion, verificarActivo, verificarQRJornadaActual, cerrarSesion
} = require('../controllers/inventarioFisicoController');

const router = express.Router();
router.get('/', listarSesiones);
router.post('/', crearSesion);
router.post('/verificar-qr/:codigo', verificarQRJornadaActual);
router.get('/:id', obtenerSesion);
router.post('/:id/verificaciones', verificarActivo);
router.post('/:id/cerrar', cerrarSesion);
module.exports = router;
