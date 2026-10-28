const pool = require('../config/database');

const errorPeticion = (mensaje, status = 400) =>
    Object.assign(new Error(mensaje), { status });

const textoOpcional = (valor, nombre, maxCaracteres) => {
    if (valor == null) return null;
    if (typeof valor !== 'string') {
        throw errorPeticion(`${nombre} debe ser texto`);
    }
    const texto = valor.trim();
    if ((maxCaracteres && [...texto].length > maxCaracteres) ||
        Buffer.byteLength(texto, 'utf8') > 60000) {
        throw errorPeticion(`${nombre} supera la longitud permitida`);
    }
    return texto || null;
};

const idPositivo = (valor, nombre) => {
    if (!['string', 'number'].includes(typeof valor) ||
        !/^[1-9]\d*$/.test(String(valor)) ||
        !Number.isSafeInteger(Number(valor)) || Number(valor) > 2147483647) {
        throw errorPeticion(`${nombre} debe ser un ID entero positivo`);
    }
    return Number(valor);
};

const fechaValida = (valor, nombre) => {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
        valor < '1000-01-01' || valor > '9999-12-31') {
        throw errorPeticion(`${nombre} debe tener formato AAAA-MM-DD`);
    }
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
        throw errorPeticion(`${nombre} no es una fecha válida`);
    }
    return valor;
};


// ==========================================
// LISTAR ASIGNACIONES
// ==========================================
const listarAsignaciones = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                a.id,
                a.fecha_asignacion,
                a.fecha_devolucion,
                a.modalidad,
                a.ubicacion,
                a.estado AS estado_asignacion,

                c.id AS colaborador_id,
                c.codigo AS codigo_colaborador,
                CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,

                e.id AS equipo_id,
                e.tipo,
                e.marca,
                e.modelo,
                e.imei,
                e.serie,
                e.estado_actual AS estado_equipo,

                l.id AS linea_id,
                l.numero AS numero_linea,

                ac.id AS acta_id,
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

            ORDER BY a.id DESC
        `);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {
        console.error('Error al listar asignaciones:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener asignaciones'
        });
    }
};


// ==========================================
// BUSCAR ASIGNACIÓN POR ID
// ==========================================
const obtenerAsignacionPorId = async (req, res) => {
    try {
        let id;

        try {
            id = idPositivo(req.params.id, 'Asignación');
        } catch (errorValidacion) {
            return res.status(400).json({
                success: false,
                mensaje: errorValidacion.message
            });
        }

        const [rows] = await pool.query(`
            SELECT
                a.*,

                c.codigo AS codigo_colaborador,
                c.correo AS correo_colaborador,
                CONCAT(c.apellidos, ', ', c.nombres) AS colaborador,

                e.tipo AS tipo_equipo,
                e.marca,
                e.modelo,
                e.codigo_patrimonial,
                e.imei,
                e.serie,
                e.estado_actual,
                e.especificaciones AS especificaciones_equipo,
                e.observaciones AS observaciones_equipo,
                cm.nro_contrato,
                cm.descripcion AS descripcion_contrato,
                om.nombre AS operador_movil,

                l.numero AS numero_linea,

                ac.nro_acta,
                md.descripcion AS descripcion_devolucion,
                md.autorizado_por AS devolucion_autorizado_por_id,
                CONCAT(aut.apellidos, ', ', aut.nombres) AS devolucion_autorizado_por_nombre

            FROM asignacion a

            INNER JOIN colaborador c
                ON c.id = a.colaborador_id

            INNER JOIN equipo e
                ON e.id = a.equipo_id

            LEFT JOIN linea l
                ON l.id = a.linea_id

            LEFT JOIN contrato_gama cg
                ON cg.id = e.contrato_gama_id

            LEFT JOIN contrato_movil cm
                ON cm.id = cg.contrato_id

            LEFT JOIN operador_movil om
                ON om.id = cm.operador_id

            LEFT JOIN acta ac
                ON ac.id = a.acta_id

            LEFT JOIN movimiento_equipo md
                ON md.id = (
                    SELECT MAX(m.id) FROM movimiento_equipo m
                    WHERE m.asignacion_id = a.id
                      AND m.tipo_movimiento = 'DEVOLUCION'
                )

            LEFT JOIN colaborador aut
                ON aut.id = md.autorizado_por

            WHERE a.id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Asignación no encontrada'
            });
        }

        const asignacion = rows[0];
        const [perifericos] = await pool.query(`
            SELECT
                ep.id AS vinculo_id,
                ep.tipo_periferico,
                p.id,
                p.tipo,
                p.marca,
                p.modelo,
                p.codigo_patrimonial,
                p.serie,
                p.estado_actual,
                p.especificaciones,
                p.observaciones
            FROM equipo_periferico ep
            INNER JOIN equipo p ON p.id = ep.periferico_id
            WHERE ep.equipo_principal_id = ?
            ORDER BY FIELD(ep.tipo_periferico, 'MONITOR', 'TECLADO', 'MOUSE', 'PARLANTES', 'CAMARA WEB', 'AUDIFONOS'), ep.id
        `, [asignacion.equipo_id]);
        asignacion.perifericos = perifericos;

        res.json({
            success: true,
            data: asignacion
        });

    } catch (error) {
        console.error('Error al buscar asignación:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al buscar la asignación'
        });
    }
};


