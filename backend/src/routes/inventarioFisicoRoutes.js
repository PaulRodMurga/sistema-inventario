const express = require('express');
const {
    listarSesiones, crearSesion, obtenerSesion, verificarActivo, cerrarSesion
} = require('../controllers/inventarioFisicoController');

const router = express.Router();
router.get('/', listarSesiones);
router.post('/', crearSesion);
router.get('/:id', obtenerSesion);
router.post('/:id/verificaciones', verificarActivo);
router.post('/:id/cerrar', cerrarSesion);
module.exports = router;
