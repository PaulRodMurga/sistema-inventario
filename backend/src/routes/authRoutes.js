const express = require('express');

const {
    cerrarSesion,
    iniciarSesion,
    obtenerSesion
} = require('../controllers/authController');
const {
    requiereAutenticacion
} = require('../middleware/autenticacion');

const router = express.Router();

router.post('/login', iniciarSesion);
router.get('/sesion', requiereAutenticacion, obtenerSesion);
router.post('/logout', requiereAutenticacion, cerrarSesion);

module.exports = router;
