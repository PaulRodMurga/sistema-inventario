const express = require('express');

const {
    listarActas,
    obtenerActaPorId,
    registrarActa,
    editarActa
} = require('../controllers/actaController');

const {
    subirFirmasActa,
    subirDevolucionActa,
    descargarFirmasActa,
    descargarDevolucionActa
} = require('../controllers/actaDocumentoController');

const router = express.Router();

// Rutas específicas antes de /:id para evitar que se interpreten como IDs.
router.post('/:id/documentos/firmas', subirFirmasActa);
router.get('/:id/documentos/firmas', descargarFirmasActa);
router.post('/:id/documentos/devolucion', subirDevolucionActa);
router.get('/:id/documentos/devolucion', descargarDevolucionActa);

router.get('/', listarActas);
router.get('/:id', obtenerActaPorId);
router.post('/', registrarActa);
router.put('/:id', editarActa);

module.exports = router;
