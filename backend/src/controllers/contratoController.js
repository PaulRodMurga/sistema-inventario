const pool = require('../config/database');

const {
    esObjetoDatos,
    tienePropiedad,
    validarIdPositivo,
    validarEnteroPositivo,
    validarNombre,
    validarTextoOpcional,
    validarFecha,
    validarDecimalNoNegativo
} = require('../utils/validacionCatalogos');

const MONEDAS = new Set(['PEN', 'USD']);
const ESTADOS_CONTRATO = new Set([
    'VIGENTE',
    'VENCIDO',
    'CANCELADO'
]);

const responderValidacion = (res, validacion) => (
    res.status(400).json({
        success: false,
        mensaje: validacion.mensaje
    })
);

const validarOpcion = (valor, permitidos, mensaje) => {
    if (typeof valor !== 'string') {
        return { valido: false, mensaje };
    }

    const opcion = valor.trim().toUpperCase();

    if (!permitidos.has(opcion)) {
        return { valido: false, mensaje };
    }

    return { valido: true, valor: opcion };
};

const validarMoneda = (valor) => validarOpcion(
    valor,
    MONEDAS,
    'La moneda debe ser PEN o USD'
);

const validarEstadoContrato = (valor) => validarOpcion(
    valor,
    ESTADOS_CONTRATO,
    'El estado debe ser VIGENTE, VENCIDO o CANCELADO'
);

const validarFechaInicio = (valor) => validarFecha(
    valor,
    { etiqueta: 'La fecha de inicio' }
);

const validarFechaFin = (valor) => validarFecha(
    valor,
    {
        etiqueta: 'La fecha de fin',
        opcional: true
    }
);

const validarMontoContractual = (valor) => (
    validarDecimalNoNegativo(
        valor,
        {
            etiqueta: 'El monto contractual',
            maximo: 999999999999.99
        }
    )
);

const fechasCoherentes = (inicio, fin) => (
    fin === null || fin >= inicio
);

const validarTarifaGama = (valor) => {
    if (!esObjetoDatos(valor)) {
        return {
            valido: false,
            mensaje: 'Cada gama debe incluir sus datos de tarifa'
        };
    }

    const gamaId = validarEnteroPositivo(
        valor.gama_id,
        'Cada gama_id'
    );

    if (!gamaId.valido) return gamaId;

    const costoAlquiler = validarDecimalNoNegativo(
        tienePropiedad(valor, 'costo_alquiler_mensual')
            ? valor.costo_alquiler_mensual
            : 0,
        {
            etiqueta: 'El costo de alquiler mensual',
            maximo: 99999999.99
        }
    );

    if (!costoAlquiler.valido) return costoAlquiler;

    const costoServicio = validarDecimalNoNegativo(
        tienePropiedad(valor, 'costo_servicio_mensual')
            ? valor.costo_servicio_mensual
            : 0,
        {
            etiqueta: 'El costo de servicio mensual',
            maximo: 99999999.99
        }
    );

    if (!costoServicio.valido) return costoServicio;

    const meses = validarEnteroPositivo(
        tienePropiedad(valor, 'meses_contrato')
            ? valor.meses_contrato
            : 36,
        'Los meses de contrato'
    );

    if (!meses.valido) return meses;

    const renovacion = validarEnteroPositivo(
        tienePropiedad(valor, 'mes_renovacion_equipo')
            ? valor.mes_renovacion_equipo
            : 18,
        'El mes de renovación del equipo'
    );

    if (!renovacion.valido) return renovacion;

    if (renovacion.valor > meses.valor) {
        return {
            valido: false,
            mensaje: 'El mes de renovación no puede superar los meses del contrato'
        };
    }

    const precioPrepago = validarDecimalNoNegativo(
        tienePropiedad(valor, 'precio_prepago')
            ? valor.precio_prepago
            : null,
        {
            etiqueta: 'El precio prepago',
            maximo: 99999999.99,
            opcional: true
        }
    );

    if (!precioPrepago.valido) return precioPrepago;

    const precioVenta = validarDecimalNoNegativo(
        tienePropiedad(valor, 'precio_venta_18m')
            ? valor.precio_venta_18m
            : null,
        {
            etiqueta: 'El precio de venta a 18 meses',
            maximo: 99999999.99,
            opcional: true
        }
    );

    if (!precioVenta.valido) return precioVenta;

    return {
        valido: true,
        valor: {
            gama_id: gamaId.valor,
            costo_alquiler_mensual: costoAlquiler.valor,
            costo_servicio_mensual: costoServicio.valor,
            meses_contrato: meses.valor,
            mes_renovacion_equipo: renovacion.valor,
            precio_prepago: precioPrepago.valor,
            precio_venta_18m: precioVenta.valor
        }
    };
};

