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
// HISTORIAL COMPLETO DEL EQUIPO
// ==========================================
const historialCompletoPorEquipo = async (req, res) => {
    const equipoId = Number(req.params.equipo_id);

    if (!Number.isSafeInteger(equipoId) || equipoId <= 0) {
        return res.status(400).json({
            success: false,
            mensaje: 'El ID del equipo no es válido'
        });
    }

    try {
        const [equipos] = await pool.query(
            'SELECT id, tipo, marca, modelo, serie FROM equipo WHERE id = ?',
            [equipoId]
        );

        if (equipos.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Equipo no encontrado'
            });
        }

        // Los periféricos conservan sus movimientos bajo su propio equipo_id.
        // La descripción permite recuperar también vínculos que ya fueron eliminados.
        const [movimientos] = await pool.query(`
            SELECT
                m.id,
                m.fecha,
                m.tipo_movimiento,
                m.descripcion,
                m.equipo_id,
                e.tipo AS tipo_equipo,
                e.marca,
                e.modelo,
                e.serie,
                CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,
                CONCAT(aut.apellidos, ', ', aut.nombres) AS autorizado_por
            FROM movimiento_equipo m
            INNER JOIN equipo e ON e.id = m.equipo_id
            LEFT JOIN colaborador c ON c.id = m.colaborador_id
            LEFT JOIN colaborador aut ON aut.id = m.autorizado_por
            WHERE m.equipo_id = ?
               OR m.descripcion LIKE CONCAT('%equipo principal ID ', ?, '%')
            ORDER BY m.fecha DESC, m.id DESC
        `, [equipoId, equipoId]);

        const [auditorias] = await pool.query(`
            SELECT
                id,
                usuario_id,
                nombre_usuario,
                rol_usuario,
                accion,
                recurso,
                recurso_id,
                metodo,
                ruta,
                resultado,
                estado_http,
                creado_en
            FROM auditoria
            WHERE recurso = 'equipos'
              AND recurso_id = ?
            ORDER BY creado_en DESC, id DESC
        `, [equipoId]);

        const [inventarios] = await pool.query(`
            SELECT
                d.id,
                d.inventario_fisico_id,
                d.estado_revision,
                d.fecha_verificacion,
                d.ubicacion_esperada,
                d.ubicacion_observada,
                d.observaciones,
                i.nombre AS jornada,
                i.fecha_inicio,
                i.fecha_cierre,
                i.estado AS estado_jornada,
                responsable.nombre AS responsable,
                verificador.nombre AS verificado_por
            FROM detalle_inventario_fisico d
            INNER JOIN inventario_fisico i
                ON i.id = d.inventario_fisico_id
            INNER JOIN usuario responsable
                ON responsable.id = i.responsable_id
            LEFT JOIN usuario verificador
                ON verificador.id = d.verificado_por
            WHERE d.equipo_id = ?
            ORDER BY COALESCE(d.fecha_verificacion, i.fecha_inicio) DESC, d.id DESC
        `, [equipoId]);

        const eventosMovimiento = movimientos.map((m) => ({
            id: `movimiento-${m.id}`,
            origen: 'MOVIMIENTO',
            fecha: m.fecha,
            tipo_movimiento: m.tipo_movimiento,
            descripcion: m.descripcion || `Movimiento de ${m.tipo_equipo || 'equipo'}`,
            equipo_id: m.equipo_id,
            equipo_relacionado: m.equipo_id === equipoId
                ? null
                : `${m.tipo_equipo || 'Periférico'} ${m.marca || ''} ${m.modelo || ''}`.trim(),
            colaborador: m.colaborador,
            usuario: null,
            autorizado_por: m.autorizado_por
        }));

        const auditoriasUsadas = new Set();
        const eventosAuditoria = auditorias.map((a) => {
            // Une la auditoría con el movimiento de cambio equivalente cuando coinciden
            // en el tiempo. Así evitamos duplicar el mismo evento en la cronología.
            const indice = eventosMovimiento.findIndex((m) =>
                m.tipo_movimiento === 'CAMBIO' &&
                Math.abs(new Date(m.fecha).getTime() - new Date(a.creado_en).getTime()) <= 5000 &&
                !m.usuario
            );

            if (indice >= 0) {
                eventosMovimiento[indice].usuario = a.nombre_usuario || 'No registrado';
                eventosMovimiento[indice].auditoria = {
                    accion: a.accion,
                    resultado: a.resultado,
                    ruta: a.ruta,
                    rol: a.rol_usuario
                };
                auditoriasUsadas.add(a.id);
                return null;
            }

            return {
                id: `auditoria-${a.id}`,
                origen: 'AUDITORIA',
                fecha: a.creado_en,
                tipo_movimiento: a.accion,
                descripcion: `${a.metodo || ''} ${a.ruta || ''} — ${a.resultado || 'Resultado no registrado'}`.trim(),
                equipo_id: equipoId,
                colaborador: null,
                usuario: a.nombre_usuario || 'No registrado',
                rol_usuario: a.rol_usuario,
                resultado: a.resultado
            };
        }).filter(Boolean);

        const eventosInventario = inventarios.map((d) => ({
            id: `inventario-${d.id}`,
            origen: 'INVENTARIO_FISICO',
            fecha: d.fecha_verificacion || d.fecha_inicio,
            tipo_movimiento: d.estado_revision === 'PENDIENTE'
                ? 'INCLUIDO_EN_JORNADA'
                : d.estado_revision,
            descripcion: d.estado_revision === 'PENDIENTE'
                ? `Equipo incluido en la jornada "${d.jornada}". Aún no registra verificación.`
                : `Revisión de la jornada "${d.jornada}".${d.observaciones ? ` Observaciones: ${d.observaciones}` : ''}`,
            equipo_id: equipoId,
            jornada: d.jornada,
            estado_jornada: d.estado_jornada,
            ubicacion_esperada: d.ubicacion_esperada,
            ubicacion_observada: d.ubicacion_observada,
            responsable: d.responsable,
            usuario: d.estado_revision === 'PENDIENTE'
                ? d.responsable
                : (d.verificado_por || 'No registrado'),
            estado_revision: d.estado_revision
        }));

        const historial = [
            ...eventosMovimiento,
            ...eventosAuditoria,
            ...eventosInventario
        ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return res.json({
            success: true,
            equipo: equipos[0],
            cantidad: historial.length,
            data: historial
        });
    } catch (error) {
        console.error('Error al obtener el historial completo del equipo:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'No se pudo obtener el historial completo del equipo'
        });
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
