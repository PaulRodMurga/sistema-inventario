const express = require('express');

const {
    listarContratos,
    obtenerContrato,
    registrarContrato,
    editarContrato,
    inhabilitarContrato,
    actualizarGamasContrato
} = require('../controllers/contratoController');

const router = express.Router();

router.get('/', listarContratos);
router.get('/:id', obtenerContrato);
router.post('/', registrarContrato);
router.put('/:id/inhabilitar', inhabilitarContrato);
router.put('/:id/gamas', actualizarGamasContrato);
router.put('/:id', editarContrato);

module.exports = router;