const validarGamasContrato = (datos) => {
    if (
        tienePropiedad(datos, 'gamas') &&
        tienePropiedad(datos, 'gama_ids')
    ) {
        return {
            valido: false,
            mensaje: 'Envía gamas con tarifas o gama_ids, pero no ambos campos'
        };
    }

    const usaTarifas = tienePropiedad(datos, 'gamas');
    const valor = usaTarifas ? datos.gamas : datos.gama_ids;

    if (valor === undefined) {
        return { valido: true, valor: [] };
    }

    if (!Array.isArray(valor) || valor.length === 0) {
        return {
            valido: false,
            mensaje: 'Selecciona al menos una gama para el contrato'
        };
    }

    if (valor.length > 50) {
        return {
            valido: false,
            mensaje: 'Un contrato no puede incluir más de 50 gamas'
        };
    }

    const tarifas = [];

    for (const elemento of valor) {
        const tarifa = validarTarifaGama(
            usaTarifas
                ? elemento
                : { gama_id: elemento }
        );

        if (!tarifa.valido) return tarifa;
        tarifas.push(tarifa.valor);
    }

    const ids = tarifas.map(({ gama_id: gamaId }) => gamaId);

    if (new Set(ids).size !== tarifas.length) {
        return {
            valido: false,
            mensaje: 'No repitas gamas dentro del contrato'
        };
    }

    return { valido: true, valor: tarifas };
};

const parametrosTarifa = (contratoId, tarifa) => [
    contratoId,
    tarifa.gama_id,
    tarifa.costo_alquiler_mensual,
    tarifa.costo_servicio_mensual,
    tarifa.meses_contrato,
    tarifa.mes_renovacion_equipo,
    tarifa.precio_prepago,
    tarifa.precio_venta_18m
];

