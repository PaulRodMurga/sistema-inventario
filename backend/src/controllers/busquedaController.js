const pool = require('../config/database');

const TIPOS_PERIFERICOS = new Set([
    'MONITOR',
    'TECLADO',
    'MOUSE',
    'PARLANTES',
    'CAMARA WEB',
    'AUDIFONOS'
]);

const crearResultado = (fila, categoria, titulo, subtitulo, estado = '') => ({
    id: Number(fila.id),
    categoria,
    titulo: String(titulo || '').trim(),
    subtitulo: String(subtitulo || '').trim(),
    estado: String(estado || '').trim()
});

const buscarGlobalmente = async (req, res) => {
    const consulta = typeof req.query.q === 'string'
        ? req.query.q.trim()
        : '';

    if (consulta.length > 80) {
        return res.status(400).json({
            success: false,
            mensaje: 'La búsqueda no debe superar los 80 caracteres'
        });
    }

    const vacio = {
        equipos: [],
        perifericos: [],
        colaboradores: [],
        lineas: [],
        asignaciones: [],
        actas: [],
        total: 0
    };

    if (consulta.length < 2) {
        return res.json({ success: true, data: vacio });
    }

    const patron = `%${consulta}%`;

    try {
        const [
            [filasEquipos],
            [filasColaboradores],
            [filasLineas],
            [filasAsignaciones],
            [filasActas]
        ] = await Promise.all([
            pool.query(`
                SELECT
                    e.id,
                    e.tipo,
                    e.marca,
                    e.modelo,
                    e.codigo_patrimonial,
                    e.imei,
                    e.serie,
                    e.estado_actual,
                    ep.equipo_principal_id,
                    principal.marca AS marca_principal,
                    principal.modelo AS modelo_principal
                FROM equipo e
                LEFT JOIN equipo_periferico ep
                    ON ep.periferico_id = e.id
                LEFT JOIN equipo principal
                    ON principal.id = ep.equipo_principal_id
                WHERE CAST(e.id AS CHAR) LIKE ?
                   OR e.tipo LIKE ?
                   OR e.marca LIKE ?
                   OR e.modelo LIKE ?
                   OR e.codigo_patrimonial LIKE ?
                   OR e.imei LIKE ?
                   OR e.serie LIKE ?
                ORDER BY e.id DESC
                LIMIT 10
            `, [patron, patron, patron, patron, patron, patron, patron]),

            pool.query(`
                SELECT
                    c.id,
                    c.codigo,
                    c.apellidos,
                    c.nombres,
                    c.dni,
                    c.email,
                    c.estado
                FROM colaborador c
                WHERE CAST(c.id AS CHAR) LIKE ?
                   OR c.codigo LIKE ?
                   OR c.apellidos LIKE ?
                   OR c.nombres LIKE ?
                   OR CONCAT(c.apellidos, ' ', c.nombres) LIKE ?
                   OR c.dni LIKE ?
                   OR c.email LIKE ?
                ORDER BY c.apellidos, c.nombres
                LIMIT 5
            `, [patron, patron, patron, patron, patron, patron, patron]),

            pool.query(`
                SELECT
                    l.id,
                    l.numero,
                    l.codigo_chip,
                    l.estado,
                    p.nombre AS plan,
                    e.marca,
                    e.modelo,
                    om.nombre AS operador
                FROM linea l
                LEFT JOIN plan_movil p
                    ON p.id = l.plan_id
                LEFT JOIN equipo e
                    ON e.id = l.equipo_id
                LEFT JOIN contrato_gama cg
                    ON cg.id = e.contrato_gama_id
                LEFT JOIN contrato_movil cm
                    ON cm.id = cg.contrato_id
                LEFT JOIN operador_movil om
                    ON om.id = cm.operador_id
                WHERE CAST(l.id AS CHAR) LIKE ?
                   OR l.numero LIKE ?
                   OR l.codigo_chip LIKE ?
                   OR p.nombre LIKE ?
                   OR om.nombre LIKE ?
                   OR e.marca LIKE ?
                   OR e.modelo LIKE ?
                ORDER BY l.id DESC
                LIMIT 5
            `, [patron, patron, patron, patron, patron, patron, patron]),

            pool.query(`
                SELECT
                    a.id,
                    a.estado AS estado_asignacion,
                    c.id AS colaborador_id,
                    c.codigo AS codigo_colaborador,
                    CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,
                    e.id AS equipo_id,
                    e.tipo,
                    e.marca,
                    e.modelo,
                    e.serie,
                    e.imei,
                    l.numero AS numero_linea,
                    ac.nro_acta
                FROM asignacion a
                INNER JOIN colaborador c
                    ON c.id = a.colaborador_id
                INNER JOIN equipo e
                    ON e.id = a.equipo_id
                LEFT JOIN linea l
                    ON l.id = a.linea_id
                LEFT JOIN acta ac
                    ON ac.id = a.acta_id
                WHERE CAST(a.id AS CHAR) LIKE ?
                   OR c.codigo LIKE ?
                   OR c.apellidos LIKE ?
                   OR c.nombres LIKE ?
                   OR CONCAT(c.apellidos, ' ', c.nombres) LIKE ?
                   OR e.marca LIKE ?
                   OR e.modelo LIKE ?
                   OR e.serie LIKE ?
                   OR e.imei LIKE ?
                   OR l.numero LIKE ?
                   OR ac.nro_acta LIKE ?
                ORDER BY a.id DESC
                LIMIT 5
            `, [
                patron, patron, patron, patron, patron, patron,
                patron, patron, patron, patron, patron
            ]),

            pool.query(`
                SELECT DISTINCT
                    a.id,
                    a.nro_acta,
                    a.estado,
                    c.codigo AS codigo_colaborador,
                    CONCAT(c.apellidos, ', ', c.nombres) AS colaborador
                FROM acta a
                INNER JOIN colaborador c
                    ON c.id = a.colaborador_id
                LEFT JOIN detalle_acta da
                    ON da.acta_id = a.id
                LEFT JOIN equipo e
                    ON e.id = da.equipo_id
                WHERE CAST(a.id AS CHAR) LIKE ?
                   OR a.nro_acta LIKE ?
                   OR c.codigo LIKE ?
                   OR c.apellidos LIKE ?
                   OR c.nombres LIKE ?
                   OR CONCAT(c.apellidos, ' ', c.nombres) LIKE ?
                   OR e.marca LIKE ?
                   OR e.modelo LIKE ?
                   OR e.serie LIKE ?
                   OR e.imei LIKE ?
                ORDER BY a.id DESC
                LIMIT 5
            `, [
                patron, patron, patron, patron, patron,
                patron, patron, patron, patron, patron
            ])
        ]);

        const equipos = [];
        const perifericos = [];

        for (const fila of filasEquipos) {
            const esPeriferico = TIPOS_PERIFERICOS.has(
                String(fila.tipo || '').toUpperCase()
            ) || Boolean(fila.equipo_principal_id);

            const identificadores = [
                fila.codigo_patrimonial && `Código: ${fila.codigo_patrimonial}`,
                fila.serie && `Serie: ${fila.serie}`,
                fila.imei && `IMEI: ${fila.imei}`
            ].filter(Boolean).join(' · ');

            const resultado = crearResultado(
                fila,
                esPeriferico ? 'PERIFERICO' : 'EQUIPO',
                [fila.tipo, fila.marca, fila.modelo].filter(Boolean).join(' · '),
                identificadores || (fila.equipo_principal_id
                    ? `Vinculado a: ${fila.marca_principal || ''} ${fila.modelo_principal || ''}`.trim()
                    : ''),
                fila.estado_actual
            );

            (esPeriferico ? perifericos : equipos).push(resultado);
            if (equipos.length >= 5 && perifericos.length >= 5) break;
        }

        const colaboradores = filasColaboradores.map((fila) => crearResultado(
            fila,
            'COLABORADOR',
            `${fila.apellidos}, ${fila.nombres}`,
            [
                fila.codigo && `Código: ${fila.codigo}`,
                fila.dni && `DNI: ${fila.dni}`,
                fila.email
            ].filter(Boolean).join(' · '),
            fila.estado
        ));

        const lineas = filasLineas.map((fila) => crearResultado(
            fila,
            'LINEA',
            `Línea ${fila.numero}`,
            [
                fila.codigo_chip && `Chip: ${fila.codigo_chip}`,
                fila.plan,
                fila.operador,
                [fila.marca, fila.modelo].filter(Boolean).join(' ')
            ].filter(Boolean).join(' · '),
            fila.estado
        ));

        const asignaciones = filasAsignaciones.map((fila) => crearResultado(
            fila,
            'ASIGNACION',
            `Asignación #${fila.id}`,
            [
                fila.colaborador,
                [fila.marca, fila.modelo].filter(Boolean).join(' '),
                fila.nro_acta && `Acta: ${fila.nro_acta}`,
                fila.numero_linea && `Línea: ${fila.numero_linea}`
            ].filter(Boolean).join(' · '),
            fila.estado_asignacion
        ));

        const actas = filasActas.map((fila) => crearResultado(
            fila,
            'ACTA',
            fila.nro_acta || `Acta #${fila.id}`,
            [
                fila.colaborador,
                fila.codigo_colaborador && `Código: ${fila.codigo_colaborador}`
            ].filter(Boolean).join(' · '),
            fila.estado
        ));

        const data = {
            equipos,
            perifericos,
            colaboradores,
            lineas,
            asignaciones,
            actas
        };
        data.total = Object.values(data).reduce(
            (total, grupo) => total + grupo.length,
            0
        );

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Error en la búsqueda global:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'No se pudo realizar la búsqueda global'
        });
    }
};

module.exports = { buscarGlobalmente };
