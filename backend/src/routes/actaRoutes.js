const express = require('express');

const {
    listarActas,
    obtenerActaPorId,
    registrarActa,
    editarActa
} = require('../controllers/actaController');

const router = express.Router();

router.get('/', listarActas);

router.get('/:id', obtenerActaPorId);

router.post('/', registrarActa);

router.put('/:id', editarActa);

module.exports = router;