// LISTAR CONTRATOS
const listarContratos = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                cm.id,
                cm.nro_contrato,
                cm.descripcion,
                cm.fecha_inicio,
                cm.fecha_fin,
                cm.monto_contractual,
                cm.moneda,
                cm.estado,

                om.id AS operador_id,
                om.nombre AS operador,

                COUNT(DISTINCT cg.id) AS cantidad_gamas,
                COUNT(DISTINCT e.id) AS cantidad_equipos,
                COUNT(DISTINCT CASE
                    WHEN e.estado_actual = 'ASIGNADO' THEN e.id
                END) AS equipos_asignados,
                COUNT(DISTINCT CASE
                    WHEN e.estado_actual = 'LIBRE' THEN e.id
                END) AS equipos_libres

            FROM contrato_movil cm

            INNER JOIN operador_movil om
                ON om.id = cm.operador_id

            LEFT JOIN contrato_gama cg
                ON cg.contrato_id = cm.id

            LEFT JOIN equipo e
                ON e.contrato_gama_id = cg.id

            GROUP BY
                cm.id,
                cm.nro_contrato,
                cm.descripcion,
                cm.fecha_inicio,
                cm.fecha_fin,
                cm.monto_contractual,
                cm.moneda,
                cm.estado,
                om.id,
                om.nombre

            ORDER BY cm.id DESC
        `);

        return res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error al listar contratos:', error);

        return res.status(500).json({
            success: false,
            mensaje: 'Error al obtener contratos'
        });
    }
};

// BUSCAR CONTRATO POR ID
const obtenerContrato = async (req, res) => {
    const id = validarIdPositivo(req.params.id);

    if (!id.valido) {
        return responderValidacion(res, id);
    }

    try {
        const [rows] = await pool.query(`
            SELECT
                cm.*,
                om.nombre AS operador,
                COUNT(DISTINCT cg.id) AS cantidad_gamas,
                COUNT(DISTINCT e.id) AS cantidad_equipos
            FROM contrato_movil cm
            INNER JOIN operador_movil om
                ON om.id = cm.operador_id
            LEFT JOIN contrato_gama cg
                ON cg.contrato_id = cm.id
            LEFT JOIN equipo e
                ON e.contrato_gama_id = cg.id
            WHERE cm.id = ?
            GROUP BY cm.id, om.nombre
        `, [id.valor]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Contrato no encontrado'
            });
        }

        const [[equipos], [gamas]] = await Promise.all([
            pool.query(`
                SELECT
                    e.id,
                    e.tipo,
                    e.marca,
                    e.modelo,
                    e.imei,
                    e.serie,
                    e.estado_actual,
                    ge.codigo AS codigo_gama,
                    ge.descripcion AS gama
                FROM equipo e
                INNER JOIN contrato_gama cg
                    ON cg.id = e.contrato_gama_id
                INNER JOIN gama_equipo ge
                    ON ge.id = cg.gama_id
                WHERE cg.contrato_id = ?
                ORDER BY e.id
            `, [id.valor]),
            pool.query(`
                SELECT
                    cg.id AS contrato_gama_id,
                    ge.id AS gama_id,
                    ge.codigo,
                    ge.descripcion,
                    ge.estado,
                    cg.costo_alquiler_mensual,
                    cg.costo_servicio_mensual,
                    cg.meses_contrato,
                    cg.mes_renovacion_equipo,
                    cg.precio_prepago,
                    cg.precio_venta_18m
                FROM contrato_gama cg
                INNER JOIN gama_equipo ge
                    ON ge.id = cg.gama_id
                WHERE cg.contrato_id = ?
                ORDER BY ge.codigo
            `, [id.valor])
        ]);

        return res.json({
            success: true,
            data: {
                ...rows[0],
                equipos,
                gamas
            }
        });
    } catch (error) {
        console.error('Error al buscar contrato:', error);

        return res.status(500).json({
            success: false,
            mensaje: 'Error al buscar contrato'
        });
    }
};

// REGISTRAR CONTRATO
const registrarContrato = async (req, res) => {
    try {
        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos del contrato'
            });
        }

        const operadorId = validarEnteroPositivo(
            req.body.operador_id,
            'El operador_id'
        );

        if (!operadorId.valido) {
            return responderValidacion(res, operadorId);
        }

        const numero = validarNombre(
            req.body.nro_contrato,
            50,
            'El número de contrato'
        );

        if (!numero.valido) {
            return responderValidacion(res, numero);
        }

        const descripcion = validarTextoOpcional(
            tienePropiedad(req.body, 'descripcion')
                ? req.body.descripcion
                : null,
            200,
            'La descripción'
        );

        if (!descripcion.valido) {
            return responderValidacion(res, descripcion);
        }

        const fechaInicio = validarFechaInicio(
            req.body.fecha_inicio
        );

        if (!fechaInicio.valido) {
            return responderValidacion(res, fechaInicio);
        }

        const fechaFin = validarFechaFin(
            tienePropiedad(req.body, 'fecha_fin')
                ? req.body.fecha_fin
                : null
        );

        if (!fechaFin.valido) {
            return responderValidacion(res, fechaFin);
        }

        if (!fechasCoherentes(fechaInicio.valor, fechaFin.valor)) {
            return res.status(400).json({
                success: false,
                mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio'
            });
        }

        const monto = validarMontoContractual(
            tienePropiedad(req.body, 'monto_contractual')
                ? req.body.monto_contractual
                : 0
        );

        if (!monto.valido) {
            return responderValidacion(res, monto);
        }

        const moneda = validarMoneda(
            tienePropiedad(req.body, 'moneda')
                ? req.body.moneda
                : 'PEN'
        );

        if (!moneda.valido) {
            return responderValidacion(res, moneda);
        }

        const estado = validarEstadoContrato(
            tienePropiedad(req.body, 'estado')
                ? req.body.estado
                : 'VIGENTE'
        );

        if (!estado.valido) {
            return responderValidacion(res, estado);
        }

        const gamas = validarGamasContrato(req.body);

        if (!gamas.valido) {
            return responderValidacion(res, gamas);
        }

        const datosContrato = [
            operadorId.valor,
            numero.valor,
            descripcion.valor,
            fechaInicio.valor,
            fechaFin.valor,
            monto.valor,
            moneda.valor,
            estado.valor
        ];

        let resultado;

        if (gamas.valor.length === 0) {
            [resultado] = await pool.query(`
                INSERT INTO contrato_movil (
                    operador_id,
                    nro_contrato,
                    descripcion,
                    fecha_inicio,
                    fecha_fin,
                    monto_contractual,
                    moneda,
                    estado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, datosContrato);
        } else {
            const conexion = await pool.getConnection();

            try {
                await conexion.beginTransaction();

                const idsGamas = gamas.valor.map(({ gama_id: gamaId }) => gamaId);
                const marcadores = idsGamas.map(() => '?').join(', ');
                const [gamasExistentes] = await conexion.query(`
                    SELECT id
                    FROM gama_equipo
                    WHERE estado = 'ACTIVO'
                      AND id IN (${marcadores})
                    FOR UPDATE
                `, idsGamas);

                if (gamasExistentes.length !== gamas.valor.length) {
                    await conexion.rollback();

                    return res.status(400).json({
                        success: false,
                        mensaje: 'Una o más gamas no existen o están inactivas'
                    });
                }

                [resultado] = await conexion.query(`
                    INSERT INTO contrato_movil (
                        operador_id,
                        nro_contrato,
                        descripcion,
                        fecha_inicio,
                        fecha_fin,
                        monto_contractual,
                        moneda,
                        estado
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, datosContrato);

                const valoresGamas = gamas.valor
                    .map(() => '(?, ?, ?, ?, ?, ?, ?, ?)')
                    .join(', ');
                const parametrosGamas = gamas.valor.flatMap(
                    (tarifa) => parametrosTarifa(resultado.insertId, tarifa)
                );

                await conexion.query(`
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
                    VALUES ${valoresGamas}
                `, parametrosGamas);

                await conexion.commit();
            } catch (error) {
                await conexion.rollback();
                throw error;
            } finally {
                conexion.release();
            }
        }

        return res.status(201).json({
            success: true,
            mensaje: 'Contrato registrado correctamente',
            id: Number(resultado.insertId),
            data: {
                id: Number(resultado.insertId),
                cantidad_gamas: gamas.valor.length
            }
        });
    } catch (error) {
        console.error('Error al registrar contrato:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El número de contrato ya existe'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje: 'El proveedor indicado no existe'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'Error al registrar contrato'
        });
    }
};

// EDITAR CONTRATO
const editarContrato = async (req, res) => {
    try {
        const id = validarIdPositivo(req.params.id);

        if (!id.valido) {
            return responderValidacion(res, id);
        }

        if (!esObjetoDatos(req.body)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Debes enviar los datos del contrato'
            });
        }

        const campos = [];
        const valores = [];
        const condiciones = [];
        const valoresCondicion = [];

        if (tienePropiedad(req.body, 'operador_id')) {
            const operadorId = validarEnteroPositivo(
                req.body.operador_id,
                'El operador_id'
            );

            if (!operadorId.valido) {
                return responderValidacion(res, operadorId);
            }

            campos.push('operador_id = ?');
            valores.push(operadorId.valor);
        }

        if (tienePropiedad(req.body, 'nro_contrato')) {
            const numero = validarNombre(
                req.body.nro_contrato,
                50,
                'El número de contrato'
            );

            if (!numero.valido) {
                return responderValidacion(res, numero);
            }

            campos.push('nro_contrato = ?');
            valores.push(numero.valor);
        }

        if (tienePropiedad(req.body, 'descripcion')) {
            const descripcion = validarTextoOpcional(
                req.body.descripcion,
                200,
                'La descripción'
            );

            if (!descripcion.valido) {
                return responderValidacion(res, descripcion);
            }

            campos.push('descripcion = ?');
            valores.push(descripcion.valor);
        }

        let fechaInicio;
        let fechaFin;

        if (tienePropiedad(req.body, 'fecha_inicio')) {
            fechaInicio = validarFechaInicio(req.body.fecha_inicio);

            if (!fechaInicio.valido) {
                return responderValidacion(res, fechaInicio);
            }

            campos.push('fecha_inicio = ?');
            valores.push(fechaInicio.valor);
        }

        if (tienePropiedad(req.body, 'fecha_fin')) {
            fechaFin = validarFechaFin(req.body.fecha_fin);

            if (!fechaFin.valido) {
                return responderValidacion(res, fechaFin);
            }

            campos.push('fecha_fin = ?');
            valores.push(fechaFin.valor);
        }

        if (fechaInicio && fechaFin) {
            if (!fechasCoherentes(fechaInicio.valor, fechaFin.valor)) {
                return res.status(400).json({
                    success: false,
                    mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio'
                });
            }
        } else if (fechaInicio) {
            condiciones.push('(fecha_fin IS NULL OR fecha_fin >= ?)');
            valoresCondicion.push(fechaInicio.valor);
        } else if (fechaFin && fechaFin.valor !== null) {
            condiciones.push('fecha_inicio <= ?');
            valoresCondicion.push(fechaFin.valor);
        }

        if (tienePropiedad(req.body, 'monto_contractual')) {
            const monto = validarMontoContractual(
                req.body.monto_contractual
            );

            if (!monto.valido) {
                return responderValidacion(res, monto);
            }

            campos.push('monto_contractual = ?');
            valores.push(monto.valor);
        }

        if (tienePropiedad(req.body, 'moneda')) {
            const moneda = validarMoneda(req.body.moneda);

            if (!moneda.valido) {
                return responderValidacion(res, moneda);
            }

            campos.push('moneda = ?');
            valores.push(moneda.valor);
        }

        if (tienePropiedad(req.body, 'estado')) {
            const estado = validarEstadoContrato(req.body.estado);

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

        const [resultado] = await pool.query(`
            UPDATE contrato_movil
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
                    'SELECT id FROM contrato_movil WHERE id = ?',
                    [id.valor]
                );

                if (existentes.length > 0) {
                    return res.status(400).json({
                        success: false,
                        mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio'
                    });
                }
            }

            return res.status(404).json({
                success: false,
                mensaje: 'Contrato no encontrado'
            });
        }

        return res.json({
            success: true,
            mensaje: 'Contrato actualizado correctamente'
        });
    } catch (error) {
        console.error('Error al actualizar contrato:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El número de contrato ya existe'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje: 'El proveedor indicado no existe'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar contrato'
        });
    }
};

