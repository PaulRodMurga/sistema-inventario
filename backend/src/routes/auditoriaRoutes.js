const express = require('express');

const {
    listarAuditoria
} = require('../controllers/auditoriaController');

const router = express.Router();

router.get('/', listarAuditoria);

module.exports = router;

