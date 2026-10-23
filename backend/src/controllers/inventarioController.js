const pool = require('../config/database');

const obtenerInventario = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT *
            FROM vw_inventario
            ORDER BY equipo_id
        `);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {
        console.error('Error al consultar inventario:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al consultar el inventario',
            error: error.message
        });
    }
};

const buscarPorImei = async (req, res) => {
    try {
        const { imei } = req.params;

        const [rows] = await pool.query(`
            SELECT *
            FROM vw_inventario
            WHERE imei = ?
        `, [imei]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontró ningún equipo con ese IMEI'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('Error buscando IMEI:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al buscar el equipo',
            error: error.message
        });
    }
};

module.exports = {
    obtenerInventario,
    buscarPorImei
};