// AGREGAR GAMAS O ACTUALIZAR SUS TARIFAS SIN ELIMINAR HISTORIAL
const actualizarGamasContrato = async (req, res) => {
    const id = validarIdPositivo(req.params.id);

    if (!id.valido) {
        return responderValidacion(res, id);
    }

    if (!esObjetoDatos(req.body)) {
        return res.status(400).json({
            success: false,
            mensaje: 'Debes enviar las gamas y sus tarifas'
        });
    }

    const gamas = validarGamasContrato({ gamas: req.body.gamas });

    if (!gamas.valido) {
        return responderValidacion(res, gamas);
    }

    if (gamas.valor.length === 0) {
        return res.status(400).json({
            success: false,
            mensaje: 'Selecciona al menos una gama para el contrato'
        });
    }

    let conexion;

    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        const [contratos] = await conexion.query(`
            SELECT id
            FROM contrato_movil
            WHERE id = ?
            FOR UPDATE
        `, [id.valor]);

        if (contratos.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                success: false,
                mensaje: 'Contrato no encontrado'
            });
        }

        const idsGamas = gamas.valor.map(({ gama_id: gamaId }) => gamaId);
        const marcadores = idsGamas.map(() => '?').join(', ');
        const [gamasDisponibles] = await conexion.query(`
            SELECT
                ge.id,
                ge.estado,
                cg.id AS contrato_gama_id
            FROM gama_equipo ge
            LEFT JOIN contrato_gama cg
                ON cg.gama_id = ge.id
               AND cg.contrato_id = ?
            WHERE ge.id IN (${marcadores})
            FOR UPDATE
        `, [id.valor, ...idsGamas]);

        const disponiblesPorId = new Map(
            gamasDisponibles.map((gama) => [Number(gama.id), gama])
        );
        const gamaInvalida = idsGamas.some((gamaId) => {
            const gama = disponiblesPorId.get(gamaId);
            return !gama || (
                gama.estado !== 'ACTIVO' &&
                !gama.contrato_gama_id
            );
        });

        if (gamaInvalida) {
            await conexion.rollback();

            return res.status(400).json({
                success: false,
                mensaje: 'Una o más gamas no existen o están inactivas'
            });
        }

        const valores = gamas.valor
            .map(() => '(?, ?, ?, ?, ?, ?, ?, ?)')
            .join(', ');
        const parametros = gamas.valor.flatMap(
            (tarifa) => parametrosTarifa(id.valor, tarifa)
        );

        await conexion.query(`
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
            VALUES ${valores}
            ON DUPLICATE KEY UPDATE
                costo_alquiler_mensual = VALUES(costo_alquiler_mensual),
                costo_servicio_mensual = VALUES(costo_servicio_mensual),
                meses_contrato = VALUES(meses_contrato),
                mes_renovacion_equipo = VALUES(mes_renovacion_equipo),
                precio_prepago = VALUES(precio_prepago),
                precio_venta_18m = VALUES(precio_venta_18m)
        `, parametros);

        await conexion.commit();

        return res.json({
            success: true,
            mensaje: 'Gamas y tarifas actualizadas correctamente',
            data: {
                contrato_id: id.valor,
                cantidad_gamas: gamas.valor.length
            }
        });
    } catch (error) {
        if (conexion) {
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error('No se pudo revertir la actualización de tarifas:', errorRollback);
            }
        }
        console.error('Error al actualizar gamas del contrato:', error);

        return res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar las gamas del contrato'
        });
    } finally {
        conexion?.release();
    }
};

