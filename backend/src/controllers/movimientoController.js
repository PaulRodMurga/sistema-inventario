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
            `
            SELECT
                id,
                tipo,
                marca,
                modelo,
                serie,
                codigo_patrimonial,
                estado_actual
            FROM equipo
            WHERE id = ?
            LIMIT 1
            `,
            [equipoId]
        );

        if (equipos.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Equipo no encontrado'
            });
        }

        // Movimientos del equipo principal y de los periféricos vinculados.
        const [movimientos] = await pool.query(`
            SELECT
                m.id,
                m.fecha,
                m.tipo_movimiento,
                m.descripcion,
                m.equipo_id,
                m.asignacion_id,
                e.tipo AS tipo_equipo,
                e.marca,
                e.modelo,
                e.serie,
                CONCAT_WS(', ', c.apellidos, c.nombres) AS colaborador,
                CONCAT_WS(', ', aut.apellidos, aut.nombres) AS autorizado_por
            FROM movimiento_equipo m
            INNER JOIN equipo e ON e.id = m.equipo_id
            LEFT JOIN colaborador c ON c.id = m.colaborador_id
            LEFT JOIN colaborador aut ON aut.id = m.autorizado_por
            WHERE m.equipo_id = ?
               OR m.descripcion LIKE CONCAT('%equipo principal ID ', ?, '%')
            ORDER BY m.fecha DESC, m.id DESC
        `, [equipoId, equipoId]);

        // Fuente directa de asignaciones: permite mostrar la entrega/devolución
        // aunque algún trigger no haya generado su fila en movimiento_equipo.
        const [asignaciones] = await pool.query(`
            SELECT
                a.id,
                a.fecha_asignacion,
                a.fecha_devolucion,
                a.modalidad,
                a.ubicacion,
                a.estado AS estado_asignacion,
                a.acta_id,
                CONCAT_WS(', ', c.apellidos, c.nombres) AS colaborador,
                c.codigo AS codigo_colaborador,
                l.numero AS numero_linea,
                ac.nro_acta,
                ac.estado AS estado_acta,
                ac.firmo_amo,
                ac.firmo_dmo
            FROM asignacion a
            INNER JOIN colaborador c ON c.id = a.colaborador_id
            LEFT JOIN linea l ON l.id = a.linea_id
            LEFT JOIN acta ac ON ac.id = a.acta_id
            WHERE a.equipo_id = ?
            ORDER BY a.fecha_asignacion, a.id
        `, [equipoId]);

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

        const [detallesActa] = await pool.query(`
            SELECT
                da.id,
                da.acta_id,
                da.fecha_entrega,
                da.fecha_devolucion,
                da.devolvio_equipo,
                da.estado AS estado_detalle,
                da.observaciones AS observaciones_detalle,
                ac.nro_acta,
                ac.fecha AS fecha_acta,
                ac.estado AS estado_acta,
                ac.firmo_amo,
                ac.firmo_dmo,
                CONCAT_WS(', ', c.apellidos, c.nombres) AS colaborador
            FROM detalle_acta da
            INNER JOIN acta ac ON ac.id = da.acta_id
            LEFT JOIN colaborador c ON c.id = ac.colaborador_id
            WHERE da.equipo_id = ?
            ORDER BY ac.fecha, ac.id, da.id
        `, [equipoId]);

        const idsActasAsignadas = new Set(
            asignaciones
                .map((a) => a.acta_id)
                .filter((id) => id !== null && id !== undefined)
                .map(Number)
        );

        const eventosMovimiento = movimientos.map((m) => ({
            id: `movimiento-${m.id}`,
            origen: 'MOVIMIENTO',
            fecha: m.fecha,
            tipo_movimiento: m.tipo_movimiento,
            descripcion: m.descripcion || `Movimiento de ${m.tipo_equipo || 'equipo'}`,
            equipo_id: Number(m.equipo_id),
            equipo_relacionado: Number(m.equipo_id) === equipoId
                ? null
                : `${m.tipo_equipo || 'Periférico'} ${m.marca || ''} ${m.modelo || ''}`.trim(),
            asignacion_id: m.asignacion_id ? Number(m.asignacion_id) : null,
            colaborador: m.colaborador,
            usuario: null,
            autorizado_por: m.autorizado_por
        }));

        const eventosAsignacion = [];
        const existeMovimientoAsignacion = (asignacion, tipo) =>
            eventosMovimiento.some((evento) => {
                if (evento.tipo_movimiento !== tipo) return false;

                if (
                    evento.asignacion_id &&
                    Number(evento.asignacion_id) === Number(asignacion.id)
                ) {
                    return true;
                }

                // Compatibilidad con triggers antiguos que no guardaban asignacion_id.
                const fechaEvento = new Date(evento.fecha).getTime();
                const fechaAsignacion = new Date(
                    tipo === 'ASIGNACION'
                        ? asignacion.fecha_asignacion
                        : asignacion.fecha_devolucion
                ).getTime();
                return Number.isFinite(fechaEvento) &&
                    Number.isFinite(fechaAsignacion) &&
                    Math.abs(fechaEvento - fechaAsignacion) <= 60000 &&
                    (!evento.colaborador ||
                        evento.colaborador === asignacion.colaborador);
            });

        for (const asignacion of asignaciones) {
            const metadatos = {
                asignacion_id: Number(asignacion.id),
                colaborador: asignacion.colaborador,
                codigo_colaborador: asignacion.codigo_colaborador,
                ubicacion: asignacion.ubicacion,
                modalidad: asignacion.modalidad,
                numero_linea: asignacion.numero_linea,
                acta: asignacion.nro_acta,
                estado_asignacion: asignacion.estado_asignacion,
                estado_acta: asignacion.estado_acta,
                firmo_amo: asignacion.firmo_amo,
                firmo_dmo: asignacion.firmo_dmo
            };

            const movimientoEntrega = eventosMovimiento.find((evento) =>
                evento.tipo_movimiento === 'ASIGNACION' &&
                (
                    Number(evento.asignacion_id) === Number(asignacion.id) ||
                    (
                        !evento.asignacion_id &&
                        existeMovimientoAsignacion(asignacion, 'ASIGNACION') &&
                        evento.colaborador === asignacion.colaborador
                    )
                )
            );

            if (movimientoEntrega) {
                Object.assign(movimientoEntrega, metadatos);
            } else if (!existeMovimientoAsignacion(asignacion, 'ASIGNACION')) {
                eventosAsignacion.push({
                    id: `asignacion-${asignacion.id}-entrega`,
                    origen: 'ASIGNACION',
                    fecha: asignacion.fecha_asignacion,
                    tipo_movimiento: 'ASIGNACION',
                    descripcion: `Equipo asignado a ${asignacion.colaborador || 'un colaborador'}.`,
                    equipo_id: equipoId,
                    ...metadatos
                });
            }

            if (
                asignacion.fecha_devolucion &&
                !existeMovimientoAsignacion(asignacion, 'DEVOLUCION')
            ) {
                eventosAsignacion.push({
                    id: `asignacion-${asignacion.id}-devolucion`,
                    origen: 'ASIGNACION',
                    fecha: asignacion.fecha_devolucion,
                    tipo_movimiento: 'DEVOLUCION',
                    descripcion: `Devolución del equipo por ${asignacion.colaborador || 'el colaborador'}.`,
                    equipo_id: equipoId,
                    ...metadatos
                });
            }
        }

        const eventosAuditoria = auditorias.map((a) => {
            // Une la auditoría con el movimiento de edición equivalente.
            const indice = eventosMovimiento.findIndex((m) =>
                m.tipo_movimiento === 'CAMBIO' &&
                Math.abs(new Date(m.fecha).getTime() - new Date(a.creado_en).getTime()) <= 5000 &&
                !m.usuario
            );

            if (indice >= 0) {
                eventosMovimiento[indice].usuario = a.nombre_usuario || 'No registrado';
                eventosMovimiento[indice].rol_usuario = a.rol_usuario;
                eventosMovimiento[indice].auditoria = {
                    accion: a.accion,
                    resultado: a.resultado,
                    ruta: a.ruta,
                    rol: a.rol_usuario
                };
                return null;
            }

            const descripciones = {
                CREAR: 'Equipo registrado en el inventario.',
                REGISTRAR_LOTE: 'Equipo registrado como parte de un lote.',
                ACTUALIZAR: 'Se actualizaron los datos del equipo.',
                ELIMINAR: 'Se eliminó un registro del equipo.',
                IMPORTAR: 'Equipo incorporado mediante importación.'
            };

            return {
                id: `auditoria-${a.id}`,
                origen: 'AUDITORIA',
                fecha: a.creado_en,
                tipo_movimiento: a.accion === 'CREAR' ? 'REGISTRO' : a.accion,
                descripcion: descripciones[a.accion] ||
                    `${a.metodo || ''} ${a.ruta || ''} — ${a.resultado || 'Resultado no registrado'}`.trim(),
                equipo_id: equipoId,
                colaborador: null,
                usuario: a.nombre_usuario || 'No registrado',
                rol_usuario: a.rol_usuario,
                resultado: a.resultado
            };
        }).filter(Boolean);

        // Las actas creadas fuera de una asignación también forman parte de la vida del equipo.
        const eventosActa = detallesActa
            .filter((d) => !idsActasAsignadas.has(Number(d.acta_id)))
            .map((d) => ({
                id: `acta-${d.id}`,
                origen: 'ACTA',
                fecha: d.fecha_entrega || d.fecha_acta,
                tipo_movimiento: 'ACTA',
                descripcion: `Acta ${d.nro_acta || d.acta_id} vinculada al equipo.`,
                equipo_id: equipoId,
                acta_id: Number(d.acta_id),
                acta: d.nro_acta,
                colaborador: d.colaborador,
                estado_acta: d.estado_acta,
                estado_detalle_acta: d.estado_detalle,
                fecha_devolucion_acta: d.fecha_devolucion,
                firmo_amo: d.firmo_amo,
                firmo_dmo: d.firmo_dmo,
                observaciones: d.observaciones_detalle
            }));

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
            ...eventosAsignacion,
            ...eventosAuditoria,
            ...eventosActa,
            ...eventosInventario
        ].sort((a, b) => {
            const diferencia = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
            return diferencia || String(b.id).localeCompare(String(a.id));
        });

        return res.json({
            success: true,
            equipo: equipos[0],
            resumen: {
                total: historial.length,
                asignaciones: historial.filter((e) =>
                    e.origen === 'ASIGNACION' ||
                    ['ASIGNACION', 'DEVOLUCION'].includes(e.tipo_movimiento)
                ).length,
                movimientos: eventosMovimiento.length,
                actas: eventosActa.length,
                inventarios: eventosInventario.length,
                cambios: eventosAuditoria.length
            },
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
