const pool = require('../config/database');

const {
    esObjetoDatos,
    tienePropiedad,
    validarIdPositivo,
    validarNombre,
    validarEstado
} = require('../utils/validacionCatalogos');

const responderValidacion = (res, validacion) => (
    res.status(400).json({
        success: false,
        mensaje: validacion.mensaje
    })
);

// LISTAR GAMAS
const listarGamas = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                ge.id,
                ge.codigo,
                ge.descripcion,
                ge.estado,
                COUNT(DISTINCT cg.id) AS cantidad_contratas,
                COUNT(DISTINCT e.id) AS cantidad_equipos
            FROM gama_equipo ge
            LEFT JOIN contrato_gama cg
                ON cg.gama_id = ge.id
            LEFT JOIN equipo e
                ON e.contrato_gama_id = cg.id
            GROUP BY
                ge.id,
                ge.codigo,
                ge.descripcion,
                ge.estado
            ORDER BY ge.id
        `);

        return res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error al listar gamas:', error);

        return res.status(500).json({
            success: false,
            mensaje: 'Error al obtener gamas'
        });
    }
};

// INHABILITAR GAMA SIN ROMPER CONTRATAS VIGENTES
const inhabilitarGama = async (req, res) => {
    const id = validarIdPositivo(req.params.id);

    if (!id.valido) {
        return responderValidacion(res, id);
    }

    let conexion;

    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        const [gamas] = await conexion.query(`
            SELECT id, estado
            FROM gama_equipo
            WHERE id = ?
            FOR UPDATE
        `, [id.valor]);

        if (gamas.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                success: false,
                mensaje: 'Gama no encontrada'
            });
        }

        if (gamas[0].estado === 'INACTIVO') {
            await conexion.commit();

            return res.json({
                success: true,
                mensaje: 'La gama ya estaba inhabilitada'
            });
        }

        const [contratasActivas] = await conexion.query(`
            SELECT COUNT(DISTINCT cm.id) AS cantidad
            FROM contrato_gama cg
            INNER JOIN contrato_movil cm
                ON cm.id = cg.contrato_id
            WHERE cg.gama_id = ?
              AND cm.estado = 'VIGENTE'
              AND cm.fecha_inicio <= CURRENT_DATE
              AND (
                    cm.fecha_fin IS NULL
                    OR cm.fecha_fin >= CURRENT_DATE
              )
        `, [id.valor]);

        if (Number(contratasActivas[0]?.cantidad || 0) > 0) {
            await conexion.rollback();

            return res.status(409).json({
                success: false,
                mensaje: 'No puedes inhabilitar una gama usada por un contrato vigente'
            });
        }

        await conexion.query(`
            UPDATE gama_equipo
            SET estado = 'INACTIVO'
            WHERE id = ?
        `, [id.valor]);

        await conexion.commit();

        return res.json({
            success: true,
            mensaje: 'Gama inhabilitada correctamente'
        });
    } catch (error) {
        if (conexion) {
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error('No se pudo revertir la inhabilitación:', errorRollback);
            }
        }
        console.error('Error al inhabilitar gama:', error);

        return res.status(500).json({
            success: false,
            mensaje: 'Error al inhabilitar la gama'
        });
    } finally {
        conexion?.release();
    }
};

// REGISTRAR GAMA
const registrarGama = async (req, res) => {
    try {
        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos de la gama'
            });
        }

        const codigo = validarNombre(
            req.body.codigo,
            10,
            'El código de gama'
        );

        if (!codigo.valido) {
            return responderValidacion(res, codigo);
        }

        const descripcion = validarNombre(
            req.body.descripcion,
            100,
            'La descripción de la gama'
        );

        if (!descripcion.valido) {
            return responderValidacion(res, descripcion);
        }

        const estado = validarEstado(
            tienePropiedad(req.body, 'estado')
                ? req.body.estado
                : 'ACTIVO'
        );

        if (!estado.valido) {
            return responderValidacion(res, estado);
        }

        const [resultado] = await pool.query(`
            INSERT INTO gama_equipo (
                codigo,
                descripcion,
                estado
            )
            VALUES (?, ?, ?)
        `, [
            codigo.valor,
            descripcion.valor,
            estado.valor
        ]);

        return res.status(201).json({
            success: true,
            mensaje: 'Gama registrada correctamente',
            id: resultado.insertId
        });
    } catch (error) {
        console.error('Error al registrar gama:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El código de gama ya existe'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'Error al registrar gama'
        });
    }
};

// EDITAR GAMA
const editarGama = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos de la gama'
            });
        }

        const campos = [];
        const valores = [];

        if (tienePropiedad(req.body, 'codigo')) {
            const codigo = validarNombre(
                req.body.codigo,
                10,
                'El código de gama'
            );

            if (!codigo.valido) {
                return responderValidacion(res, codigo);
            }

            campos.push('codigo = ?');
            valores.push(codigo.valor);
        }

        if (tienePropiedad(req.body, 'descripcion')) {
            const descripcion = validarNombre(
                req.body.descripcion,
                100,
                'La descripción de la gama'
            );

            if (!descripcion.valido) {
                return responderValidacion(res, descripcion);
            }

            campos.push('descripcion = ?');
            valores.push(descripcion.valor);
        }

        if (tienePropiedad(req.body, 'estado')) {
            const estado = validarEstado(req.body.estado);

            if (!estado.valido) {
                return responderValidacion(res, estado);
            }

            if (estado.valor === 'INACTIVO') {
                return res.status(400).json({
                    success: false,
                    mensaje: 'Usa la acción de inhabilitar para validar que la gama no esté en uso'
                });
            }

            campos.push('estado = ?');
            valores.push(estado.valor);
        }

        if (campos.length === 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar al menos un campo para actualizar'
            });
        }

        valores.push(id.valor);

        const [resultado] = await pool.query(`
            UPDATE gama_equipo
            SET ${campos.join(', ')}
            WHERE id = ?
        `, valores);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Gama no encontrada'
            });
        }

        return res.json({
            success: true,
            mensaje: 'Gama actualizada correctamente'
        });
    } catch (error) {
        console.error('Error al actualizar gama:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El código de gama ya existe'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar gama'
        });
    }
};

module.exports = {
    listarGamas,
    registrarGama,
    editarGama,
    inhabilitarGama
};
