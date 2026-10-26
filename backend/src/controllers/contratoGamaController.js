const pool = require('../config/database');

const {
    esObjetoDatos,
    tienePropiedad,
    validarIdPositivo,
    validarEnteroPositivo,
    validarDecimalNoNegativo
} = require('../utils/validacionCatalogos');

const responderValidacion = (res, validacion) => (
    res.status(400).json({
        success: false,
        mensaje: validacion.mensaje
    })
);

const validarImporte = (
    valor,
    etiqueta,
    opcional = false
) => validarDecimalNoNegativo(
    valor,
    {
        etiqueta,
        maximo: 99999999.99,
        opcional
    }
);

const validarPlazo = (valor, etiqueta) => (
    validarEnteroPositivo(valor, etiqueta)
);

const plazosCoherentes = (meses, renovacion) => (
    renovacion <= meses
);

// LISTAR CONTRATO-GAMA
const listarContratoGamas = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                cg.id,

                cg.contrato_id,
                cm.nro_contrato,
                cm.fecha_inicio AS fecha_inicio_contrato,
                cm.fecha_fin AS fecha_fin_contrato,
                cm.estado AS estado_contrato,

                cg.gama_id,
                ge.codigo AS codigo_gama,
                ge.descripcion AS gama,

                cg.costo_alquiler_mensual,
                cg.costo_servicio_mensual,
                cg.meses_contrato,
                cg.mes_renovacion_equipo,
                cg.precio_prepago,
                cg.precio_venta_18m,

                om.nombre AS operador

            FROM contrato_gama cg

            INNER JOIN contrato_movil cm
                ON cm.id = cg.contrato_id

            INNER JOIN gama_equipo ge
                ON ge.id = cg.gama_id

            INNER JOIN operador_movil om
                ON om.id = cm.operador_id

            ORDER BY cg.id
        `);

        return res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error al listar contrato-gama:', error);

        return res.status(500).json({
            success: false,
            mensaje: 'Error al obtener contrato-gama'
        });
    }
};

// REGISTRAR CONTRATO-GAMA
const registrarContratoGama = async (req, res) => {
    try {
        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos de contrato-gama'
            });
        }

        const contratoId = validarEnteroPositivo(
            req.body.contrato_id,
            'El contrato_id'
        );

        if (!contratoId.valido) {
            return responderValidacion(res, contratoId);
        }

        const gamaId = validarEnteroPositivo(
            req.body.gama_id,
            'El gama_id'
        );

        if (!gamaId.valido) {
            return responderValidacion(res, gamaId);
        }

        const costoAlquiler = validarImporte(
            tienePropiedad(req.body, 'costo_alquiler_mensual')
                ? req.body.costo_alquiler_mensual
                : 0,
            'El costo de alquiler mensual'
        );

        if (!costoAlquiler.valido) {
            return responderValidacion(res, costoAlquiler);
        }

        const costoServicio = validarImporte(
            tienePropiedad(req.body, 'costo_servicio_mensual')
                ? req.body.costo_servicio_mensual
                : 0,
            'El costo de servicio mensual'
        );

        if (!costoServicio.valido) {
            return responderValidacion(res, costoServicio);
        }

        const meses = validarPlazo(
            tienePropiedad(req.body, 'meses_contrato')
                ? req.body.meses_contrato
                : 36,
            'Los meses de contrato'
        );

        if (!meses.valido) {
            return responderValidacion(res, meses);
        }

        const renovacion = validarPlazo(
            tienePropiedad(req.body, 'mes_renovacion_equipo')
                ? req.body.mes_renovacion_equipo
                : 18,
            'El mes de renovación del equipo'
        );

        if (!renovacion.valido) {
            return responderValidacion(res, renovacion);
        }

        if (!plazosCoherentes(meses.valor, renovacion.valor)) {
            return res.status(400).json({
                success: false,
                mensaje: 'El mes de renovación no puede superar los meses del contrato'
            });
        }

        const precioPrepago = validarImporte(
            tienePropiedad(req.body, 'precio_prepago')
                ? req.body.precio_prepago
                : null,
            'El precio prepago',
            true
        );

        if (!precioPrepago.valido) {
            return responderValidacion(res, precioPrepago);
        }

        const precioVenta = validarImporte(
            tienePropiedad(req.body, 'precio_venta_18m')
                ? req.body.precio_venta_18m
                : null,
            'El precio de venta a 18 meses',
            true
        );

        if (!precioVenta.valido) {
            return responderValidacion(res, precioVenta);
        }

        const [resultado] = await pool.query(`
            INSERT INTO contrato_gama (
                contrato_id,
                gama_id,
                costo_alquiler_mensual,
                costo_servicio_mensual,
                meses_contrato,
                mes_renovacion_equipo,
                precio_prepago,
                precio_venta_18m
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            contratoId.valor,
            gamaId.valor,
            costoAlquiler.valor,
            costoServicio.valor,
            meses.valor,
            renovacion.valor,
            precioPrepago.valor,
            precioVenta.valor
        ]);

        return res.status(201).json({
            success: true,
            mensaje: 'Relación contrato-gama registrada correctamente',
            id: resultado.insertId
        });
    } catch (error) {
        console.error('Error al registrar contrato-gama:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'Esa gama ya está asociada a ese contrato'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje: 'El contrato o la gama indicada no existe'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'Error al registrar contrato-gama'
        });
    }
};

