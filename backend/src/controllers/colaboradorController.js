const pool = require('../config/database');

const {
    esObjetoDatos,
    tienePropiedad,
    validarIdPositivo,
    validarIdOpcional,
    validarDigitos,
    validarNombre
} = require('../utils/validacionCatalogos');

const ESTADOS_COLABORADOR = new Set([
    'ACTIVO',
    'CESADO',
    'EXTERNO'
]);

const responderValidacion = (res, validacion) => (
    res.status(400).json({
        success: false,
        mensaje: validacion.mensaje
    })
);

const validarEstadoColaborador = (valor) => {
    if (typeof valor !== 'string') {
        return {
            valido: false,
            mensaje: 'El estado debe ser ACTIVO, CESADO o EXTERNO'
        };
    }

    const estado = valor.trim().toUpperCase();

    if (!ESTADOS_COLABORADOR.has(estado)) {
        return {
            valido: false,
            mensaje: 'El estado debe ser ACTIVO, CESADO o EXTERNO'
        };
    }

    return {
        valido: true,
        valor: estado
    };
};

const validarDni = (valor) => validarDigitos(
    valor,
    {
        etiqueta: 'El DNI',
        maximo: 15
    }
);


// ==========================================
// LISTAR COLABORADORES
// ==========================================
const listarColaboradores = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                c.id,
                c.codigo,
                c.apellidos,
                c.nombres,
                c.dni,
                ca.nombre AS cargo,
                ar.nombre AS area,
                cc.nombre AS centro_costos,
                ue.nombre AS unidad_empresarial,
                c.estado
            FROM colaborador c

            LEFT JOIN cargo ca
                ON ca.id = c.cargo_id

            LEFT JOIN area ar
                ON ar.id = c.area_id

            LEFT JOIN centro_costos cc
                ON cc.id = c.centro_costos_id

            LEFT JOIN unidad_empresarial ue
                ON ue.id = c.unidad_empresarial_id

            ORDER BY c.apellidos, c.nombres
        `);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {

        console.error('Error al listar colaboradores:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener colaboradores'
        });

    }
};

// ==========================================
// BUSCAR COLABORADOR POR ID
// ==========================================
const obtenerColaboradorPorId = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        const [filas] = await pool.query(
            `
      SELECT
        c.id,
        c.codigo,
        c.apellidos,
        c.nombres,
        c.dni,
        c.estado,

        ca.id AS cargo_id,
        ca.nombre AS cargo,

        ar.id AS area_id,
        ar.nombre AS area,

        cc.id AS centro_costos_id,
        cc.codigo AS codigo_centro_costos,
        cc.nombre AS centro_costos,

        ue.id AS unidad_empresarial_id,
        ue.nombre AS unidad_empresarial

      FROM colaborador c

      LEFT JOIN cargo ca
        ON ca.id = c.cargo_id

      LEFT JOIN area ar
        ON ar.id = c.area_id

      LEFT JOIN centro_costos cc
        ON cc.id = c.centro_costos_id

      LEFT JOIN unidad_empresarial ue
        ON ue.id = c.unidad_empresarial_id

      WHERE c.id = ?
      `,
            [id.valor]
        );

        if (filas.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Colaborador no encontrado'
            });
        }

        return res.json({
            success: true,
            data: filas[0]
        });
    } catch (error) {
        console.error('Error al obtener el colaborador:', error);

        return res.status(500).json({
            success: false,
            mensaje: 'Error al obtener el colaborador'
        });
    }
};

// ==========================================
// BUSCAR COLABORADOR POR DNI
// ==========================================
const buscarPorDni = async (req, res) => {
    try {
        const dni = validarDni(req.params.dni);

        if (!dni.valido) {
            return responderValidacion(res, dni);
        }

        const [rows] = await pool.query(`
            SELECT
                c.id,
                c.codigo,
                c.apellidos,
                c.nombres,
                c.dni,
                c.cargo_id,
                ca.nombre AS cargo,
                c.area_id,
                ar.nombre AS area,
                c.centro_costos_id,
                cc.nombre AS centro_costos,
                c.unidad_empresarial_id,
                ue.nombre AS unidad_empresarial,
                c.estado
            FROM colaborador c

            LEFT JOIN cargo ca
                ON ca.id = c.cargo_id

            LEFT JOIN area ar
                ON ar.id = c.area_id

            LEFT JOIN centro_costos cc
                ON cc.id = c.centro_costos_id

            LEFT JOIN unidad_empresarial ue
                ON ue.id = c.unidad_empresarial_id

            WHERE c.dni = ?
        `, [dni.valor]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Colaborador no encontrado'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {

        console.error('Error al buscar colaborador:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al buscar colaborador'
        });

    }
};


// ==========================================
// REGISTRAR COLABORADOR
// ==========================================
const registrarColaborador = async (req, res) => {
    try {
        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos del colaborador'
            });
        }

        const codigo = validarNombre(
            req.body.codigo,
            20,
            'El código'
        );

        if (!codigo.valido) {
            return responderValidacion(res, codigo);
        }

        const apellidos = validarNombre(
            req.body.apellidos,
            100,
            'Los apellidos'
        );

        if (!apellidos.valido) {
            return responderValidacion(res, apellidos);
        }

        const nombres = validarNombre(
            req.body.nombres,
            100,
            'Los nombres'
        );

        if (!nombres.valido) {
            return responderValidacion(res, nombres);
        }

        const dni = validarDni(req.body.dni);

        if (!dni.valido) {
            return responderValidacion(res, dni);
        }

        const cargoId = validarIdOpcional(
            tienePropiedad(req.body, 'cargo_id')
                ? req.body.cargo_id
                : null,
            'El cargo_id'
        );

        if (!cargoId.valido) {
            return responderValidacion(res, cargoId);
        }

        const areaId = validarIdOpcional(
            tienePropiedad(req.body, 'area_id')
                ? req.body.area_id
                : null,
            'El area_id'
        );

        if (!areaId.valido) {
            return responderValidacion(res, areaId);
        }

        const centroCostosId = validarIdOpcional(
            tienePropiedad(req.body, 'centro_costos_id')
                ? req.body.centro_costos_id
                : null,
            'El centro_costos_id'
        );

        if (!centroCostosId.valido) {
            return responderValidacion(res, centroCostosId);
        }

        const unidadEmpresarialId = validarIdOpcional(
            tienePropiedad(req.body, 'unidad_empresarial_id')
                ? req.body.unidad_empresarial_id
                : null,
            'El unidad_empresarial_id'
        );

        if (!unidadEmpresarialId.valido) {
            return responderValidacion(res, unidadEmpresarialId);
        }

        const estado = validarEstadoColaborador(
            tienePropiedad(req.body, 'estado')
                ? req.body.estado
                : 'ACTIVO'
        );

        if (!estado.valido) {
            return responderValidacion(res, estado);
        }

        const [resultado] = await pool.query(`
            INSERT INTO colaborador (
                codigo,
                apellidos,
                nombres,
                dni,
                cargo_id,
                area_id,
                centro_costos_id,
                unidad_empresarial_id,
                estado
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            codigo.valor,
            apellidos.valor,
            nombres.valor,
            dni.valor,
            cargoId.valor,
            areaId.valor,
            centroCostosId.valor,
            unidadEmpresarialId.valor,
            estado.valor
        ]);

        res.status(201).json({
            success: true,
            mensaje: 'Colaborador registrado correctamente',
            id: resultado.insertId
        });

    } catch (error) {

        console.error('Error al registrar colaborador:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El código o DNI ya está registrado'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje:
                    'El cargo, área, centro de costos o unidad empresarial no existe'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al registrar colaborador'
        });

    }
};

