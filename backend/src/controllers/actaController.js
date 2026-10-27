const pool = require('../config/database');

// Una fila por detalle. La misma consulta alimenta listado y detalle para
// mantener idénticas las reglas, sin consultas adicionales por cada acta.
const consultaActas = `
    SELECT
        a.id, a.nro_acta, a.fecha, a.firmo_amo, a.firmo_dmo,
        a.estado, a.observaciones,
        c.id AS colaborador_id, c.codigo AS codigo_colaborador, c.dni,
        CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,
        da.id AS detalle_id, da.equipo_id, da.fecha_entrega,
        da.fecha_devolucion, da.devolvio_equipo,
        da.estado AS estado_detalle, da.observaciones AS observaciones_detalle,
        e.tipo, e.marca, e.modelo, e.imei, e.serie, e.estado_actual
    FROM acta a
    INNER JOIN colaborador c ON c.id = a.colaborador_id
    LEFT JOIN detalle_acta da ON da.acta_id = a.id
    LEFT JOIN equipo e ON e.id = da.equipo_id
`;

const adjuntarPerifericosActa = async (actas) => {
    const equiposIds = [...new Set(
        actas.flatMap((acta) => acta.equipos.map((equipo) => equipo.equipo_id))
            .filter((id) => id !== null && id !== undefined)
    )];

    for (const acta of actas) {
        for (const equipo of acta.equipos) equipo.perifericos = [];
    }
    if (equiposIds.length === 0) return actas;

    const placeholders = equiposIds.map(() => '?').join(', ');
    const [filasPerifericos] = await pool.query(`
        SELECT
            ep.equipo_principal_id AS equipo_id,
            ep.tipo_periferico,
            p.id AS periferico_id,
            p.marca,
            p.modelo,
            p.serie,
            p.codigo_patrimonial,
            p.estado_actual
        FROM equipo_periferico ep
        INNER JOIN equipo p ON p.id = ep.periferico_id
        WHERE ep.equipo_principal_id IN (${placeholders})
        ORDER BY ep.equipo_principal_id, ep.id
    `, equiposIds);

    const porEquipo = new Map();
    for (const periferico of filasPerifericos) {
        if (!porEquipo.has(periferico.equipo_id)) porEquipo.set(periferico.equipo_id, []);
        porEquipo.get(periferico.equipo_id).push(periferico);
    }

    for (const acta of actas) {
        for (const equipo of acta.equipos) {
            equipo.perifericos = porEquipo.get(equipo.equipo_id) || [];
        }
    }
    return actas;
};

const agruparActas = (filas) => {
    const actas = new Map();
    for (const fila of filas) {
        if (!actas.has(fila.id)) {
            actas.set(fila.id, {
                id: fila.id, nro_acta: fila.nro_acta, fecha: fila.fecha,
                firmo_amo: fila.firmo_amo, firmo_dmo: fila.firmo_dmo,
                estado: fila.estado, observaciones: fila.observaciones,
                colaborador_id: fila.colaborador_id,
                codigo_colaborador: fila.codigo_colaborador,
                dni: fila.dni, colaborador: fila.colaborador, equipos: []
            });
        }
        if (fila.detalle_id == null) continue;
        // No resolver contradicciones históricas silenciosamente: mostrarlas.
        const devuelto = fila.devolvio_equipo === 'SI' && fila.estado_detalle === 'DEVUELTO';
        const noDevuelto = fila.devolvio_equipo === 'NO' &&
            ['ENTREGADO', 'PERDIDO', 'ROBADO'].includes(fila.estado_detalle);
        actas.get(fila.id).equipos.push({
            detalle_id: fila.detalle_id, equipo_id: fila.equipo_id,
            fecha_entrega: fila.fecha_entrega, fecha_devolucion: fila.fecha_devolucion,
            devolvio_equipo: fila.devolvio_equipo, estado: fila.estado_detalle,
            observaciones: fila.observaciones_detalle,
            tipo: fila.tipo, marca: fila.marca, modelo: fila.modelo,
            imei: fila.imei, serie: fila.serie, estado_actual: fila.estado_actual,
            devolucion_registrada: devuelto ? 'SI' : noDevuelto ? 'NO' : 'REVISAR'
        });
    }
    return [...actas.values()].map((acta) => {
        const total = acta.equipos.length;
        const devueltos = acta.equipos.filter((e) => e.devolucion_registrada === 'SI').length;
        const noDevueltos = acta.equipos.filter((e) => e.devolucion_registrada === 'NO').length;
        const revisar = total - devueltos - noDevueltos;
        return {
            ...acta,
            cantidad_equipos: total,
            cantidad_devueltos: devueltos,
            cantidad_no_devueltos: noDevueltos,
            cantidad_por_revisar: revisar,
            cantidad_incidencias: acta.equipos.filter((e) => ['PERDIDO', 'ROBADO'].includes(e.estado)).length,
            estado_devolucion: total === 0 ? 'SIN_EQUIPOS' : revisar > 0 ? 'REVISAR' :
                devueltos === total ? 'TOTAL' : devueltos > 0 ? 'PARCIAL' : 'PENDIENTE'
        };
    });
};


