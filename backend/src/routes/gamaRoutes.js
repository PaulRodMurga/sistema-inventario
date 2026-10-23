const express = require('express');

const {
    listarGamas,
    registrarGama,
    editarGama,
    inhabilitarGama
} = require('../controllers/gamaController');

const router = express.Router();

router.get('/', listarGamas);
router.post('/', registrarGama);
router.put('/:id/inhabilitar', inhabilitarGama);
router.put('/:id', editarGama);

module.exports = router;
