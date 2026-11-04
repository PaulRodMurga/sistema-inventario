const pool = require('../config/database');

const obtenerReportes = async (req, res) => {
    const unidadId = req.query.unidad_empresarial_id || null;
    const areaId = req.query.area_id || null;
    const estado = req.query.estado || null;
    const colaboradorId = req.query.colaborador_id || null;

    try {
        const filtros = [];
        const parametros = [];
        if (unidadId) { filtros.push('c.unidad_empresarial_id = ?'); parametros.push(unidadId); }
        if (areaId) { filtros.push('c.area_id = ?'); parametros.push(areaId); }
        if (colaboradorId) { filtros.push('c.id = ?'); parametros.push(colaboradorId); }
        if (estado) { filtros.push('e.estado_actual = ?'); parametros.push(estado); }
        // Los periféricos son registros de la tabla equipo, pero se reportan
        // por separado para evitar duplicarlos en los indicadores de equipos.
        const where = filtros.length
            ? 'WHERE ' + filtros.join(' AND ') + " AND e.tipo NOT IN ('MONITOR', 'TECLADO', 'MOUSE', 'PARLANTES', 'CAMARA WEB', 'AUDIFONOS')"
            : "WHERE e.tipo NOT IN ('MONITOR', 'TECLADO', 'MOUSE', 'PARLANTES', 'CAMARA WEB', 'AUDIFONOS')";

        const [resumen] = await pool.query(`
            SELECT e.estado_actual AS estado, COUNT(DISTINCT e.id) AS cantidad
            FROM equipo e
            LEFT JOIN asignacion a ON a.equipo_id = e.id AND a.estado = 'ACTIVA'
            LEFT JOIN colaborador c ON c.id = a.colaborador_id
            ${where}
            GROUP BY e.estado_actual ORDER BY cantidad DESC
        `, parametros);

        const [porUnidadArea] = await pool.query(`
            SELECT COALESCE(ue.nombre, 'Sin unidad empresarial') AS unidad_empresarial,
                   COALESCE(ar.nombre, 'Sin área') AS area,
                   e.estado_actual AS estado,
                   COUNT(DISTINCT e.id) AS cantidad
            FROM equipo e
            LEFT JOIN asignacion a ON a.equipo_id = e.id AND a.estado = 'ACTIVA'
            LEFT JOIN colaborador c ON c.id = a.colaborador_id
            LEFT JOIN unidad_empresarial ue ON ue.id = c.unidad_empresarial_id
            LEFT JOIN area ar ON ar.id = c.area_id
            ${where}
            GROUP BY ue.id, ue.nombre, ar.id, ar.nombre, e.estado_actual
            ORDER BY ue.nombre, ar.nombre, cantidad DESC
        `, parametros);

        const [equipos] = await pool.query(`
            SELECT
                e.id AS equipo_id,
                e.tipo,
                e.marca,
                e.modelo,
                e.serie,
                e.codigo_patrimonial,
                e.estado_actual,
                CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,
                COALESCE(ue.nombre, 'Sin unidad empresarial') AS unidad_empresarial,
                COALESCE(ar.nombre, 'Sin área') AS area
            FROM equipo e
            LEFT JOIN asignacion a
                ON a.equipo_id = e.id AND a.estado = 'ACTIVA'
            LEFT JOIN colaborador c
                ON c.id = a.colaborador_id
            LEFT JOIN unidad_empresarial ue
                ON ue.id = c.unidad_empresarial_id
            LEFT JOIN area ar
                ON ar.id = c.area_id
            ${where}
            ORDER BY e.tipo, e.marca, e.modelo, e.id
        `, parametros);

        const [porColaborador] = await pool.query(`
            SELECT c.id AS colaborador_id,
                   CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,
                   COALESCE(ue.nombre, 'Sin unidad empresarial') AS unidad_empresarial,
                   COALESCE(ar.nombre, 'Sin área') AS area,
                   e.id AS equipo_id, e.tipo, e.marca, e.modelo, e.serie,
                   e.codigo_patrimonial, e.estado_actual
            FROM asignacion a
            INNER JOIN equipo e ON e.id = a.equipo_id
            INNER JOIN colaborador c ON c.id = a.colaborador_id
            LEFT JOIN unidad_empresarial ue ON ue.id = c.unidad_empresarial_id
            LEFT JOIN area ar ON ar.id = c.area_id
            WHERE a.estado = 'ACTIVA'
            ${unidadId ? 'AND c.unidad_empresarial_id = ?' : ''}
            ${areaId ? 'AND c.area_id = ?' : ''}
            ${colaboradorId ? 'AND c.id = ?' : ''}
            ${estado ? 'AND e.estado_actual = ?' : ''}
            ORDER BY c.apellidos, c.nombres, e.tipo, e.marca
        `, parametros);

        const [perifericos] = await pool.query(`
            SELECT e.estado_actual AS estado,
                   CASE WHEN ep.periferico_id IS NULL THEN 'DISPONIBLE' ELSE 'VINCULADO' END AS vinculo,
                   COUNT(DISTINCT e.id) AS cantidad
            FROM equipo e
            LEFT JOIN equipo_periferico ep ON ep.periferico_id = e.id
            WHERE e.tipo IN ('MONITOR','TECLADO','MOUSE','PARLANTES','CAMARA WEB','AUDIFONOS')
            GROUP BY e.estado_actual, vinculo
            ORDER BY vinculo, e.estado_actual
        `);

        const [unidades] = await pool.query("SELECT id, nombre FROM unidad_empresarial WHERE estado = 'ACTIVO' ORDER BY nombre");
        const [areas] = await pool.query("SELECT id, nombre FROM area WHERE estado = 'ACTIVO' ORDER BY nombre");
        const [colaboradores] = await pool.query("SELECT id, CONCAT(apellidos, ', ', nombres) AS nombre FROM colaborador WHERE estado = 'ACTIVO' ORDER BY apellidos, nombres");

        return res.json({ success: true, data: { resumen, por_unidad_area: porUnidadArea, equipos, por_colaborador: porColaborador, perifericos, filtros: { unidades, areas, colaboradores } } });
    } catch (error) {
        console.error('Error al generar reportes gerenciales:', error);
        return res.status(500).json({ success: false, mensaje: 'No se pudieron generar los reportes gerenciales' });
    }
};

module.exports = { obtenerReportes };
