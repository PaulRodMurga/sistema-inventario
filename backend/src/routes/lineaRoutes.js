const express = require('express');

const {
    listarLineas,
    buscarPorNumero,
    registrarLinea,
    obtenerLineaPorId,
    actualizarLinea
} = require('../controllers/lineaController');

const router = express.Router();

router.get('/', listarLineas);

router.get(
    '/numero/:numero',
    buscarPorNumero
);

router.post(
    '/',
    registrarLinea
);

router.get(
    '/:id',
    obtenerLineaPorId
);

router.put(
    '/:id',
    actualizarLinea
);

module.exports = router;