const express = require('express');
const {
    listarOpcionesJornada, listarSesiones, crearSesion, obtenerSesion, verificarActivo, verificarQRJornadaActual, cerrarSesion
} = require('../controllers/inventarioFisicoController');

const router = express.Router();
router.get('/catalogos/opciones', listarOpcionesJornada);
router.get('/', listarSesiones);
router.post('/', crearSesion);
router.post('/verificar-qr/:codigo', verificarQRJornadaActual);
router.get('/:id', obtenerSesion);
router.post('/:id/verificaciones', verificarActivo);
router.post('/:id/cerrar', cerrarSesion);
module.exports = router;
