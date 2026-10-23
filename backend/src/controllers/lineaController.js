const pool = require('../config/database');

const {
    esObjetoDatos,
    tienePropiedad,
    validarIdPositivo,
    validarIdOpcional,
    validarDigitos
} = require('../utils/validacionCatalogos');

const ESTADOS_LINEA = new Set([
    'ACTIVA',
    'SUSPENDIDA',
    'BAJA'
]);

const responderValidacion = (res, validacion) => (
    res.status(400).json({
        success: false,
        mensaje: validacion.mensaje
    })
);

const validarEstadoLinea = (valor) => {
    if (typeof valor !== 'string') {
        return {
            valido: false,
            mensaje: 'El estado debe ser ACTIVA, SUSPENDIDA o BAJA'
        };
    }

    const estado = valor.trim().toUpperCase();

    if (!ESTADOS_LINEA.has(estado)) {
        return {
            valido: false,
            mensaje: 'El estado debe ser ACTIVA, SUSPENDIDA o BAJA'
        };
    }

    return {
        valido: true,
        valor: estado
    };
};

const validarNumeroLinea = (valor) => validarDigitos(
    valor,
    {
        etiqueta: 'El número de línea',
        maximo: 20
    }
);

const validarCodigoChip = (valor) => validarDigitos(
    valor,
    {
        etiqueta: 'El código de chip',
        maximo: 40,
        opcional: true
    }
);