// ==========================================================
// LISTAR ACTAS
// ==========================================================
const listarActas = async (req, res) => {
    try {
        const [filas] = await pool.query(`${consultaActas} ORDER BY a.id DESC, da.id ASC`);
        const rows = await adjuntarPerifericosActa(agruparActas(filas));

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {
        console.error('Error al listar actas:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener las actas'
        });
    }
};


// ==========================================================
// OBTENER ACTA POR ID
// ==========================================================
const obtenerActaPorId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) > 2147483647) {
            return res.status(400).json({ success: false, mensaje: 'ID de acta no válido' });
        }
        const [filas] = await pool.query(
            `${consultaActas} WHERE a.id = ? ORDER BY da.id ASC`, [Number(id)]
        );
        const actas = await adjuntarPerifericosActa(agruparActas(filas));

        if (actas.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Acta no encontrada'
            });
        }

        res.json({
            success: true,
            data: actas[0]
        });

    } catch (error) {
        console.error('Error al obtener acta:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener el acta'
        });
    }
};


// ==========================================================
// REGISTRAR ACTA + DETALLES
// ==========================================================
const registrarActa = async (req, res) => {

    const conexion = await pool.getConnection();

    try {
        const {
            nro_acta,
            fecha,
            colaborador_id,
            firmo_amo,
            firmo_dmo,
            estado,
            observaciones,
            equipos
        } = req.body;

        if (!nro_acta || !fecha || !colaborador_id) {
            return res.status(400).json({
                success: false,
                mensaje:
                    'nro_acta, fecha y colaborador_id son obligatorios'
            });
        }

        if (!Array.isArray(equipos) || equipos.length === 0) {
            return res.status(400).json({
                success: false,
                mensaje:
                    'El acta debe contener al menos un equipo'
            });
        }

        // Evitar que llegue dos veces el mismo equipo
        const idsEquipos = equipos.map(equipo => equipo.equipo_id);

        if (new Set(idsEquipos).size !== idsEquipos.length) {
            return res.status(400).json({
                success: false,
                mensaje:
                    'No puedes registrar el mismo equipo dos veces en una misma acta'
            });
        }

        await conexion.beginTransaction();

        // Crear encabezado
        const [resultadoActa] = await conexion.query(`
            INSERT INTO acta (
                nro_acta,
                fecha,
                colaborador_id,
                firmo_amo,
                firmo_dmo,
                estado,
                observaciones
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            nro_acta,
            fecha,
            colaborador_id,
            firmo_amo || 'NO',
            firmo_dmo || 'NO',
            estado || 'PENDIENTE',
            observaciones || null
        ]);

        const actaId = resultadoActa.insertId;

        // Registrar equipos
        for (const equipo of equipos) {

            if (!equipo.equipo_id) {
                throw new Error(
                    'Todos los detalles deben contener equipo_id'
                );
            }

            await conexion.query(`
                INSERT INTO detalle_acta (
                    acta_id,
                    equipo_id,
                    fecha_entrega,
                    fecha_devolucion,
                    devolvio_equipo,
                    estado,
                    observaciones
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                actaId,
                equipo.equipo_id,
                equipo.fecha_entrega || fecha,
                equipo.fecha_devolucion || null,
                equipo.devolvio_equipo || 'NO',
                equipo.estado || 'ENTREGADO',
                equipo.observaciones || null
            ]);
        }

        await conexion.commit();

        res.status(201).json({
            success: true,
            mensaje: 'Acta registrada correctamente',
            acta_id: actaId,
            cantidad_equipos: equipos.length
        });

    } catch (error) {

        await conexion.rollback();

        console.error('Error al registrar acta:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje:
                    'El número de acta ya existe o algún equipo está duplicado'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje:
                    'El colaborador o alguno de los equipos indicados no existe'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al registrar el acta'
        });

    } finally {
        conexion.release();
    }
};


// ==========================================================
// EDITAR DATOS GENERALES DEL ACTA
// ==========================================================
const editarActa = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            nro_acta,
            fecha,
            colaborador_id,
            firmo_amo,
            firmo_dmo,
            estado,
            observaciones
        } = req.body;

        const estadosPermitidos = [
            'PENDIENTE',
            'ACTIVA',
            'CERRADA',
            'ANULADA'
        ];

        if (estado && !estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Estado de acta no válido'
            });
        }

        const [resultado] = await pool.query(`
            UPDATE acta
            SET
                nro_acta = ?,
                fecha = ?,
                colaborador_id = ?,
                firmo_amo = ?,
                firmo_dmo = ?,
                estado = ?,
                observaciones = ?
            WHERE id = ?
        `, [
            nro_acta,
            fecha,
            colaborador_id,
            firmo_amo || 'NO',
            firmo_dmo || 'NO',
            estado || 'PENDIENTE',
            observaciones || null,
            id
        ]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Acta no encontrada'
            });
        }

        res.json({
            success: true,
            mensaje: 'Acta actualizada correctamente'
        });

    } catch (error) {
        console.error('Error al editar acta:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El número de acta ya está registrado'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar el acta'
        });
    }
};


module.exports = {
    listarActas,
    obtenerActaPorId,
    registrarActa,
    editarActa
};
