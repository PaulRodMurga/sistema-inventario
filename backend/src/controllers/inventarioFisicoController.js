const pool = require('../config/database');

const texto = (v, max, required = false) => {
    if (v === undefined || v === null) return required ? null : '';
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return (required && !s) || s.length > max ? null : s;
};
const idValido = (v) => {
    const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
    return Number.isSafeInteger(n) && n > 0 ? n : null;
};

const listarOpcionesJornada = async (req, res) => {
    try {
        const [contratos] = await pool.query(`
            SELECT DISTINCT cm.id, cm.nro_contrato
            FROM contrato_movil cm
            INNER JOIN contrato_gama cg ON cg.contrato_id = cm.id
            INNER JOIN equipo e ON e.contrato_gama_id = cg.id
            WHERE e.estado_actual <> 'BAJA'
            ORDER BY cm.nro_contrato
        `);
        const [unidades] = await pool.query('SELECT id, nombre FROM unidad_empresarial ORDER BY nombre');
        return res.json({ success: true, data: { contratos, unidades } });
    } catch (e) {
        console.error('Error al listar opciones de jornada:', e);
        return res.status(500).json({ success: false, mensaje: 'No se pudieron cargar los filtros de jornada' });
    }
};

const listarSesiones = async (req, res) => {
    try {
        const [data] = await pool.query(`
            SELECT i.id, i.nombre, i.fecha_inicio, i.fecha_cierre, i.estado,
                i.observaciones, u.nombre AS responsable,
                COUNT(d.id) AS total_activos,
                COALESCE(SUM(d.estado_revision <> 'PENDIENTE'), 0) AS revisados,
                COALESCE(SUM(d.estado_revision = 'PENDIENTE'), 0) AS pendientes,
                COALESCE(SUM(d.estado_revision IN ('UBICACION_DIFERENTE','CON_OBSERVACIONES')), 0) AS incidencias
            FROM inventario_fisico i
            INNER JOIN usuario u ON u.id = i.responsable_id
            LEFT JOIN detalle_inventario_fisico d ON d.inventario_fisico_id = i.id
            GROUP BY i.id, i.nombre, i.fecha_inicio, i.fecha_cierre, i.estado, i.observaciones, u.nombre
            ORDER BY i.id DESC
        `);
        return res.json({ success: true, data });
    } catch (e) {
        console.error('Error al listar inventarios físicos:', e);
        return res.status(500).json({ success: false, mensaje: 'No se pudieron listar las jornadas' });
    }
};

const crearSesion = async (req, res) => {
    const nombre = texto(req.body?.nombre, 150, true);
    const observaciones = texto(req.body?.observaciones, 5000);
    const filtroTipo = req.body?.filtro_tipo ?? 'TODOS';
    const filtroId = filtroTipo === 'TODOS' ? null : idValido(req.body?.filtro_id);
    if (!nombre || observaciones === null) return res.status(400).json({ success: false, mensaje: 'Indica un nombre válido y observaciones de hasta 5000 caracteres' });
    if (!['TODOS', 'CONTRATO', 'UNIDAD_EMPRESARIAL'].includes(filtroTipo) || (filtroTipo !== 'TODOS' && !filtroId)) return res.status(400).json({ success: false, mensaje: 'Selecciona un filtro válido para la jornada' });
    let conexion;
    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();
        const [r] = await conexion.query(
            'INSERT INTO inventario_fisico (nombre, responsable_id, observaciones) VALUES (?, ?, ?)',
            [nombre, req.usuario.id, observaciones || null]
        );
        await conexion.query(`
            INSERT INTO detalle_inventario_fisico (inventario_fisico_id, equipo_id, ubicacion_esperada)
            SELECT ?, e.id, a.ubicacion
            FROM equipo e
            LEFT JOIN (
                SELECT a1.equipo_id, a1.ubicacion
                FROM asignacion a1
                INNER JOIN (SELECT equipo_id, MAX(id) id FROM asignacion WHERE estado='ACTIVA' GROUP BY equipo_id) x
                    ON x.id = a1.id
            ) a ON a.equipo_id = e.id
            LEFT JOIN contrato_gama cg ON cg.id = e.contrato_gama_id
            LEFT JOIN equipo_periferico ep ON ep.periferico_id = e.id
            LEFT JOIN asignacion asignacion_unidad ON asignacion_unidad.equipo_id = COALESCE(ep.equipo_principal_id, e.id) AND asignacion_unidad.estado = 'ACTIVA'
            LEFT JOIN colaborador c ON c.id = asignacion_unidad.colaborador_id
            WHERE e.estado_actual <> 'BAJA'
              AND (? = 'TODOS'
                OR (? = 'CONTRATO' AND cg.contrato_id = ?)
                OR (? = 'UNIDAD_EMPRESARIAL' AND c.unidad_empresarial_id = ?))
            GROUP BY e.id, a.ubicacion
        `, [r.insertId, filtroTipo, filtroTipo, filtroId, filtroTipo, filtroId]);
        await conexion.commit();
        return res.status(201).json({ success: true, mensaje: 'Jornada creada', data: { id: Number(r.insertId), nombre, estado: 'ABIERTA' } });
    } catch (e) {
        if (conexion) await conexion.rollback();
        console.error('Error al crear inventario físico:', e);
        return res.status(500).json({ success: false, mensaje: 'No se pudo crear la jornada' });
    } finally {
        if (conexion) conexion.release();
    }
};

