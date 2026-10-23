const express = require('express');

const {
    obtenerDashboard
} = require('../controllers/dashboardController');

const router = express.Router();

router.get('/', obtenerDashboard);

module.exports = router;