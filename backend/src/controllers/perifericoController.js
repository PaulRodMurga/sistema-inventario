const pool = require('../config/database');
const {
    TIPOS_PERIFERICO,
    TIPOS_PRINCIPALES_PERIFERICOS,
    insertarRegistroPeriferico,
    insertarVinculoPeriferico,
    normalizarPeriferico,
    obtenerPerifericoExistente
} = require('../utils/perifericosEquipo');

const normalizarId = (valor) => {
    const numero = typeof valor === 'string' && /^\d+$/.test(valor)
        ? Number(valor)
        : valor;

    return Number.isSafeInteger(numero) && numero > 0
        ? numero
        : null;
};

const normalizarTipo = (valor) => {
    if (typeof valor !== 'string') return null;
    const tipo = valor.trim().toUpperCase();
    return TIPOS_PERIFERICO.has(tipo) ? tipo : null;
};


const responderError = (res, error) => {
    if (error.code === 'ER_DUP_ENTRY') {
        console.error('DUPLICADO MYSQL:', {
            mensaje: error.message,
            detalle: error.sqlMessage,
            codigo: error.code,
            consulta: error.sql
        });

        return res.status(409).json({
            success: false,
            mensaje: 'La serie o el código patrimonial ya está registrado'
        });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
            success: false,
            mensaje: 'El equipo indicado ya no existe'
        });
    }

    console.error('Error al administrar los periféricos:', error);

    return res.status(500).json({
        success: false,
        mensaje: 'Error al administrar los periféricos'
    });
};

const obtenerPrincipal = async (baseDatos, id, bloquear = false) => {
    const [filas] = await baseDatos.query(`
        SELECT id, tipo, contrato_gama_id
        FROM equipo
        WHERE id = ?
        ${bloquear ? 'FOR UPDATE' : ''}
    `, [id]);

    return filas[0] || null;
};

const listarPerifericosEquipo = async (req, res) => {
    const id = normalizarId(req.params.id);

    if (!id) {
        return res.status(400).json({
            success: false,
            mensaje: 'El ID del equipo no es válido'
        });
    }

    try {
        const principal = await obtenerPrincipal(pool, id);

        if (!principal) {
            return res.status(404).json({
                success: false,
                mensaje: 'Equipo principal no encontrado'
            });
        }

        if (!TIPOS_PRINCIPALES_PERIFERICOS.has(principal.tipo)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Solo COMPUTADOR y LAPTOP pueden tener periféricos'
            });
        }

        const [filas] = await pool.query(`
    SELECT
        ep.id AS vinculo_id,
        ep.tipo_periferico,
        ep.fecha_vinculacion,
        p.id,
        p.tipo,
        p.marca,
        p.modelo,
        p.codigo_patrimonial,
        p.serie,
        p.estado_actual,
        p.observaciones,
        p.especificaciones,
        (
            SELECT e.serie
            FROM equipo e
            WHERE e.id = ep.equipo_principal_id
        ) AS serie_equipo_principal
    FROM equipo_periferico ep
    INNER JOIN equipo p
        ON p.id = ep.periferico_id
    WHERE ep.equipo_principal_id = ?
    ORDER BY FIELD(
        ep.tipo_periferico,
        'MONITOR',
        'TECLADO',
        'MOUSE'
    )
`, [id]);

        return res.json({
            success: true,
            cantidad: filas.length,
            data: filas
        });
    } catch (error) {
        console.error('Error al listar periféricos:', error);
        return responderError(res, error);
    }
};


const listarPerifericosDisponibles = async (req, res) => {
    const tipo = normalizarTipo(req.params.tipo);

    if (!tipo) {
        return res.status(400).json({
            success: false,
            mensaje: 'El tipo de periférico no es válido'
        });
    }

    try {
        const [perifericos] = await pool.query(`
            SELECT
                e.id,
                e.tipo,
                e.marca,
                e.modelo,
                e.codigo_patrimonial,
                e.serie,
                e.estado_actual,
                e.observaciones
            FROM equipo e
            WHERE e.tipo = ?
              AND e.estado_actual = 'LIBRE'
              AND NOT EXISTS (
                  SELECT 1
                  FROM equipo_periferico ep
                  WHERE ep.periferico_id = e.id
              )
            ORDER BY e.marca, e.modelo, e.id
        `, [tipo]);

        return res.json({
            success: true,
            data: perifericos
        });
    } catch (error) {
        console.error(
            'Error al listar periféricos disponibles:',
            error
        );

        return res.status(500).json({
            success: false,
            mensaje: 'No se pudieron obtener los periféricos disponibles'
        });
    }
};

