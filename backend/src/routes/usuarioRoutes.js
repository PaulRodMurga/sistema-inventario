const express = require('express');

const {
    actualizarUsuario,
    desbloquearUsuario,
    listarUsuarios,
    registrarUsuario,
    restablecerClave,
    revocarSesionUsuario
} = require('../controllers/usuarioController');

const router = express.Router();

router.get('/', listarUsuarios);
router.post('/:id/desbloquear', desbloquearUsuario);
router.delete('/:id/sesion', revocarSesionUsuario);
router.post('/', registrarUsuario);
router.put('/:id/clave', restablecerClave);
router.put('/:id', actualizarUsuario);

module.exports = router;
