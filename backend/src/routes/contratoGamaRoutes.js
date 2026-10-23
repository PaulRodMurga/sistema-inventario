const express = require('express');

const {
    listarContratoGamas,
    registrarContratoGama,
    editarContratoGama
} = require('../controllers/contratoGamaController');

const router = express.Router();

router.get('/', listarContratoGamas);
router.post('/', registrarContratoGama);
router.put('/:id', editarContratoGama);

module.exports = router;