// ==========================================
// REGISTRAR ASIGNACIÓN
// ==========================================
const listarActasDisponibles = async (req, res) => {
    try {
        const colaborador = idPositivo(req.query.colaborador_id, 'Colaborador');
        const equipo = idPositivo(req.query.equipo_id, 'Equipo');
        // Catálogo orientativo: el POST vuelve a validar dentro de la transacción.
        const [rows] = await pool.query(`
            SELECT a.id, a.nro_acta, a.colaborador_id, a.estado,
                da.id AS detalle_id, da.equipo_id,
                DATE_FORMAT(da.fecha_entrega, '%Y-%m-%d') AS fecha_entrega
            FROM acta a
            INNER JOIN detalle_acta da ON da.acta_id = a.id
            INNER JOIN equipo e ON e.id = da.equipo_id
            INNER JOIN colaborador c ON c.id = a.colaborador_id
            WHERE a.colaborador_id = ? AND da.equipo_id = ?
              AND a.estado IN ('PENDIENTE', 'ACTIVA') AND c.estado = 'ACTIVO'
              AND da.estado = 'ENTREGADO' AND da.devolvio_equipo = 'NO'
              AND da.fecha_devolucion IS NULL AND e.estado_actual = 'LIBRE'
              AND NOT EXISTS (
                  SELECT 1 FROM asignacion usada
                  WHERE usada.acta_id = a.id AND usada.equipo_id = da.equipo_id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM asignacion vigente
                  WHERE vigente.equipo_id = da.equipo_id AND vigente.estado = 'ACTIVA'
              )
            ORDER BY a.id DESC
        `, [colaborador, equipo]);
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error al consultar actas disponibles:', error);
        return res.status(error.status || 500).json({
            success: false,
            mensaje: error.status ? error.message : 'No se pudieron consultar las actas disponibles'
        });
    }
};

