const pool = require('../config/database');

const {
    esObjetoDatos,
    tienePropiedad,
    validarIdPositivo,
    validarNombre,
    validarEstado,
    validarRuc
} = require('../utils/validacionCatalogos');

const responderValidacion = (res, validacion) => (
    res.status(400).json({
        success: false,
        mensaje: validacion.mensaje
    })
);


// LISTAR OPERADORES
const listarOperadores = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                nombre,
                ruc,
                estado
            FROM operador_movil
            ORDER BY nombre
        `);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {
        console.error('Error al listar proveedores:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener proveedores'
        });
    }
};


// REGISTRAR OPERADOR
const registrarOperador = async (req, res) => {
    try {
        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos del proveedor'
            });
        }

        const nombre = validarNombre(
            req.body.nombre,
            50,
            'El nombre del proveedor'
        );

        if (!nombre.valido) {
            return responderValidacion(res, nombre);
        }

        const ruc = validarRuc(
            tienePropiedad(req.body, 'ruc')
                ? req.body.ruc
                : null
        );

        if (!ruc.valido) {
            return responderValidacion(res, ruc);
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
            INSERT INTO operador_movil (
                nombre,
                ruc,
                estado
            )
            VALUES (?, ?, ?)
        `, [
            nombre.valor,
            ruc.valor,
            estado.valor
        ]);

        res.status(201).json({
            success: true,
            mensaje: 'Proveedor registrado correctamente',
            id: resultado.insertId
        });

    } catch (error) {

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El proveedor o RUC ya está registrado'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al registrar proveedor'
        });
    }
};


// EDITAR OPERADOR
const editarOperador = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos del proveedor'
            });
        }

        const campos = [];
        const valores = [];

        if (tienePropiedad(req.body, 'nombre')) {
            const nombre = validarNombre(
                req.body.nombre,
                50,
                'El nombre del proveedor'
            );

            if (!nombre.valido) {
                return responderValidacion(res, nombre);
            }

            campos.push('nombre = ?');
            valores.push(nombre.valor);
        }

        if (tienePropiedad(req.body, 'ruc')) {
            const ruc = validarRuc(req.body.ruc);

            if (!ruc.valido) {
                return responderValidacion(res, ruc);
            }

            campos.push('ruc = ?');
            valores.push(ruc.valor);
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
            UPDATE operador_movil
            SET ${campos.join(', ')}
            WHERE id = ?
        `, valores);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Proveedor no encontrado'
            });
        }

        res.json({
            success: true,
            mensaje: 'Proveedor actualizado correctamente'
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El proveedor o RUC ya está registrado'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al editar proveedor'
        });
    }
};

// OBTENER OPERADOR POR ID
const obtenerOperadorPorId = async (req, res) => {
    const id = validarIdPositivo(req.params.id);

    if (!id.valido) {
        return responderValidacion(res, id);
    }

    try {
        const [filas] = await pool.query(
            `
            SELECT
                id,
                nombre,
                ruc,
                estado
            FROM operador_movil
            WHERE id = ?
            `,
            [id.valor]
        );

        if (filas.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Proveedor no encontrado'
            });
        }

        return res.json({
            success: true,
            data: filas[0]
        });
    } catch (error) {
        console.error(
            'Error al obtener el proveedor:',
            error
        );

        return res.status(500).json({
            success: false,
            mensaje: 'Error al obtener el proveedor'
        });
    }
};


module.exports = {
    listarOperadores,
    registrarOperador,
    obtenerOperadorPorId,
    editarOperador
};
