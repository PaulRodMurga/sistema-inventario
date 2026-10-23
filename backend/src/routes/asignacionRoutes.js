const express = require('express');
const { enviarActaPorCorreo } = require('../controllers/correoActaController');

const {
    listarAsignaciones,
    listarActasDisponibles,
    obtenerAsignacionPorId,
    registrarAsignacion,
    devolverAsignacion
} = require('../controllers/asignacionController');

const router = express.Router();

router.post('/:id/enviar-acta', enviarActaPorCorreo);

router.get('/', listarAsignaciones);

router.get('/actas-disponibles', listarActasDisponibles);

router.get('/:id', obtenerAsignacionPorId);

router.post('/', registrarAsignacion);

router.put('/:id/devolver', devolverAsignacion);

module.exports = router;