const reemplazarPerifericoEquipo = async (req, res) => {
    const id = normalizarId(req.params.id);
    const tipo = normalizarTipo(req.params.tipo);
    const vinculoId = req.params.vinculoId ? normalizarId(req.params.vinculoId) : null;

    if (!id || !tipo || (req.params.vinculoId && !vinculoId)) {
        return res.status(400).json({
            success: false,
            mensaje: 'El equipo o tipo de periférico no es válido'
        });
    }

    

    let conexion;

    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        const principal = await obtenerPrincipal(conexion, id, true);

        if (!principal) {
            await conexion.rollback();
            return res.status(404).json({
                success: false,
                mensaje: 'Equipo principal no encontrado'
            });
        }

        if (!TIPOS_PRINCIPALES_PERIFERICOS.has(principal.tipo)) {
            await conexion.rollback();
            return res.status(400).json({
                success: false,
                mensaje: 'Solo COMPUTADOR y LAPTOP pueden tener periféricos'
            });
        }

        const [vinculos] = await conexion.query(`
            SELECT id, periferico_id
            FROM equipo_periferico
            WHERE equipo_principal_id = ?
              AND tipo_periferico = ?
              ${vinculoId ? 'AND id = ?' : ''}
            FOR UPDATE
        `, vinculoId ? [id, tipo, vinculoId] : [id, tipo]);

        if (vinculoId && vinculos.length === 0) {
            await conexion.rollback();
            return res.status(404).json({
                success: false,
                mensaje: `${tipo} no está vinculado a este equipo`
            });
        }

        const anteriorId = vinculoId ? vinculos[0].periferico_id : null;


        const {
            periferico_id,
            accion_anterior = 'LIBRE'
        } = req.body;

        const accionAnterior = String(accion_anterior).toUpperCase();

        if (!['LIBRE', 'BAJA'].includes(accionAnterior)) {
            throw new Error(
                'La acción para el periférico anterior debe ser LIBRE o BAJA'
            );
        }

        let nuevoId;

        // Opción 1: reutilizar un periférico ya registrado.
        if (periferico_id !== undefined && periferico_id !== null) {
            nuevoId = await obtenerPerifericoExistente(
                conexion,
                periferico_id,
                tipo
            );

            if (Number(nuevoId) === Number(anteriorId)) {
                throw new Error(
                    'Selecciona un periférico diferente al que estás reemplazando'
                );
            }
        } else {
            // Opción 2: registrar un periférico nuevo.
            const normalizado = normalizarPeriferico(req.body, tipo);

            if (!normalizado.ok) {
                throw new Error(normalizado.mensaje);
            }

            nuevoId = await insertarRegistroPeriferico(
                conexion,
                normalizado.valor,
                principal.contrato_gama_id
            );
        }

        
if (vinculoId) {
    await conexion.query(`
        UPDATE equipo_periferico
        SET periferico_id = ?, fecha_vinculacion = NOW()
        WHERE id = ?
    `, [nuevoId, vinculoId]);

    // Actualizar el estado del periférico anterior.
    if (anteriorId) {
        await conexion.query(`
            UPDATE equipo
            SET estado_actual = ?
            WHERE id = ?
        `, [accionAnterior, anteriorId]);
    }

    // Marcar el nuevo periférico como vinculado.
    await conexion.query(`
        UPDATE equipo
        SET estado_actual = 'VINCULADO'
        WHERE id = ?
    `, [nuevoId]);

} else {
    await insertarVinculoPeriferico(
        conexion,
        id,
        nuevoId,
        tipo
    );

    await conexion.query(`
        UPDATE equipo
        SET estado_actual = 'VINCULADO'
        WHERE id = ?
    `, [nuevoId]);
}
        // Dejar evidencia del cambio de vinculación para ambos periféricos.
        if (anteriorId) {
            await conexion.query(`
                INSERT INTO movimiento_equipo (equipo_id, fecha, tipo_movimiento, descripcion)
                VALUES (?, NOW(), 'CAMBIO', ?)
            `, [
                anteriorId,
                `Periférico desvinculado al reemplazar el tipo ${tipo} del equipo principal ID ${id}. Nuevo periférico ID ${nuevoId}.`
            ]);
        }
        await conexion.query(`
            INSERT INTO movimiento_equipo (equipo_id, fecha, tipo_movimiento, descripcion)
            VALUES (?, NOW(), 'CAMBIO', ?)
        `, [
            nuevoId,
            `Periférico vinculado como ${tipo} al equipo principal ID ${id}${anteriorId ? ` en reemplazo del periférico ID ${anteriorId}` : ''}.`
        ]);

        await conexion.commit();

        return res.status(vinculoId ? 200 : 201).json({
            success: true,
            mensaje: vinculoId
                ? `${tipo} reemplazado correctamente`
                : `${tipo} vinculado correctamente`,
            id: nuevoId,
            data: {
                periferico_id: nuevoId,
                periferico_anterior_id: anteriorId,
                tipo
            }
        });
    } catch (error) {
        if (conexion) await conexion.rollback();
        console.error('Error al reemplazar periférico:', error);
        return responderError(res, error);
    } finally {
        conexion?.release();
    }
};

