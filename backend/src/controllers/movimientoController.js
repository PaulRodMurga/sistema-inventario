const pool = require('../config/database');


// ==========================================
// LISTAR TODOS LOS MOVIMIENTOS
// ==========================================
const listarMovimientos = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                m.id,
                m.fecha,
                m.tipo_movimiento,
                m.descripcion,

                e.id AS equipo_id,
                e.tipo,
                e.marca,
                e.modelo,
                e.imei,
                e.serie,
                e.estado_actual,

                c.id AS colaborador_id,
                c.codigo AS codigo_colaborador,
                CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,

                a.id AS asignacion_id,

                aut.id AS autorizado_por_id,
                CONCAT(aut.apellidos, ', ', aut.nombres) AS autorizado_por

            FROM movimiento_equipo m

            INNER JOIN equipo e
                ON e.id = m.equipo_id

            LEFT JOIN colaborador c
                ON c.id = m.colaborador_id

            LEFT JOIN asignacion a
                ON a.id = m.asignacion_id

            LEFT JOIN colaborador aut
                ON aut.id = m.autorizado_por

            ORDER BY m.fecha DESC, m.id DESC
        `);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {

        console.error('Error al listar movimientos:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener movimientos',
            error: error.message
        });

    }
};


// ==========================================
// BUSCAR MOVIMIENTOS POR EQUIPO
// ==========================================
const movimientosPorEquipo = async (req, res) => {
    try {

        const { equipo_id } = req.params;

        const [rows] = await pool.query(`
            SELECT
                m.id,
                m.fecha,
                m.tipo_movimiento,
                m.descripcion,

                e.marca,
                e.modelo,
                e.imei,
                e.serie,

                CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,

                CONCAT(aut.apellidos, ', ', aut.nombres) AS autorizado_por

            FROM movimiento_equipo m

            INNER JOIN equipo e
                ON e.id = m.equipo_id

            LEFT JOIN colaborador c
                ON c.id = m.colaborador_id

            LEFT JOIN colaborador aut
                ON aut.id = m.autorizado_por

            WHERE m.equipo_id = ?

            ORDER BY m.fecha DESC, m.id DESC
        `, [equipo_id]);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {

        console.error('Error al buscar movimientos:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al buscar movimientos del equipo',
            error: error.message
        });

    }
};


// ==========================================
// BUSCAR MOVIMIENTOS POR IMEI
// ==========================================
const movimientosPorImei = async (req, res) => {
    try {

        const { imei } = req.params;

        const [rows] = await pool.query(`
            SELECT
                m.id,
                m.fecha,
                m.tipo_movimiento,
                m.descripcion,

                e.id AS equipo_id,
                e.marca,
                e.modelo,
                e.imei,
                e.serie,
                e.estado_actual,

                CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,

                CONCAT(aut.apellidos, ', ', aut.nombres) AS autorizado_por

            FROM movimiento_equipo m

            INNER JOIN equipo e
                ON e.id = m.equipo_id

            LEFT JOIN colaborador c
                ON c.id = m.colaborador_id

            LEFT JOIN colaborador aut
                ON aut.id = m.autorizado_por

            WHERE e.imei = ?

            ORDER BY m.fecha DESC, m.id DESC
        `, [imei]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontraron movimientos para ese IMEI'
            });
        }

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {

        console.error('Error al buscar historial por IMEI:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al buscar historial',
            error: error.message
        });

    }
};


// ==========================================
// OBTENER MOVIMIENTO POR ID
// ==========================================
const obtenerMovimientoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const [filas] = await pool.query(
            `
            SELECT
                me.id,
                me.fecha,
                me.tipo_movimiento,
                me.descripcion,
                me.autorizado_por,
                me.autorizado_por AS autorizado_por_id,
                CONCAT(aut.apellidos, ', ', aut.nombres) AS autorizado_por_nombre,
                me.asignacion_id,

                me.equipo_id,
                e.tipo AS tipo_equipo,
                e.marca,
                e.modelo,
                e.imei,
                e.serie,
                e.estado_actual AS estado_equipo,

                me.colaborador_id,
                c.codigo AS codigo_colaborador,
                c.apellidos,
                c.nombres,
                c.dni,
                ue.nombre AS unidad_empresarial,

                CONCAT(
                    COALESCE(c.apellidos, ''),
                    CASE
                        WHEN c.apellidos IS NOT NULL
                             AND c.nombres IS NOT NULL
                        THEN ', '
                        ELSE ''
                    END,
                    COALESCE(c.nombres, '')
                ) AS colaborador

            FROM movimiento_equipo me

            LEFT JOIN equipo e
                ON e.id = me.equipo_id

            LEFT JOIN colaborador c
                ON c.id = me.colaborador_id

            LEFT JOIN unidad_empresarial ue
                ON ue.id = c.unidad_empresarial_id

            LEFT JOIN colaborador aut
                ON aut.id = me.autorizado_por

            WHERE me.id = ?
            `,
            [id]
        );

        if (filas.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Movimiento no encontrado'
            });
        }

        return res.json({
            success: true,
            data: filas[0]
        });
    } catch (error) {
        console.error(
            'Error al obtener el movimiento:',
            error
        );

        return res.status(500).json({
            success: false,
            mensaje: 'Error al obtener el movimiento',
            error: error.message
        });
    }
};

// ==========================================
// REGISTRAR MOVIMIENTO ESPECIAL
// ==========================================
const registrarMovimiento = async (req, res) => {
    try {

        const {
            equipo_id,
            colaborador_id,
            tipo_movimiento,
            descripcion,
            autorizado_por
        } = req.body;

        if (!equipo_id || !tipo_movimiento) {
            return res.status(400).json({
                success: false,
                mensaje: 'equipo_id y tipo_movimiento son obligatorios'
            });
        }

        const movimientosPermitidos = [
            'CAMBIO',
            'PERDIDA',
            'ROBO',
            'REPOSICION',
            'CUSTODIA',
            'BAJA',
            'RENOVACION_18_MESES'
        ];

        if (!movimientosPermitidos.includes(tipo_movimiento)) {
            return res.status(400).json({
                success: false,
                mensaje:
                    'El tipo de movimiento no es válido para registro manual'
            });
        }

        const [resultado] = await pool.query(`
            INSERT INTO movimiento_equipo (
                equipo_id,
                colaborador_id,
                fecha,
                tipo_movimiento,
                descripcion,
                autorizado_por
            )
            VALUES (?, ?, NOW(), ?, ?, ?)
        `, [
            equipo_id,
            colaborador_id || null,
            tipo_movimiento,
            descripcion || null,
            autorizado_por || null
        ]);

        res.status(201).json({
            success: true,
            mensaje: 'Movimiento registrado correctamente',
            id: resultado.insertId
        });

    } catch (error) {

        console.error('Error al registrar movimiento:', error);

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje:
                    'El equipo, colaborador o autorizador indicado no existe'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al registrar movimiento',
            error: error.message
        });

    }
};


module.exports = {
    listarMovimientos,
    movimientosPorEquipo,
    movimientosPorImei,
    obtenerMovimientoPorId,
    registrarMovimiento
};
