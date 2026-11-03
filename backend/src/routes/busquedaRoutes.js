const express = require('express');
const { buscarGlobalmente } = require('../controllers/busquedaController');

const router = express.Router();

router.get('/', buscarGlobalmente);

module.exports = router;
