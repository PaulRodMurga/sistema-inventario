const express = require('express');

const {
    listarOperadores,
    registrarOperador,
    obtenerOperadorPorId,
    editarOperador
} = require('../controllers/operadorController');

const router = express.Router();

router.get('/', listarOperadores);
router.post('/', registrarOperador);
router.put('/:id', editarOperador);
router.get('/:id', obtenerOperadorPorId);

module.exports = router;