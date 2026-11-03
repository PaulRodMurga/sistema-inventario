const express = require('express');

const {
    actualizarClavePerfil,
    actualizarFotoPerfil,
    actualizarNombrePerfil,
    eliminarFotoPerfil,
    obtenerPerfil
} = require('../controllers/perfilController');
const { recibirFotoPerfil } = require('../middleware/subidaFotoPerfil');

const router = express.Router();

router.get('/', obtenerPerfil);
router.put('/clave', actualizarClavePerfil);
router.put('/', actualizarNombrePerfil);
router.post('/foto', recibirFotoPerfil, actualizarFotoPerfil);
router.delete('/foto', eliminarFotoPerfil);

module.exports = router;
