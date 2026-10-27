const pool = require('../config/database');


// ==========================================
// OBTENER DASHBOARD
// ==========================================
const obtenerDashboard = async (req, res) => {
    try {

        // ==========================================
        // RESUMEN GENERAL
        // ==========================================
        const [resumenRows] = await pool.query(`
            SELECT
                COUNT(*) AS total_equipos,

                SUM(
                    CASE
                        WHEN estado_actual = 'ASIGNADO'
                        THEN 1
                        ELSE 0
                    END
                ) AS asignados,

                SUM(
                    CASE
                        WHEN estado_actual = 'LIBRE'
                        THEN 1
                        ELSE 0
                    END
                ) AS libres,

                SUM(
                    CASE
                        WHEN estado_actual = 'EN_CUSTODIA'
                        THEN 1
                        ELSE 0
                    END
                ) AS en_custodia,

                SUM(
                    CASE
                        WHEN estado_actual = 'PERDIDO'
                        THEN 1
                        ELSE 0
                    END
                ) AS perdidos,

                SUM(
                    CASE
                        WHEN estado_actual = 'ROBADO'
                        THEN 1
                        ELSE 0
                    END
                ) AS robados,

                SUM(
                    CASE
                        WHEN estado_actual = 'BAJA'
                        THEN 1
                        ELSE 0
                    END
                ) AS baja

            FROM equipo
        `);


        // ==========================================
        // TOTAL COLABORADORES
        // ==========================================
        const [colaboradorRows] = await pool.query(`
            SELECT COUNT(*) AS total_colaboradores
            FROM colaborador
        `);


        // ==========================================
        // TOTAL LINEAS
        // ==========================================
        const [lineaRows] = await pool.query(`
            SELECT COUNT(*) AS total_lineas
            FROM linea
        `);


        // ==========================================
        // EQUIPOS POR ESTADO
        // ==========================================
        const [estadoRows] = await pool.query(`
            SELECT
                estado_actual AS estado,
                COUNT(*) AS cantidad
            FROM equipo
            GROUP BY estado_actual
            ORDER BY cantidad DESC
        `);


        // ==========================================
        // EQUIPOS POR MARCA
        // ==========================================
        const [marcaRows] = await pool.query(`
            SELECT
                marca,
                COUNT(*) AS cantidad
            FROM equipo
            GROUP BY marca
            ORDER BY cantidad DESC
        `);


        // ==========================================
        // EQUIPOS POR OPERADOR
        // ==========================================
        const [operadorRows] = await pool.query(`
            SELECT
                om.nombre AS operador,
                COUNT(e.id) AS cantidad

            FROM equipo e

            INNER JOIN contrato_gama cg
                ON cg.id = e.contrato_gama_id

            INNER JOIN contrato_movil cm
                ON cm.id = cg.contrato_id

            INNER JOIN operador_movil om
                ON om.id = cm.operador_id

            GROUP BY om.id, om.nombre

            ORDER BY cantidad DESC
        `);


        // ==========================================
        // EQUIPOS ASIGNADOS POR AREA
        // ==========================================
        const [areaRows] = await pool.query(`
            SELECT
                ar.nombre AS area,
                COUNT(a.id) AS cantidad

            FROM asignacion a

            INNER JOIN colaborador c
                ON c.id = a.colaborador_id

            INNER JOIN area ar
                ON ar.id = c.area_id

            WHERE a.estado = 'ACTIVA'

            GROUP BY ar.id, ar.nombre

            ORDER BY cantidad DESC
        `);


        // ==========================================
        // ALERTAS ADMINISTRATIVAS
        // ==========================================
        const [actasPendientesRows] = await pool.query(`
            SELECT COUNT(*) AS cantidad FROM acta WHERE estado = 'PENDIENTE'
        `);

        const [devolucionesPendientesRows] = await pool.query(`
            SELECT COUNT(*) AS cantidad FROM detalle_acta
            WHERE devolvio_equipo = 'NO' AND estado = 'ENTREGADO'
        `);

        const [devolucionesRevisarRows] = await pool.query(`
            SELECT COUNT(*) AS cantidad FROM detalle_acta
            WHERE (devolvio_equipo = 'SI' AND estado <> 'DEVUELTO')
               OR (devolvio_equipo = 'NO' AND estado = 'DEVUELTO')
        `);

        const [contratosPorVencerRows] = await pool.query(`
            SELECT COUNT(*) AS cantidad FROM contrato_movil
            WHERE fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              AND estado <> 'CANCELADO'
        `);

        // ==========================================
        // ULTIMOS MOVIMIENTOS
        // ==========================================
        const [movimientoRows] = await pool.query(`
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

                CONCAT(
                    c.apellidos,
                    ', ',
                    c.nombres
                ) AS colaborador

            FROM movimiento_equipo m

            INNER JOIN equipo e
                ON e.id = m.equipo_id

            LEFT JOIN colaborador c
                ON c.id = m.colaborador_id

            ORDER BY m.fecha DESC, m.id DESC

            LIMIT 10
        `);


        const resumen = {
            ...resumenRows[0],
            total_colaboradores:
                colaboradorRows[0].total_colaboradores,

            total_lineas:
                lineaRows[0].total_lineas
        };


        res.json({
            success: true,

            data: {
                resumen: resumen,
                por_estado: estadoRows,
                por_marca: marcaRows,
                por_operador: operadorRows,
                por_area: areaRows,
                alertas: {
                    actas_pendientes: Number(actasPendientesRows[0].cantidad || 0),
                    devoluciones_pendientes: Number(devolucionesPendientesRows[0].cantidad || 0),
                    devoluciones_por_revisar: Number(devolucionesRevisarRows[0].cantidad || 0),
                    contratos_por_vencer: Number(contratosPorVencerRows[0].cantidad || 0)
                },
                ultimos_movimientos: movimientoRows
            }
        });

    } catch (error) {

        console.error(
            'Error al obtener dashboard:',
            error
        );

        res.status(500).json({
            success: false,
            mensaje:
                'Error al obtener información del dashboard'
        });

    }
};


module.exports = {
    obtenerDashboard
};