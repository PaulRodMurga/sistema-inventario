const pool = require('../config/database');

const {
    esObjetoDatos,
    tienePropiedad,
    validarIdPositivo,
    validarNombre,
    validarEstado,
    validarGb
} = require('../utils/validacionCatalogos');

const responderValidacion = (res, validacion) => (
    res.status(400).json({
        success: false,
        mensaje: validacion.mensaje
    })
);


// ==========================================
// LISTAR PLANES
// ==========================================
const listarPlanes = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                nombre,
                gb,
                estado
            FROM plan_movil
            ORDER BY id
        `);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {
        console.error('Error al listar planes:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener los planes'
        });
    }
};


// ==========================================
// REGISTRAR PLAN
// ==========================================
const registrarPlan = async (req, res) => {
    try {
        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos del plan'
            });
        }

        const nombre = validarNombre(
            req.body.nombre,
            100,
            'El nombre del plan'
        );

        if (!nombre.valido) {
            return responderValidacion(res, nombre);
        }

        const gb = validarGb(
            tienePropiedad(req.body, 'gb')
                ? req.body.gb
                : null
        );

        if (!gb.valido) {
            return responderValidacion(res, gb);
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
            INSERT INTO plan_movil (
                nombre,
                gb,
                estado
            )
            VALUES (?, ?, ?)
        `, [
            nombre.valor,
            gb.valor,
            estado.valor
        ]);

        res.status(201).json({
            success: true,
            mensaje: 'Plan registrado correctamente',
            id: resultado.insertId
        });

    } catch (error) {
        console.error('Error al registrar plan:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El nombre del plan ya existe'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al registrar el plan'
        });
    }
};


// ==========================================
// EDITAR PLAN
// ==========================================
const editarPlan = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos del plan'
            });
        }

        const campos = [];
        const valores = [];

        if (tienePropiedad(req.body, 'nombre')) {
            const nombre = validarNombre(
                req.body.nombre,
                100,
                'El nombre del plan'
            );

            if (!nombre.valido) {
                return responderValidacion(res, nombre);
            }

            campos.push('nombre = ?');
            valores.push(nombre.valor);
        }

        if (tienePropiedad(req.body, 'gb')) {
            const gb = validarGb(req.body.gb);

            if (!gb.valido) {
                return responderValidacion(res, gb);
            }

            campos.push('gb = ?');
            valores.push(gb.valor);
        }

        if (tienePropiedad(req.body, 'estado')) {
            const estado = validarEstado(req.body.estado);

            if (!estado.valido) {
                return responderValidacion(res, estado);
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
            UPDATE plan_movil
            SET ${campos.join(', ')}
            WHERE id = ?
        `, valores);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Plan no encontrado'
            });
        }

        res.json({
            success: true,
            mensaje: 'Plan actualizado correctamente'
        });

    } catch (error) {
        console.error('Error al editar plan:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El nombre del plan ya existe'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar el plan'
        });
    }
};


module.exports = {
    listarPlanes,
    registrarPlan,
    editarPlan
};
