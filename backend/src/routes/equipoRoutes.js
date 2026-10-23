const express = require('express');

const {
    listarTiposEquipo,
    listarEquipos,
    buscarPorImei,
    buscarPorSerie,
    registrarEquipo,
    registrarEquiposLote,
    editarEquipo,
    obtenerEquipoPorId
} = require('../controllers/equipoController');
const {
    desvincularPerifericoEquipo,
    listarPerifericosDisponibles,
    listarPerifericosEquipo,
    reemplazarPerifericoEquipo
} = require('../controllers/perifericoController');
const {
    importarEquipos,
    validarImportacionEquipos
} = require('../controllers/importacionEquipoController');

const router = express.Router();

router.get('/', listarEquipos);

router.get('/tipos', listarTiposEquipo);

router.get('/imei/:imei', buscarPorImei);

router.get('/serie/:serie', buscarPorSerie);

router.post('/lote', registrarEquiposLote);

router.post('/importar/validar', validarImportacionEquipos);

router.post('/importar', importarEquipos);

router.get('/perifericos-disponibles/:tipo', listarPerifericosDisponibles);

router.get('/:id/perifericos', listarPerifericosEquipo);

router.put('/:id/perifericos/:tipo/:vinculoId', reemplazarPerifericoEquipo);
router.put('/:id/perifericos/:tipo', reemplazarPerifericoEquipo);

router.delete('/:id/perifericos/:tipo/:vinculoId', desvincularPerifericoEquipo);
router.delete('/:id/perifericos/:tipo', desvincularPerifericoEquipo);


router.post('/', registrarEquipo);

router.put('/:id', editarEquipo);

router.get('/:id', obtenerEquipoPorId);

module.exports = router;
