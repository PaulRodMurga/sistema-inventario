const express = require('express');
const { obtenerReportes } = require('../controllers/reportesController');
const router = express.Router();
router.get('/', obtenerReportes);
module.exports = router;
