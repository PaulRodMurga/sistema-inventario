const express = require('express');

const {
    actualizarUsuario,
    listarUsuarios,
    registrarUsuario,
    restablecerClave
} = require('../controllers/usuarioController');

const router = express.Router();

router.get('/', listarUsuarios);
router.post('/', registrarUsuario);
router.put('/:id/clave', restablecerClave);
router.put('/:id', actualizarUsuario);

module.exports = router;