const desvincularPerifericoEquipo = async (req, res) => {
    const id = normalizarId(req.params.id);
    const tipo = normalizarTipo(req.params.tipo);
    const vinculoId = req.params.vinculoId ? normalizarId(req.params.vinculoId) : null;

    if (!id || !tipo || (req.params.vinculoId && !vinculoId)) {
        return res.status(400).json({
            success: false,
            mensaje: 'El equipo o tipo de periférico no es válido'
        });
    }

    let conexion;

    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        const [vinculos] = await conexion.query(`
            SELECT ep.id, ep.periferico_id
            FROM equipo_periferico ep
            INNER JOIN equipo principal
                ON principal.id = ep.equipo_principal_id
            WHERE ep.equipo_principal_id = ?
              AND ep.tipo_periferico = ?
              ${vinculoId ? 'AND ep.id = ?' : ''}
            FOR UPDATE
        `, vinculoId ? [id, tipo, vinculoId] : [id, tipo]);

        if (vinculos.length === 0) {
            await conexion.rollback();
            return res.status(404).json({
                success: false,
                mensaje: `${tipo} no está vinculado a este equipo`
            });
        }

        await conexion.query(`
            INSERT INTO movimiento_equipo (equipo_id, fecha, tipo_movimiento, descripcion)
            VALUES (?, NOW(), 'CAMBIO', ?)
        `, [
            vinculos[0].periferico_id,
            `Periférico desvinculado del equipo principal ID ${id} (tipo ${tipo}).`
        ]);

        await conexion.query(
            'DELETE FROM equipo_periferico WHERE id = ?',
            [vinculos[0].id]
        );
        await conexion.query(`
            UPDATE equipo
            SET estado_actual = 'LIBRE'
            WHERE id = ?
              AND estado_actual = 'VINCULADO'
        `, [vinculos[0].periferico_id]);

        await conexion.commit();

        return res.json({
            success: true,
            mensaje: `${tipo} desvinculado correctamente`,
            data: {
                periferico_id: vinculos[0].periferico_id,
                tipo
            }
        });
    } catch (error) {
        if (conexion) await conexion.rollback();
        console.error('Error al desvincular periférico:', error);
        return responderError(res, error);
    } finally {
        conexion?.release();
    }
};

module.exports = {
    desvincularPerifericoEquipo,
    listarPerifericosDisponibles,
    listarPerifericosEquipo,
    reemplazarPerifericoEquipo
};