// ==========================================
// ACTUALIZAR COLABORADOR
// ==========================================
const actualizarColaborador = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos del colaborador'
            });
        }

        const campos = [];
        const valores = [];

        const relaciones = [
            ['cargo_id', 'El cargo_id'],
            ['area_id', 'El area_id'],
            ['centro_costos_id', 'El centro_costos_id'],
            ['unidad_empresarial_id', 'El unidad_empresarial_id']
        ];

        for (const [campo, etiqueta] of relaciones) {
            if (!tienePropiedad(req.body, campo)) continue;

            const relacion = validarIdOpcional(
                req.body[campo],
                etiqueta
            );

            if (!relacion.valido) {
                return responderValidacion(res, relacion);
            }

            campos.push(`${campo} = ?`);
            valores.push(relacion.valor);
        }

        if (tienePropiedad(req.body, 'estado')) {
            const estado = validarEstadoColaborador(
                req.body.estado
            );

            if (!estado.valido) {
                return responderValidacion(res, estado);
            }

            campos.push('estado = ?');
            valores.push(estado.valor);
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
            UPDATE colaborador
            SET ${campos.join(', ')}
            WHERE id = ?
            `,
            valores
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Colaborador no encontrado'
            });
        }

        return res.json({
            success: true,
            mensaje:
                'Colaborador actualizado correctamente',
            data: {
                id: id.valor,
                filas_modificadas:
                    resultado.changedRows
            }
        });
    } catch (error) {
        console.error(
            'Error al actualizar el colaborador:',
            error
        );

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje:
                    'El cargo, área, centro de costos o unidad empresarial no existe'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje:
                'Error al actualizar el colaborador'
        });
    }
};



module.exports = {
    listarColaboradores,
    buscarPorDni,
    registrarColaborador,
    obtenerColaboradorPorId,
    actualizarColaborador
};
