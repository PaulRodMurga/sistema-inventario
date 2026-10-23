const express = require('express');

const {
    listarColaboradores,
    buscarPorDni,
    registrarColaborador,
    obtenerColaboradorPorId,
    actualizarColaborador
} = require('../controllers/colaboradorController');
const {
    importarColaboradores,
    validarImportacionColaboradores
} = require('../controllers/importacionColaboradorController');

const router = express.Router();

router.get('/', listarColaboradores);

router.get('/dni/:dni', buscarPorDni);

router.post('/', registrarColaborador);

router.post('/importar/validar', validarImportacionColaboradores);

router.post('/importar', importarColaboradores);

router.get('/:id', obtenerColaboradorPorId);

router.put('/:id', actualizarColaborador);

module.exports = router;