// EDITAR CONTRATO-GAMA
const editarContratoGama = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos de contrato-gama'
            });
        }

        const campos = [];
        const valores = [];
        const condiciones = [];
        const valoresCondicion = [];

        for (const [campo, etiqueta] of [
            ['contrato_id', 'El contrato_id'],
            ['gama_id', 'El gama_id']
        ]) {
            if (!tienePropiedad(req.body, campo)) continue;

            const relacion = validarEnteroPositivo(
                req.body[campo],
                etiqueta
            );

            if (!relacion.valido) {
                return responderValidacion(res, relacion);
            }

            campos.push(`${campo} = ?`);
            valores.push(relacion.valor);
        }

        for (const [campo, etiqueta] of [
            ['costo_alquiler_mensual', 'El costo de alquiler mensual'],
            ['costo_servicio_mensual', 'El costo de servicio mensual']
        ]) {
            if (!tienePropiedad(req.body, campo)) continue;

            const importe = validarImporte(
                req.body[campo],
                etiqueta
            );

            if (!importe.valido) {
                return responderValidacion(res, importe);
            }

            campos.push(`${campo} = ?`);
            valores.push(importe.valor);
        }

        let meses;
        let renovacion;

        if (tienePropiedad(req.body, 'meses_contrato')) {
            meses = validarPlazo(
                req.body.meses_contrato,
                'Los meses de contrato'
            );

            if (!meses.valido) {
                return responderValidacion(res, meses);
            }

            campos.push('meses_contrato = ?');
            valores.push(meses.valor);
        }

        if (tienePropiedad(req.body, 'mes_renovacion_equipo')) {
            renovacion = validarPlazo(
                req.body.mes_renovacion_equipo,
                'El mes de renovación del equipo'
            );

            if (!renovacion.valido) {
                return responderValidacion(res, renovacion);
            }

            campos.push('mes_renovacion_equipo = ?');
            valores.push(renovacion.valor);
        }

        if (meses && renovacion) {
            if (!plazosCoherentes(meses.valor, renovacion.valor)) {
                return res.status(400).json({
                    success: false,
                    mensaje: 'El mes de renovación no puede superar los meses del contrato'
                });
            }
        } else if (meses) {
            condiciones.push('mes_renovacion_equipo <= ?');
            valoresCondicion.push(meses.valor);
        } else if (renovacion) {
            condiciones.push('? <= meses_contrato');
            valoresCondicion.push(renovacion.valor);
        }

        for (const [campo, etiqueta] of [
            ['precio_prepago', 'El precio prepago'],
            ['precio_venta_18m', 'El precio de venta a 18 meses']
        ]) {
            if (!tienePropiedad(req.body, campo)) continue;

            const importe = validarImporte(
                req.body[campo],
                etiqueta,
                true
            );

            if (!importe.valido) {
                return responderValidacion(res, importe);
            }

            campos.push(`${campo} = ?`);
            valores.push(importe.valor);
        }

        if (campos.length === 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar al menos un campo para actualizar'
            });
        }

        const [resultado] = await pool.query(`
            UPDATE contrato_gama
            SET ${campos.join(', ')}
            WHERE id = ?
            ${condiciones.length > 0
                ? `AND ${condiciones.join(' AND ')}`
                : ''}
        `, [
            ...valores,
            id.valor,
            ...valoresCondicion
        ]);

        if (resultado.affectedRows === 0) {
            if (condiciones.length > 0) {
                const [existentes] = await pool.query(
                    'SELECT id FROM contrato_gama WHERE id = ?',
                    [id.valor]
                );

                if (existentes.length > 0) {
                    return res.status(400).json({
                        success: false,
                        mensaje: 'El mes de renovación no puede superar los meses del contrato'
                    });
                }
            }

            return res.status(404).json({
                success: false,
                mensaje: 'Relación contrato-gama no encontrada'
            });
        }

        return res.json({
            success: true,
            mensaje: 'Contrato-gama actualizado correctamente'
        });
    } catch (error) {
        console.error('Error al editar contrato-gama:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'Esa gama ya está asociada a ese contrato'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje: 'El contrato o la gama indicada no existe'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar contrato-gama'
        });
    }
};

module.exports = {
    listarContratoGamas,
    registrarContratoGama,
    editarContratoGama
};
