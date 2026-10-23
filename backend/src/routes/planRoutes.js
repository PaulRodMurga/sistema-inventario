const express = require('express');

const {
    listarPlanes,
    registrarPlan,
    editarPlan
} = require('../controllers/planController');

const router = express.Router();

router.get('/', listarPlanes);
router.post('/', registrarPlan);
router.put('/:id', editarPlan);

module.exports = router;