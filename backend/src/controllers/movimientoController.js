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
            mensaje: 'Error al obtener movimientos'
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
                m.equipo_id,
                m.colaborador_id,
                m.asignacion_id,
                m.autorizado_por AS autorizado_por_id,

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
            mensaje: 'Error al buscar movimientos del equipo'
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
            mensaje: 'Error al buscar historial'
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
            mensaje: 'Error al obtener el movimiento'
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
            mensaje: 'Error al registrar movimiento'
        });

    }
};


// ==========================================
// HISTORIAL INTEGRAL DE UN EQUIPO
// ==========================================
const historialCompletoPorEquipo = async (req, res) => {
    const equipoId = Number(req.params.equipo_id);
    if (!Number.isSafeInteger(equipoId) || equipoId <= 0) {
        return res.status(400).json({ success: false, mensaje: 'Identificador de equipo inválido' });
    }

    try {
        const [equipos] = await pool.query(
            'SELECT id, tipo, marca, modelo, serie FROM equipo WHERE id = ? LIMIT 1',
            [equipoId]
        );
        if (!equipos.length) {
            return res.status(404).json({ success: false, mensaje: 'El equipo no existe' });
        }

        const [movimientos] = await pool.query(`
            SELECT m.id, m.fecha, m.tipo_movimiento AS tipo, m.descripcion,
                m.equipo_id AS activo_id, e.tipo AS tipo_activo,
                e.marca, e.modelo, e.serie,
                CONCAT_WS(', ', c.apellidos, c.nombres) AS colaborador,
                CONCAT_WS(', ', aut.apellidos, aut.nombres) AS autorizado_por,
                m.asignacion_id
            FROM movimiento_equipo m
            INNER JOIN equipo e ON e.id = m.equipo_id
            LEFT JOIN colaborador c ON c.id = m.colaborador_id
            LEFT JOIN colaborador aut ON aut.id = m.autorizado_por
            WHERE m.equipo_id = ?
               OR (m.descripcion LIKE CONCAT('%equipo principal ID ', ?, '%'))
            ORDER BY m.fecha DESC, m.id DESC
        `, [equipoId, equipoId]);

        const [auditorias] = await pool.query(`
            SELECT a.id, a.creado_en AS fecha, a.accion AS tipo,
                a.recurso, a.recurso_id, a.metodo, a.ruta, a.resultado,
                a.estado_http, a.cuenta_usuario, a.nombre_usuario, a.rol_usuario
            FROM auditoria a
            WHERE (a.recurso = 'equipos' AND a.recurso_id = ?)
               OR a.ruta LIKE CONCAT('%/api/equipos/', ?, '/perifericos/%')
            ORDER BY a.creado_en DESC, a.id DESC
        `, [equipoId, equipoId]);

        const [verificaciones] = await pool.query(`
            SELECT d.id, d.fecha_verificacion AS fecha, d.estado_revision,
                d.ubicacion_esperada, d.ubicacion_observada, d.observaciones,
                i.id AS inventario_id, i.nombre AS inventario,
                i.estado AS estado_inventario,
                u.nombre AS verificado_por
            FROM detalle_inventario_fisico d
            INNER JOIN inventario_fisico i ON i.id = d.inventario_fisico_id
            LEFT JOIN usuario u ON u.id = d.verificado_por
            WHERE d.equipo_id = ?
            ORDER BY COALESCE(d.fecha_verificacion, i.fecha_inicio) DESC, d.id DESC
        `, [equipoId]);

        const eventos = [
            ...movimientos.map((m) => ({
                id: `movimiento-${m.id}`, origen: 'MOVIMIENTO', fecha: m.fecha,
                tipo: m.tipo, descripcion: m.descripcion,
                activo_id: m.activo_id, activo: [m.tipo_activo, m.marca, m.modelo].filter(Boolean).join(' '),
                serie: m.serie, colaborador: m.colaborador,
                autorizado_por: m.autorizado_por, asignacion_id: m.asignacion_id
            })),
            ...auditorias.map((a) => ({
                id: `auditoria-${a.id}`, origen: 'AUDITORIA', fecha: a.fecha,
                tipo: a.accion, descripcion: `${a.metodo || ''} ${a.ruta || ''}`.trim(),
                usuario: a.nombre_usuario || a.cuenta_usuario || 'Usuario no identificado',
                rol: a.rol_usuario, resultado: a.resultado, estado_http: a.estado_http
            })),
            ...verificaciones.map((v) => ({
                id: `inventario-${v.id}`, origen: 'INVENTARIO_FISICO', fecha: v.fecha,
                tipo: 'VERIFICACION_FISICA', estado_revision: v.estado_revision,
                descripcion: v.observaciones || `Jornada: ${v.inventario}. Estado: ${v.estado_revision.replaceAll('_', ' ').toLowerCase()}.`,
                inventario_id: v.inventario_id, inventario: v.inventario,
                ubicacion_esperada: v.ubicacion_esperada,
                ubicacion_observada: v.ubicacion_observada,
                usuario: v.verificado_por || null
            }))
        ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        return res.json({ success: true, equipo: equipos[0], cantidad: eventos.length, data: eventos });
    } catch (error) {
        console.error('Error al obtener historial integral del equipo:', error);
        return res.status(500).json({ success: false, mensaje: 'No se pudo obtener el historial completo del equipo' });
    }
};


module.exports = {
    listarMovimientos,
    movimientosPorEquipo,
    historialCompletoPorEquipo,
    movimientosPorImei,
    obtenerMovimientoPorId,
    registrarMovimiento
};