// INHABILITAR CONTRATA SIN BORRAR SU HISTORIAL NI SUS EQUIPOS
const inhabilitarContrato = async (req, res) => {
    const id = validarIdPositivo(req.params.id);

    if (!id.valido) {
        return responderValidacion(res, id);
    }

    try {
        const [resultado] = await pool.query(`
            UPDATE contrato_movil
            SET estado = 'CANCELADO'
            WHERE id = ?
              AND estado <> 'CANCELADO'
        `, [id.valor]);

        if (resultado.affectedRows === 0) {
            const [existentes] = await pool.query(
                'SELECT id, estado FROM contrato_movil WHERE id = ?',
                [id.valor]
            );

            if (existentes.length === 0) {
                return res.status(404).json({
                    success: false,
                    mensaje: 'Contrato no encontrado'
                });
            }

            return res.json({
                success: true,
                mensaje: 'El contrato ya estaba inhabilitado'
            });
        }

        return res.json({
            success: true,
            mensaje: 'Contrato inhabilitado correctamente'
        });
    } catch (error) {
        console.error('Error al inhabilitar contrata:', error);

        return res.status(500).json({
            success: false,
            mensaje: 'Error al inhabilitar el contrato'
        });
    }
};

module.exports = {
    listarContratos,
    obtenerContrato,
    registrarContrato,
    editarContrato,
    actualizarGamasContrato,
    inhabilitarContrato
};
