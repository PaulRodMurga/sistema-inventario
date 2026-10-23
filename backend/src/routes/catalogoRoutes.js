const express = require('express');
const pool = require('../config/database');

const router = express.Router();

router.get('/areas', async (req, res) => {
    try {
        const [datos] = await pool.query(`
      SELECT id, nombre
      FROM area
      WHERE estado = 'ACTIVO'
      ORDER BY nombre
    `);

        res.json({
            success: true,
            data: datos
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            mensaje: 'Error al listar las áreas',
            error: error.message
        });
    }
});

router.get('/cargos', async (req, res) => {
    try {
        const [datos] = await pool.query(`
      SELECT id, nombre
      FROM cargo
      WHERE estado = 'ACTIVO'
      ORDER BY nombre
    `);

        res.json({
            success: true,
            data: datos
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            mensaje: 'Error al listar los cargos',
            error: error.message
        });
    }
});

router.get('/centros-costos', async (req, res) => {
    try {
        const [datos] = await pool.query(`
      SELECT id, codigo, nombre
      FROM centro_costos
      WHERE estado = 'ACTIVO'
      ORDER BY nombre
    `);

        res.json({
            success: true,
            data: datos
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            mensaje: 'Error al listar los centros de costos',
            error: error.message
        });
    }
});

router.get('/unidades-empresariales', async (req, res) => {
    try {
        const [datos] = await pool.query(`
      SELECT id, nombre
      FROM unidad_empresarial
      WHERE estado = 'ACTIVO'
      ORDER BY nombre
    `);

        res.json({
            success: true,
            data: datos
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            mensaje: 'Error al listar las unidades empresariales',
            error: error.message
        });
    }
});

module.exports = router;