const registrarAsignacion = async (req, res) => {
    let conexion;
    let transaccionActiva = false;
    let conexionDescartada = false;
    try {
        const {
            colaborador_id,
            equipo_id,
            linea_id,
            acta_id,
            modalidad,
            fecha_asignacion,
            ubicacion,
            descripcion_equipo_anterior,
            observaciones
        } = req.body;

        if (!colaborador_id || !equipo_id || !fecha_asignacion) {
            return res.status(400).json({
                success: false,
                mensaje:
                    'colaborador_id, equipo_id y fecha_asignacion son obligatorios'
            });
        }

        const equipoAnterior = textoOpcional(
            descripcion_equipo_anterior, 'Equipo anterior', 200
        );
        const notasEntrega = textoOpcional(observaciones, 'Observaciones de entrega');
        fechaValida(fecha_asignacion, 'Fecha de asignación');
        const colaborador = idPositivo(colaborador_id, 'Colaborador');
        const equipo = idPositivo(equipo_id, 'Equipo');
        const acta = acta_id == null || acta_id === '' ? null : idPositivo(acta_id, 'Acta');
        const linea = linea_id == null || linea_id === '' ? null : idPositivo(linea_id, 'Línea');
        const modalidadValidada = textoOpcional(modalidad, 'Modalidad', 50) || 'ASIGNACION';
        const ubicacionValidada = textoOpcional(ubicacion, 'Ubicación', 100);

        conexion = await pool.getConnection();
        await conexion.beginTransaction();
        transaccionActiva = true;
        if (acta !== null) {
            const [[cabecera]] = await conexion.query(
                'SELECT id, colaborador_id, estado FROM acta WHERE id = ? FOR UPDATE', [acta]
            );
            if (!cabecera || cabecera.colaborador_id !== colaborador ||
                !['PENDIENTE', 'ACTIVA'].includes(cabecera.estado)) {
                throw errorPeticion('El acta no está abierta o no pertenece al colaborador seleccionado', 409);
            }
        }
        const [[equipoActual]] = await conexion.query(
            'SELECT id, estado_actual FROM equipo WHERE id = ? FOR UPDATE', [equipo]
        );
        if (!equipoActual || equipoActual.estado_actual !== 'LIBRE') {
            throw errorPeticion('El equipo ya no está libre. Actualiza los datos y revisa la selección.', 409);
        }
        const [[persona]] = await conexion.query(
            'SELECT id, estado FROM colaborador WHERE id = ? FOR SHARE', [colaborador]
        );
        if (!persona || persona.estado !== 'ACTIVO') {
            throw errorPeticion('El colaborador no existe o ya no está activo', 409);
        }
        // Primera lectura consistente, después de los bloqueos. No bloquear
        // otras asignaciones, que podrían estar esperando devolver este equipo.
        const [conflictos] = await conexion.query(`
            SELECT id FROM asignacion WHERE equipo_id = ?
              AND (estado = 'ACTIVA' OR acta_id = ?) LIMIT 1
        `, [equipo, acta]);
        if (conflictos.length) {
            throw errorPeticion('El equipo tiene una asignación activa o este detalle de acta ya fue vinculado. Revisa los datos.', 409);
        }
        if (acta !== null) {
            const [detalles] = await conexion.query(`
                SELECT id, estado, devolvio_equipo,
                    DATE_FORMAT(fecha_entrega, '%Y-%m-%d') AS fecha_entrega,
                    DATE_FORMAT(fecha_devolucion, '%Y-%m-%d') AS fecha_devolucion
                FROM detalle_acta WHERE acta_id = ? AND equipo_id = ? FOR UPDATE
            `, [acta, equipo]);
            const detalle = detalles[0];
            if (detalles.length !== 1 || detalle.estado !== 'ENTREGADO' ||
                detalle.devolvio_equipo !== 'NO' || detalle.fecha_devolucion !== null) {
                throw errorPeticion('El acta no contiene un único detalle pendiente válido para este equipo', 409);
            }
            fechaValida(detalle.fecha_entrega, 'Fecha de entrega del acta');
        }

        const [resultado] = await conexion.query(`
            INSERT INTO asignacion (
                colaborador_id,
                equipo_id,
                linea_id,
                acta_id,
                modalidad,
                fecha_asignacion,
                ubicacion,
                estado,
                descripcion_equipo_anterior,
                observaciones
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVA', ?, ?)
        `, [
            colaborador,
            equipo,
            linea,
            acta,
            modalidadValidada,
            fecha_asignacion,
            ubicacionValidada,
            equipoAnterior,
            notasEntrega
        ]);

        let actaGeneradaId = acta;
        if (acta === null) {
            // Crear el acta y su detalle dentro de la misma transacción
            // que la asignación para evitar registros incompletos.
            const numeroActa = `ASG-${String(resultado.insertId).padStart(6, '0')}`;
            const [resultadoActa] = await conexion.query(`
                INSERT INTO acta (
                    nro_acta, fecha, colaborador_id,
                    firmo_amo, firmo_dmo, estado, observaciones
                )
                VALUES (?, ?, ?, 'NO', 'NO', 'PENDIENTE', ?)
            `, [
                numeroActa,
                fecha_asignacion,
                colaborador,
                notasEntrega
            ]);
            actaGeneradaId = resultadoActa.insertId;

            await conexion.query(`
                INSERT INTO detalle_acta (
                    acta_id, equipo_id, fecha_entrega, fecha_devolucion,
                    devolvio_equipo, estado, observaciones
                )
                VALUES (?, ?, ?, NULL, 'NO', 'ENTREGADO', ?)
            `, [
                actaGeneradaId,
                equipo,
                fecha_asignacion,
                notasEntrega
            ]);

            await conexion.query(
                'UPDATE asignacion SET acta_id = ? WHERE id = ?',
                [actaGeneradaId, resultado.insertId]
            );
        }

        // Registrar también la asignación de cada periférico vinculado.
        const [perifericosAsignados] = await conexion.query(`
            SELECT p.id, ep.tipo_periferico, p.marca, p.modelo, p.serie
            FROM equipo_periferico ep
            INNER JOIN equipo p ON p.id = ep.periferico_id
            WHERE ep.equipo_principal_id = ?
            ORDER BY ep.id
            FOR UPDATE
        `, [equipo]);

        for (const periferico of perifericosAsignados) {
            await conexion.query(`
                INSERT INTO movimiento_equipo (
                    equipo_id, colaborador_id, asignacion_id, fecha,
                    tipo_movimiento, descripcion
                )
                VALUES (?, ?, ?, ?, 'ASIGNACION', ?)
            `, [
                periferico.id,
                colaborador,
                resultado.insertId,
                `${fecha_asignacion} 00:00:00`,
                `Periférico ${periferico.tipo_periferico} (${periferico.marca} ${periferico.modelo}, serie: ${periferico.serie || 'sin serie'}) asignado junto con el equipo principal ID ${equipo}.`
            ]);
        }

        await conexion.commit();
        transaccionActiva = false;
        res.status(201).json({
            success: true,
            mensaje: acta === null
                ? 'Asignación y acta registradas correctamente'
                : 'Asignación registrada correctamente',
            id: resultado.insertId,
            acta_id: actaGeneradaId
        });

    } catch (error) {
        if (transaccionActiva) {
            try { await conexion.rollback(); }
            catch (errorRollback) {
                console.error('No se pudo revertir el registro:', errorRollback);
                conexionDescartada = true;
                conexion.destroy();
            }
        }
        console.error('Error al registrar asignación:', error);

        if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) {
            return res.status(409).json({ success: false,
                mensaje: 'Otra operación está modificando los datos. Consulta el estado antes de reintentar.' });
        }

        if (error.status) {
            return res.status(error.status).json({ success: false, mensaje: error.message });
        }

        if (error.sqlState === '45000') {
            return res.status(400).json({
                success: false,
                mensaje: 'No se pudo registrar la asignación porque no cumple una regla de integridad.'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje:
                    'El colaborador, equipo, línea o acta indicada no existe'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al registrar la asignación; consulta su estado antes de reintentar'
        });
    } finally {
        if (conexion && !conexionDescartada) conexion.release();
    }
};