const obtenerSesion = async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ success: false, mensaje: 'Identificador inválido' });
    try {
        const [sesiones] = await pool.query(`
            SELECT i.id, i.nombre, i.fecha_inicio, i.fecha_cierre, i.estado, i.observaciones, u.nombre AS responsable
            FROM inventario_fisico i INNER JOIN usuario u ON u.id=i.responsable_id WHERE i.id=? LIMIT 1
        `, [id]);
        if (!sesiones.length) return res.status(404).json({ success: false, mensaje: 'La jornada no existe' });
        const [activos] = await pool.query(`
            SELECT d.id AS detalle_id, d.equipo_id, d.estado_revision, d.fecha_verificacion,
                d.ubicacion_esperada, d.ubicacion_observada, d.observaciones AS observaciones_revision,
                e.tipo, e.marca, e.modelo, e.serie, e.codigo_patrimonial, e.imei,
                CONCAT_WS(' ', c.nombres, c.apellidos) AS colaborador, ar.nombre AS ubicacion_colaborador
            FROM detalle_inventario_fisico d
            INNER JOIN equipo e ON e.id=d.equipo_id
            LEFT JOIN asignacion a ON a.equipo_id=e.id AND a.estado='ACTIVA'
            LEFT JOIN colaborador c ON c.id=a.colaborador_id
            LEFT JOIN area ar ON ar.id=c.area_id
            WHERE d.inventario_fisico_id=?
            ORDER BY (d.estado_revision='PENDIENTE') DESC, e.tipo, e.marca, e.modelo
        `, [id]);
        return res.json({ success: true, data: { ...sesiones[0], activos } });
    } catch (e) {
        console.error('Error al consultar inventario físico:', e);
        return res.status(500).json({ success: false, mensaje: 'No se pudo consultar la jornada' });
    }
};

