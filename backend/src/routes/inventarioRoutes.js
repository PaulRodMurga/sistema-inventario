const express = require('express');

const {
    obtenerInventario,
    buscarPorImei
} = require('../controllers/inventarioController');

const router = express.Router();

router.get('/', obtenerInventario);
router.get('/imei/:imei', buscarPorImei);

module.exports = router;