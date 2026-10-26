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
        console.error('Error al listar las áreas:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error al listar las áreas'
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
        console.error('Error al listar los cargos:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error al listar los cargos'
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
        console.error('Error al listar los centros de costos:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error al listar los centros de costos'
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
        console.error('Error al listar las unidades empresariales:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error al listar las unidades empresariales'
        });
    }
});

module.exports = router;