// ==========================================
// VALIDAR EL DETALLE DEL ACTA YA VINCULADA (NO CREA NI BUSCA OTROS VÍNCULOS)
// ==========================================
// ==========================================
// DEVOLVER EQUIPO Y SINCRONIZAR SU ACTA, SI EXISTE VÍNCULO VÁLIDO
// ==========================================
const devolverAsignacion = async (req, res) => {
    let conexion;
    let transaccionActiva = false;
    let conexionDescartada = false;
    try {
        const id = idPositivo(req.params.id, 'Asignación');
        const { fecha_devolucion, observaciones, autorizado_por } = req.body;
        const fechaFinal = fechaValida(
            fecha_devolucion == null || fecha_devolucion === ''
                ? new Date().toISOString().slice(0, 10) : fecha_devolucion,
            'Fecha de devolución'
        );
        const notas = textoOpcional(observaciones, 'Observaciones de devolución');
        const autorizador = autorizado_por == null || autorizado_por === ''
            ? null : idPositivo(autorizado_por, 'Autorizador');

        conexion = await pool.getConnection();
        await conexion.beginTransaction();
        transaccionActiva = true;

        // Serializa las devoluciones de la misma asignación.
        const [asignaciones] = await conexion.query(`
            SELECT id, equipo_id, estado, colaborador_id, acta_id,
                DATE_FORMAT(fecha_asignacion, '%Y-%m-%d') AS fecha_asignacion
            FROM asignacion WHERE id = ? FOR UPDATE
        `, [id]);
        const asignacion = asignaciones[0];
        if (!asignacion || asignacion.estado !== 'ACTIVA') {
            throw errorPeticion('Asignación no encontrada o ya se encuentra finalizada', 404);
        }
        if (fechaFinal < asignacion.fecha_asignacion) {
            throw errorPeticion('La devolución no puede ser anterior a la asignación');
        }
        if (autorizador !== null) {
            const [personas] = await conexion.query(
                'SELECT id FROM colaborador WHERE id = ?', [autorizador]
            );
            if (personas.length === 0) {
                throw errorPeticion('El autorizador seleccionado no existe');
            }
        }

        const [[anterior]] = await conexion.query(`
            SELECT COALESCE(MAX(id), 0) AS ultimo_id FROM movimiento_equipo
            WHERE asignacion_id = ? AND tipo_movimiento = 'DEVOLUCION'
        `, [id]);

        // Los triggers existentes liberan el equipo y crean el movimiento.
        // Las observaciones de entrega NO se actualizan aquí.
        const [resultado] = await conexion.query(`
            UPDATE asignacion
            SET estado = 'FINALIZADA', fecha_devolucion = ?
            WHERE id = ? AND estado = 'ACTIVA'
        `, [fechaFinal, id]);
        if (resultado.affectedRows !== 1) {
            throw new Error('No se pudo finalizar la asignación');
        }

        // Sincronizar el detalle del acta con la devolución confirmada.
        if (asignacion.acta_id) {
            const [detallesActa] = await conexion.query(`
                SELECT id, estado, devolvio_equipo
                FROM detalle_acta
                WHERE acta_id = ? AND equipo_id = ?
                FOR UPDATE
            `, [asignacion.acta_id, asignacion.equipo_id]);

            if (detallesActa.length !== 1) {
                throw new Error('No se encontró un único detalle del acta para esta devolución');
            }

            if (!['PERDIDO', 'ROBADO'].includes(detallesActa[0].estado)) {
                const [detalleActualizado] = await conexion.query(`
                    UPDATE detalle_acta
                    SET fecha_devolucion = ?, devolvio_equipo = 'SI',
                        estado = 'DEVUELTO'
                    WHERE id = ?
                `, [fechaFinal, detallesActa[0].id]);

                if (detalleActualizado.affectedRows !== 1) {
                    throw new Error('No se pudo actualizar el detalle del acta');
                }
            }
        }

        const [movimientos] = await conexion.query(`
            SELECT id, descripcion FROM movimiento_equipo
            WHERE asignacion_id = ? AND tipo_movimiento = 'DEVOLUCION' AND id > ?
            ORDER BY id FOR UPDATE
        `, [id, anterior.ultimo_id]);
        if (movimientos.length !== 1) {
            throw new Error('Se esperaba un único movimiento nuevo de devolución; revisar triggers');
        }
        const movimiento = movimientos[0];
        if (notas || autorizador !== null) {
            const descripcion = notas
                ? `${movimiento.descripcion || ''}\nObservaciones de devolución: ${notas}`
                : movimiento.descripcion;
            if (Buffer.byteLength(descripcion || '', 'utf8') > 65535) {
                throw errorPeticion('El detalle de devolución supera la longitud permitida');
            }
            const [actualizacion] = await conexion.query(`
                UPDATE movimiento_equipo SET descripcion = ?, autorizado_por = ?
                WHERE id = ? AND asignacion_id = ? AND tipo_movimiento = 'DEVOLUCION'
            `, [descripcion, autorizador, movimiento.id, id]);
            if (actualizacion.affectedRows !== 1) {
                throw new Error('No se pudo completar el movimiento de devolución');
            }
        }



        // La devolución del equipo principal también libera la custodia
        // registrada para cada periférico que estaba vinculado a él.
        const [perifericosDevueltos] = await conexion.query(`
            SELECT p.id, ep.tipo_periferico, p.marca, p.modelo, p.serie
            FROM equipo_periferico ep
            INNER JOIN equipo p ON p.id = ep.periferico_id
            WHERE ep.equipo_principal_id = ?
            ORDER BY ep.id
            FOR UPDATE
        `, [asignacion.equipo_id]);

        for (const periferico of perifericosDevueltos) {
            await conexion.query(`
                INSERT INTO movimiento_equipo (
                    equipo_id, colaborador_id, asignacion_id, autorizado_por,
                    fecha, tipo_movimiento, descripcion
                )
                VALUES (?, ?, ?, ?, ?, 'DEVOLUCION', ?)
            `, [
                periferico.id,
                asignacion.colaborador_id,
                id,
                autorizador,
                `${fechaFinal} 23:59:59`,
                `Devolución de periférico ${periferico.tipo_periferico} (${periferico.marca} ${periferico.modelo}, serie: ${periferico.serie || 'sin serie'}) junto con el equipo principal ID ${asignacion.equipo_id}.`
            ]);
        }

        await conexion.commit();
        transaccionActiva = false;
        return res.json({
            success: true,
            mensaje: 'Equipo devuelto correctamente',
            movimiento_id: movimiento.id
        });
    } catch (error) {
        if (transaccionActiva) {
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error('No se pudo revertir la transacción:', errorRollback);
                conexionDescartada = true;
                conexion.destroy();
            }
        }
        console.error('Error al devolver equipo:', error);
        if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) {
            return res.status(409).json({
                success: false,
                mensaje: 'Otra operación está modificando estos registros. Consulta su estado y vuelve a intentar la devolución.'
            });
        }
        const status = error.status ||
            (error.code === 'ER_NO_REFERENCED_ROW_2' || error.sqlState === '45000' ? 400 : 500);
        return res.status(status).json({
            success: false,
            mensaje: error.status ? error.message :
                status === 400 ? 'Los datos de devolución no cumplen las reglas de la base de datos' :
                    'Error al devolver el equipo; verifica su estado antes de reintentar'
        });
    } finally {
        if (conexion && !conexionDescartada) conexion.release();
    }
};


module.exports = {
    listarAsignaciones,
    listarActasDisponibles,
    obtenerAsignacionPorId,
    registrarAsignacion,
    devolverAsignacion
};