const verificarActivo = async (req, res) => {
    const inventarioId = idValido(req.params.id);
    const equipoId = idValido(req.body?.equipo_id);
    const ubicacion = texto(req.body?.ubicacion_observada, 150);
    const observaciones = texto(req.body?.observaciones, 5000);
    if (!inventarioId || !equipoId || ubicacion === null || observaciones === null) return res.status(400).json({ success: false, mensaje: 'Los datos de verificación no son válidos' });
    try {
        const [sesiones] = await pool.query('SELECT estado FROM inventario_fisico WHERE id=? LIMIT 1', [inventarioId]);
        if (!sesiones.length) return res.status(404).json({ success: false, mensaje: 'La jornada no existe' });
        if (sesiones[0].estado !== 'ABIERTA') return res.status(409).json({ success: false, mensaje: 'La jornada ya está cerrada' });
        const [detalles] = await pool.query(`
            SELECT d.id, d.ubicacion_esperada FROM detalle_inventario_fisico d
            WHERE d.inventario_fisico_id=? AND d.equipo_id=? LIMIT 1
        `, [inventarioId, equipoId]);
        if (!detalles.length) return res.status(404).json({ success: false, mensaje: 'El activo no forma parte de esta jornada' });
        const esperado = String(detalles[0].ubicacion_esperada || '').trim();
        const observado = ubicacion.trim();
        const distinta = Boolean(esperado && observado && esperado.toLocaleLowerCase() !== observado.toLocaleLowerCase());
        const estado = distinta ? 'UBICACION_DIFERENTE' : observaciones.trim() ? 'CON_OBSERVACIONES' : 'VERIFICADO';
        await pool.query(`
            UPDATE detalle_inventario_fisico SET estado_revision=?, fecha_verificacion=CURRENT_TIMESTAMP,
                ubicacion_observada=?, observaciones=?, verificado_por=? WHERE id=?
        `, [estado, observado || null, observaciones.trim() || null, req.usuario.id, detalles[0].id]);
        return res.json({ success: true, mensaje: 'Activo verificado correctamente', data: { equipo_id: equipoId, estado_revision: estado } });
    } catch (e) {
        console.error('Error al verificar activo:', e);
        return res.status(500).json({ success: false, mensaje: 'No se pudo registrar la verificación' });
    }
};

const verificarQRJornadaActual = async (req, res) => {
    const codigo = typeof req.params.codigo === 'string' ? req.params.codigo.trim().toUpperCase() : '';
    const coincidencia = codigo.match(/^(EQ|PF)-([1-9][0-9]*)$/);
    if (!coincidencia) return res.status(400).json({ success: false, mensaje: 'El código QR no es válido' });
    const equipoId = Number(coincidencia[2]);
    if (!Number.isSafeInteger(equipoId) || equipoId <= 0) return res.status(400).json({ success: false, mensaje: 'Identificador de activo inválido' });
    try {
        const [sesiones] = await pool.query("SELECT id, nombre FROM inventario_fisico WHERE estado='ABIERTA' ORDER BY id DESC LIMIT 1");
        if (!sesiones.length) return res.status(409).json({ success: false, mensaje: 'No hay una jornada de inventario físico abierta' });
        const sesion = sesiones[0];
        const [detalles] = await pool.query('SELECT id, estado_revision FROM detalle_inventario_fisico WHERE inventario_fisico_id=? AND equipo_id=? LIMIT 1', [sesion.id, equipoId]);
        if (!detalles.length) return res.status(404).json({ success: false, mensaje: 'Este activo no está incluido en la jornada abierta actual' });
        await pool.query("UPDATE detalle_inventario_fisico SET estado_revision='VERIFICADO', fecha_verificacion=CURRENT_TIMESTAMP, ubicacion_observada=COALESCE(ubicacion_observada, ubicacion_esperada), verificado_por=? WHERE id=?", [req.usuario.id, detalles[0].id]);
        return res.json({ success: true, mensaje: detalles[0].estado_revision === 'VERIFICADO' ? 'Este activo ya estaba verificado en la jornada actual' : 'Activo marcado como verificado en la jornada actual', data: { inventario_id: sesion.id, jornada: sesion.nombre, equipo_id: equipoId, estado_revision: 'VERIFICADO' } });
    } catch (error) { console.error('Error al verificar QR en jornada actual:', error); return res.status(500).json({ success: false, mensaje: 'No se pudo registrar la verificación del QR' }); }
};

const cerrarSesion = async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ success: false, mensaje: 'Identificador inválido' });
    try {
        const [r] = await pool.query("UPDATE inventario_fisico SET estado='CERRADA', fecha_cierre=CURRENT_TIMESTAMP WHERE id=? AND estado='ABIERTA'", [id]);
        if (!r.affectedRows) return res.status(409).json({ success: false, mensaje: 'La jornada no existe o ya está cerrada' });
        return res.json({ success: true, mensaje: 'Jornada cerrada; los activos pendientes permanecen pendientes.' });
    } catch (e) {
        console.error('Error al cerrar inventario físico:', e);
        return res.status(500).json({ success: false, mensaje: 'No se pudo cerrar la jornada' });
    }
};

module.exports = { listarOpcionesJornada, listarSesiones, crearSesion, obtenerSesion, verificarActivo, verificarQRJornadaActual, cerrarSesion };