// ==========================================
// LISTAR LINEAS
// ==========================================
const listarLineas = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                l.id,
                l.numero,
                l.codigo_chip,
                l.estado,

                p.id AS plan_id,
                p.nombre AS plan,
                p.gb,

                e.id AS equipo_id,
                e.marca,
                e.modelo,
                e.imei,
                e.serie,
                e.estado_actual

            FROM linea l

            LEFT JOIN plan_movil p
                ON p.id = l.plan_id

            LEFT JOIN equipo e
                ON e.id = l.equipo_id

            ORDER BY l.id
        `);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {
        console.error('Error al listar líneas:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener las líneas',
            error: error.message
        });
    }
};

// ==========================================
// ACTUALIZAR LÍNEA
// ==========================================
const actualizarLinea = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos de la línea'
            });
        }

        const campos = [];
        const valores = [];

        if (tienePropiedad(req.body, 'plan_id')) {
            const planId = validarIdOpcional(
                req.body.plan_id,
                'El plan_id'
            );

            if (!planId.valido) {
                return responderValidacion(res, planId);
            }

            campos.push('plan_id = ?');
            valores.push(planId.valor);
        }

        if (tienePropiedad(req.body, 'estado')) {
            const estado = validarEstadoLinea(req.body.estado);

            if (!estado.valido) {
                return responderValidacion(res, estado);
            }

            campos.push('estado = ?');
            valores.push(estado.valor);
        }

        if (tienePropiedad(req.body, 'equipo_id')) {
            const equipoId = validarIdOpcional(
                req.body.equipo_id,
                'El equipo_id'
            );

            if (!equipoId.valido) {
                return responderValidacion(res, equipoId);
            }

            campos.push('equipo_id = ?');
            valores.push(equipoId.valor);
        }

        if (campos.length === 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar al menos un campo editable'
            });
        }

        valores.push(id.valor);

        const [resultado] = await pool.query(
            `
            UPDATE linea
            SET ${campos.join(', ')}
            WHERE id = ?
            `,
            valores
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Línea no encontrada'
            });
        }

        return res.json({
            success: true,
            mensaje: 'Línea actualizada correctamente'
        });
    } catch (error) {
        console.error(
            'Error al actualizar la línea:',
            error
        );

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje:
                    'El plan o equipo seleccionado no existe'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar la línea',
            error: error.message
        });
    }
};


// ==========================================
// BUSCAR LINEA POR NUMERO
// ==========================================
const buscarPorNumero = async (req, res) => {
    try {
        const numero = validarNumeroLinea(req.params.numero);

        if (!numero.valido) {
            return responderValidacion(res, numero);
        }

        const [rows] = await pool.query(`
            SELECT
                l.id,
                l.numero,
                l.codigo_chip,
                l.estado,

                p.id AS plan_id,
                p.nombre AS plan,
                p.gb,

                e.id AS equipo_id,
                e.marca,
                e.modelo,
                e.imei,
                e.serie,
                e.estado_actual

            FROM linea l

            LEFT JOIN plan_movil p
                ON p.id = l.plan_id

            LEFT JOIN equipo e
                ON e.id = l.equipo_id

            WHERE l.numero = ?
        `, [numero.valor]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Línea no encontrada'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('Error al buscar línea:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al buscar la línea',
            error: error.message
        });
    }
};


// ==========================================
// REGISTRAR LINEA
// ==========================================
const registrarLinea = async (req, res) => {
    try {
        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos de la línea'
            });
        }

        const numero = validarNumeroLinea(req.body.numero);

        if (!numero.valido) {
            return responderValidacion(res, numero);
        }

        const codigoChip = validarCodigoChip(
            tienePropiedad(req.body, 'codigo_chip')
                ? req.body.codigo_chip
                : null
        );

        if (!codigoChip.valido) {
            return responderValidacion(res, codigoChip);
        }

        const planId = validarIdOpcional(
            tienePropiedad(req.body, 'plan_id')
                ? req.body.plan_id
                : null,
            'El plan_id'
        );

        if (!planId.valido) {
            return responderValidacion(res, planId);
        }

        const estado = validarEstadoLinea(
            tienePropiedad(req.body, 'estado')
                ? req.body.estado
                : 'ACTIVA'
        );

        if (!estado.valido) {
            return responderValidacion(res, estado);
        }

        const equipoId = validarIdOpcional(
            tienePropiedad(req.body, 'equipo_id')
                ? req.body.equipo_id
                : null,
            'El equipo_id'
        );

        if (!equipoId.valido) {
            return responderValidacion(res, equipoId);
        }

        const [resultado] = await pool.query(`
            INSERT INTO linea (
                numero,
                codigo_chip,
                plan_id,
                estado,
                equipo_id
            )
            VALUES (?, ?, ?, ?, ?)
        `, [
            numero.valor,
            codigoChip.valor,
            planId.valor,
            estado.valor,
            equipoId.valor
        ]);

        res.status(201).json({
            success: true,
            mensaje: 'Línea registrada correctamente',
            id: resultado.insertId
        });

    } catch (error) {
        console.error('Error al registrar línea:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El número o código de chip ya está registrado'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje: 'El plan o equipo indicado no existe'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al registrar la línea',
            error: error.message
        });
    }
};

// ==========================================
// OBTENER LÍNEA POR ID
// ==========================================
const obtenerLineaPorId = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        const [filas] = await pool.query(
            `
            SELECT
                l.id,
                l.numero,
                l.codigo_chip,
                l.plan_id,
                l.estado,
                l.equipo_id,

                p.nombre AS plan,
                p.gb,

                e.tipo AS tipo_equipo,
                e.marca,
                e.modelo,
                e.imei,
                e.serie,
                e.estado_actual AS estado_equipo

            FROM linea l

            LEFT JOIN plan_movil p
                ON p.id = l.plan_id

            LEFT JOIN equipo e
                ON e.id = l.equipo_id

            WHERE l.id = ?
            `,
            [id.valor]
        );

        if (filas.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Línea no encontrada'
            });
        }

        return res.json({
            success: true,
            data: filas[0]
        });
    } catch (error) {
        console.error(
            'Error al obtener la línea:',
            error
        );

        return res.status(500).json({
            success: false,
            mensaje: 'Error al obtener la línea',
            error: error.message
        });
    }
};


module.exports = {
    listarLineas,
    buscarPorNumero,
    registrarLinea,
    obtenerLineaPorId,
    actualizarLinea
};
