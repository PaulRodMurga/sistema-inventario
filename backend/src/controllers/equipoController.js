const pool = require('../config/database');
const {
    TIPOS,
    TIPOS_EQUIPO,
    normalizarEspecificaciones
} = require('../config/tiposEquipo');
const {
    normalizarPerifericos,
    registrarPerifericos
} = require('../utils/perifericosEquipo');
const MAXIMO_EQUIPOS_LOTE = 100;

const normalizarId = (valor) => {
    const numero = typeof valor === 'string' && /^\d+$/.test(valor)
        ? Number(valor)
        : valor;

    return Number.isSafeInteger(numero) && numero > 0
        ? numero
        : null;
};

const normalizarTexto = (valor, maximo, obligatorio = false) => {
    if (valor === null || valor === undefined) {
        return obligatorio ? null : '';
    }

    if (typeof valor !== 'string') return null;

    const texto = valor.trim();

    if ((obligatorio && !texto) || texto.length > maximo) {
        return null;
    }

    return texto;
};

const normalizarFechaOpcional = (valor) => {
    if (valor === null || valor === undefined || valor === '') return null;
    if (typeof valor !== 'string') return undefined;

    const fecha = valor.trim();
    const coincidencia = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!coincidencia) return undefined;

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);
    const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));

    if (
        anio < 1000 ||
        fechaUtc.getUTCFullYear() !== anio ||
        fechaUtc.getUTCMonth() !== mes - 1 ||
        fechaUtc.getUTCDate() !== dia
    ) {
        return undefined;
    }

    return fecha;
};

const buscarContratoGamaHabilitado = async (
    baseDatos,
    contratoGamaId,
    contratoId = null
) => {
    const [filas] = await baseDatos.query(`
        SELECT
            cg.id,
            cg.contrato_id,
            cm.nro_contrato
        FROM contrato_gama cg
        INNER JOIN contrato_movil cm
            ON cm.id = cg.contrato_id
        WHERE cg.id = ?
          AND (? IS NULL OR cm.id = ?)
          AND cm.estado = 'VIGENTE'
          AND cm.fecha_inicio <= CURRENT_DATE
          AND (cm.fecha_fin IS NULL OR cm.fecha_fin >= CURRENT_DATE)
        LIMIT 1
    `, [contratoGamaId, contratoId, contratoId]);

    return filas[0] || null;
};

const responderErrorRegistro = (res, error, lote = false) => {
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            success: false,
            mensaje: lote
                ? 'El lote contiene un IMEI, serie o código patrimonial ya registrado'
                : 'El IMEI, la serie o el código patrimonial ya están registrados'
        });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
            success: false,
            mensaje: 'El contrato o gama seleccionados ya no existen'
        });
    }

    return res.status(500).json({
        success: false,
        mensaje: lote
            ? 'Error al registrar el lote de equipos'
            : 'Error al registrar el equipo',
        error: error.message
    });
};

const insertarEquipoPrincipal = async (baseDatos, datos) => {
    const [resultado] = await baseDatos.query(`
        INSERT INTO equipo (
            tipo,
            marca,
            modelo,
            codigo_patrimonial,
            imei,
            serie,
            estado_actual,
            contrato_gama_id,
            fecha_inicio_alquiler,
            fecha_fin_alquiler,
            observaciones,
            especificaciones
        )
        VALUES (?, ?, ?, ?, ?, ?, 'LIBRE', ?, ?, ?, ?, ?)
    `, [
        datos.tipo,
        datos.marca,
        datos.modelo,
        datos.codigo_patrimonial,
        datos.imei,
        datos.serie,
        datos.contrato_gama_id,
        datos.fecha_inicio_alquiler,
        datos.fecha_fin_alquiler,
        datos.observaciones,
        Object.keys(datos.especificaciones).length > 0
            ? JSON.stringify(datos.especificaciones)
            : null
    ]);

    return resultado;
};

// ==========================================
// CATÁLOGO DE TIPOS Y CAMPOS DINÁMICOS
// ==========================================
const listarTiposEquipo = (req, res) => {
    return res.json({
        success: true,
        cantidad: TIPOS.length,
        data: TIPOS
    });
};


// ==========================================
// LISTAR EQUIPOS
// ==========================================
const listarEquipos = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                e.id,
                e.tipo,
                e.marca,
                e.modelo,
                (
                    SELECT CONCAT(c.nombres, ' ', c.apellidos)
                    FROM asignacion a
                    INNER JOIN colaborador c
                        ON c.id = a.colaborador_id
                    WHERE a.estado = 'ACTIVA'
                      AND (
                          a.equipo_id = e.id
                          OR a.equipo_id = (
                              SELECT ep_asignado.equipo_principal_id
                              FROM equipo_periferico ep_asignado
                              WHERE ep_asignado.periferico_id = e.id
                              LIMIT 1
                          )
                      )
                    ORDER BY a.id DESC
                    LIMIT 1
                ) AS colaborador_asignado,
                e.codigo_patrimonial,
                e.imei,
                e.serie,
                e.estado_actual,
                e.contrato_gama_id,
                cg.contrato_id,
                ge.codigo AS codigo_gama,
                ge.descripcion AS gama,
                cm.nro_contrato,
                cm.estado AS estado_contrato,
                om.nombre AS operador,
                e.fecha_inicio_alquiler,
                e.fecha_fin_alquiler,
                e.observaciones,
                e.especificaciones,
                ep.equipo_principal_id,
                principal.tipo AS tipo_equipo_principal,
                principal.marca AS marca_equipo_principal,
                principal.modelo AS modelo_equipo_principal,
                principal.serie AS serie_equipo_principal
            FROM equipo e

            LEFT JOIN equipo_periferico ep
                ON ep.periferico_id = e.id

            LEFT JOIN equipo principal
                ON principal.id = ep.equipo_principal_id

            LEFT JOIN contrato_gama cg
                ON cg.id = e.contrato_gama_id

            LEFT JOIN gama_equipo ge
                ON ge.id = cg.gama_id

            LEFT JOIN contrato_movil cm
                ON cm.id = cg.contrato_id

            LEFT JOIN operador_movil om
                ON om.id = cm.operador_id

            ORDER BY e.id
        `);

        res.json({
            success: true,
            cantidad: rows.length,
            data: rows
        });

    } catch (error) {
        console.error('Error al listar equipos:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener los equipos',
            error: error.message
        });
    }
};

// ==========================================
// EQUIPO POR ID
// ==========================================
const obtenerEquipoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(`
      SELECT
        e.id,
        e.tipo,
        e.marca,
        e.modelo,
        e.codigo_patrimonial,
        e.imei,
        e.serie,
        e.estado_actual,
        e.contrato_gama_id,
        e.fecha_inicio_alquiler,
        e.fecha_fin_alquiler,
        e.observaciones,
        e.especificaciones,
        ep.equipo_principal_id,
        principal.tipo AS tipo_equipo_principal,
        principal.marca AS marca_equipo_principal,
        principal.modelo AS modelo_equipo_principal,

        cg.contrato_id,

        cm.nro_contrato,
        cm.descripcion AS descripcion_contrato,
        cm.fecha_inicio AS fecha_inicio_contrato,
        cm.fecha_fin AS fecha_fin_contrato,

        om.id AS operador_id,
        om.nombre AS operador,

        ge.id AS gama_id,
        ge.codigo AS codigo_gama,
        ge.descripcion AS gama

      FROM equipo e

      LEFT JOIN equipo_periferico ep
        ON ep.periferico_id = e.id

      LEFT JOIN equipo principal
        ON principal.id = ep.equipo_principal_id

      LEFT JOIN contrato_gama cg
        ON cg.id = e.contrato_gama_id

      LEFT JOIN contrato_movil cm
        ON cm.id = cg.contrato_id

      LEFT JOIN operador_movil om
        ON om.id = cm.operador_id

      LEFT JOIN gama_equipo ge
        ON ge.id = cg.gama_id

      WHERE e.id = ?
    `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Equipo no encontrado'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('Error al obtener el equipo:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al obtener el equipo',
            error: error.message
        });
    }
};

// ==========================================
// BUSCAR POR IMEI
// ==========================================
const buscarPorImei = async (req, res) => {
    try {
        const { imei } = req.params;

        const [rows] = await pool.query(`
            SELECT *
            FROM vw_inventario
            WHERE imei = ?
        `, [imei]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontró ningún equipo con ese IMEI'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('Error al buscar IMEI:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al buscar el equipo',
            error: error.message
        });
    }
};


// ==========================================
// BUSCAR POR SERIE
// ==========================================
const buscarPorSerie = async (req, res) => {
    try {
        const { serie } = req.params;

        const [rows] = await pool.query(`
            SELECT *
            FROM vw_inventario
            WHERE serie = ?
        `, [serie]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontró ningún equipo con esa serie'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('Error al buscar serie:', error);

        res.status(500).json({
            success: false,
            mensaje: 'Error al buscar el equipo',
            error: error.message
        });
    }
};


// ==========================================
// REGISTRAR EQUIPO
// ==========================================
const registrarEquipo = async (req, res) => {
    let conexion;

    try {
        const {
            tipo,
            marca,
            modelo,
            codigo_patrimonial,
            imei,
            serie,
            contrato_id,
            contrato_gama_id,
            fecha_inicio_alquiler,
            fecha_fin_alquiler,
            observaciones,
            especificaciones,
            perifericos
        } = req.body;

        if (!tipo || !marca || !modelo || !contrato_gama_id) {
            return res.status(400).json({
                success: false,
                mensaje:
                    'Tipo, marca, modelo y contrato_gama_id son obligatorios'
            });
        }

        if (!TIPOS_EQUIPO.has(tipo)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Selecciona un tipo de equipo válido'
            });
        }

        const codigoPatrimonial = normalizarTexto(
            codigo_patrimonial,
            50
        );
        const especificacionesNormalizadas =
            normalizarEspecificaciones(tipo, especificaciones);
        const perifericosNormalizados = normalizarPerifericos(
            tipo,
            perifericos
        );

        if (codigoPatrimonial === null) {
            return res.status(400).json({
                success: false,
                mensaje: 'El código patrimonial no puede superar 50 caracteres'
            });
        }

        if (!especificacionesNormalizadas.ok) {
            return res.status(400).json({
                success: false,
                mensaje: especificacionesNormalizadas.mensaje
            });
        }

        if (!perifericosNormalizados.ok) {
            return res.status(400).json({
                success: false,
                mensaje: perifericosNormalizados.mensaje
            });
        }

        const contratoGamaId = normalizarId(contrato_gama_id);
        const contratoId = contrato_id === undefined
            ? null
            : normalizarId(contrato_id);

        if (!contratoGamaId || (contrato_id !== undefined && !contratoId)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Selecciona un contrato y una gama válidos'
            });
        }

        const baseDatos = perifericosNormalizados.valor.length > 0
            ? await pool.getConnection()
            : pool;

        if (baseDatos !== pool) {
            conexion = baseDatos;
            await conexion.beginTransaction();
        }

        const contratoGama = await buscarContratoGamaHabilitado(
            baseDatos,
            contratoGamaId,
            contratoId
        );

        if (!contratoGama) {
            if (conexion) await conexion.rollback();
            return res.status(400).json({
                success: false,
                mensaje: 'El contrato no está vigente o no corresponde a la gama seleccionada'
            });
        }

        const resultado = await insertarEquipoPrincipal(baseDatos, {
            tipo,
            marca,
            modelo,
            codigo_patrimonial: codigoPatrimonial || null,
            imei: imei || null,
            serie: serie || null,
            contrato_gama_id: contratoGamaId,
            fecha_inicio_alquiler: fecha_inicio_alquiler || null,
            fecha_fin_alquiler: fecha_fin_alquiler || null,
            observaciones: observaciones || null,
            especificaciones: especificacionesNormalizadas.valor
        });

        const perifericosRegistrados = await registrarPerifericos(
            baseDatos,
            Number(resultado.insertId),
            contratoGamaId,
            perifericosNormalizados.valor
        );

        if (conexion) await conexion.commit();

        res.status(201).json({
            success: true,
            mensaje: 'Equipo registrado correctamente',
            id: resultado.insertId,
            data: {
                perifericos: perifericosRegistrados
            }
        });

    } catch (error) {
        if (conexion) await conexion.rollback();
        console.error('Error al registrar equipo:', error);

        return responderErrorRegistro(res, error);
    } finally {
        conexion?.release();
    }
};

// ==========================================
// REGISTRAR EQUIPOS POR LOTE
// ==========================================
const registrarEquiposLote = async (req, res) => {
    const cuerpo = req.body;

    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        return res.status(400).json({
            success: false,
            mensaje: 'Debes enviar los datos del lote'
        });
    }

    const tipo = cuerpo.tipo;
    const marca = normalizarTexto(cuerpo.marca, 50, true);
    const modelo = normalizarTexto(cuerpo.modelo, 100, true);
    const contratoId = normalizarId(cuerpo.contrato_id);
    const contratoGamaId = normalizarId(cuerpo.contrato_gama_id);
    const fechaInicio = normalizarFechaOpcional(
        cuerpo.fecha_inicio_alquiler
    );
    const fechaFin = normalizarFechaOpcional(
        cuerpo.fecha_fin_alquiler
    );
    const observaciones = normalizarTexto(
        cuerpo.observaciones,
        5000
    );

    if (!TIPOS_EQUIPO.has(tipo)) {
        return res.status(400).json({
            success: false,
            mensaje: 'Selecciona un tipo de equipo válido'
        });
    }

    const especificacionesComunes = normalizarEspecificaciones(
        tipo,
        cuerpo.especificaciones
    );

    if (!especificacionesComunes.ok) {
        return res.status(400).json({
            success: false,
            mensaje: especificacionesComunes.mensaje
        });
    }

    if (!marca || !modelo) {
        return res.status(400).json({
            success: false,
            mensaje: 'La marca y el modelo son obligatorios'
        });
    }

    if (!contratoId || !contratoGamaId) {
        return res.status(400).json({
            success: false,
            mensaje: 'Selecciona un contrato y una gama válidos'
        });
    }

    if (fechaInicio === undefined || fechaFin === undefined) {
        return res.status(400).json({
            success: false,
            mensaje: 'Las fechas deben tener el formato YYYY-MM-DD'
        });
    }

    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        return res.status(400).json({
            success: false,
            mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio'
        });
    }

    if (observaciones === null) {
        return res.status(400).json({
            success: false,
            mensaje: 'Las observaciones no pueden superar 5000 caracteres'
        });
    }

    if (
        !Array.isArray(cuerpo.equipos) ||
        cuerpo.equipos.length === 0 ||
        cuerpo.equipos.length > MAXIMO_EQUIPOS_LOTE
    ) {
        return res.status(400).json({
            success: false,
            mensaje: `El lote debe contener entre 1 y ${MAXIMO_EQUIPOS_LOTE} equipos`
        });
    }

    const equipos = [];
    const imeis = new Set();
    const series = new Set();
    const codigosPatrimoniales = new Set();

    for (let indice = 0; indice < cuerpo.equipos.length; indice += 1) {
        const elemento = cuerpo.equipos[indice];

        if (!elemento || typeof elemento !== 'object' || Array.isArray(elemento)) {
            return res.status(400).json({
                success: false,
                mensaje: `El equipo ${indice + 1} no tiene una estructura válida`
            });
        }

        const imei = normalizarTexto(elemento.imei, 30);
        const serie = normalizarTexto(elemento.serie, 30);
        const codigoPatrimonial = normalizarTexto(
            elemento.codigo_patrimonial,
            50
        );

        if (
            imei === null ||
            serie === null ||
            codigoPatrimonial === null
        ) {
            return res.status(400).json({
                success: false,
                mensaje: `Un identificador del equipo ${indice + 1} supera la longitud permitida`
            });
        }

        if (!imei && !serie && !codigoPatrimonial) {
            return res.status(400).json({
                success: false,
                mensaje: `Indica IMEI, serie o código patrimonial para el equipo ${indice + 1}`
            });
        }

        if (imei && imeis.has(imei)) {
            return res.status(400).json({
                success: false,
                mensaje: `El IMEI ${imei} está repetido dentro del lote`
            });
        }

        if (serie && series.has(serie)) {
            return res.status(400).json({
                success: false,
                mensaje: `La serie ${serie} está repetida dentro del lote`
            });
        }

        if (
            codigoPatrimonial &&
            codigosPatrimoniales.has(codigoPatrimonial)
        ) {
            return res.status(400).json({
                success: false,
                mensaje: `El código patrimonial ${codigoPatrimonial} está repetido dentro del lote`
            });
        }

        const especificacionesEquipo = normalizarEspecificaciones(
            tipo,
            {
                ...especificacionesComunes.valor,
                ...(elemento.especificaciones || {})
            }
        );

        if (!especificacionesEquipo.ok) {
            return res.status(400).json({
                success: false,
                mensaje: `Equipo ${indice + 1}: ${especificacionesEquipo.mensaje}`
            });
        }

        const perifericosEquipo = normalizarPerifericos(
            tipo,
            elemento.perifericos
        );

        if (!perifericosEquipo.ok) {
            return res.status(400).json({
                success: false,
                mensaje: `Equipo ${indice + 1}: ${perifericosEquipo.mensaje}`
            });
        }

        if (imei) imeis.add(imei);
        if (serie) series.add(serie);
        if (codigoPatrimonial) {
            codigosPatrimoniales.add(codigoPatrimonial);
        }

        for (const periferico of perifericosEquipo.valor) {
            if (periferico.serie && series.has(periferico.serie)) {
                return res.status(400).json({
                    success: false,
                    mensaje: `La serie ${periferico.serie} está repetida dentro del lote`
                });
            }

            if (
                periferico.codigo_patrimonial &&
                codigosPatrimoniales.has(periferico.codigo_patrimonial)
            ) {
                return res.status(400).json({
                    success: false,
                    mensaje: `El código patrimonial ${periferico.codigo_patrimonial} está repetido dentro del lote`
                });
            }

            if (periferico.serie) series.add(periferico.serie);
            if (periferico.codigo_patrimonial) {
                codigosPatrimoniales.add(periferico.codigo_patrimonial);
            }
        }

        equipos.push({
            imei: imei || null,
            serie: serie || null,
            codigo_patrimonial: codigoPatrimonial || null,
            especificaciones: especificacionesEquipo.valor,
            perifericos: perifericosEquipo.valor
        });
    }

    let conexion;

    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        const contratoGama = await buscarContratoGamaHabilitado(
            conexion,
            contratoGamaId,
            contratoId
        );

        if (!contratoGama) {
            await conexion.rollback();

            return res.status(400).json({
                success: false,
                mensaje: 'El contrato no está vigente o no corresponde a la gama seleccionada'
            });
        }

        const ids = [];
        const perifericosRegistrados = [];

        for (const equipo of equipos) {
            const resultado = await insertarEquipoPrincipal(conexion, {
                tipo,
                marca,
                modelo,
                codigo_patrimonial: equipo.codigo_patrimonial,
                imei: equipo.imei,
                serie: equipo.serie,
                contrato_gama_id: contratoGamaId,
                fecha_inicio_alquiler: fechaInicio,
                fecha_fin_alquiler: fechaFin,
                observaciones: observaciones || null,
                especificaciones: equipo.especificaciones
            });

            const equipoId = Number(resultado.insertId);
            ids.push(equipoId);

            perifericosRegistrados.push(
                ...await registrarPerifericos(
                    conexion,
                    equipoId,
                    contratoGamaId,
                    equipo.perifericos
                )
            );
        }

        await conexion.commit();

        return res.status(201).json({
            success: true,
            mensaje: `${ids.length} equipos registrados correctamente`,
            id: ids[0],
            data: {
                cantidad: ids.length,
                ids,
                cantidad_perifericos: perifericosRegistrados.length,
                perifericos: perifericosRegistrados
            }
        });
    } catch (error) {
        if (conexion) await conexion.rollback();
        console.error('Error al registrar lote de equipos:', error);
        return responderErrorRegistro(res, error, true);
    } finally {
        conexion?.release();
    }
};


// ==========================================
// EDITAR EQUIPO
// ==========================================
const editarEquipo = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            tipo,
            marca,
            modelo,
            contrato_gama_id
        } = req.body;

        if (!tipo || !marca || !modelo || !contrato_gama_id) {
            return res.status(400).json({
                success: false,
                mensaje:
                    'Tipo, marca, modelo y contrato_gama_id son obligatorios'
            });
        }

        if (!TIPOS_EQUIPO.has(tipo)) {
            return res.status(400).json({
                success: false,
                mensaje: 'Selecciona un tipo de equipo válido'
            });
        }

        /*
        IMPORTANTE:
        No modificamos estado_actual desde este endpoint.

        El estado debe cambiar mediante:
        - asignaciones
        - devoluciones
        - movimientos
        - triggers
        */

        const campos = [
            'marca = ?',
            'modelo = ?',
            'contrato_gama_id = ?'
        ];

        const valores = [
            marca,
            modelo,
            contrato_gama_id
        ];

        if (
            Object.prototype.hasOwnProperty.call(
                req.body,
                'codigo_patrimonial'
            ) &&
            req.body.codigo_patrimonial !== undefined
        ) {
            const codigoPatrimonial = normalizarTexto(
                req.body.codigo_patrimonial,
                50
            );

            if (codigoPatrimonial === null) {
                return res.status(400).json({
                    success: false,
                    mensaje: 'El código patrimonial no puede superar 50 caracteres'
                });
            }

            campos.push('codigo_patrimonial = ?');
            valores.push(codigoPatrimonial || null);
        }

        // Lista fija: nunca se toman nombres de columnas del cliente.
        const camposOpcionales = [
            'imei',
            'serie',
            'fecha_inicio_alquiler',
            'fecha_fin_alquiler',
            'observaciones'
        ];

        for (const campo of camposOpcionales) {
            if (
                !Object.prototype.hasOwnProperty.call(req.body, campo) ||
                req.body[campo] === undefined
            ) {
                // Un campo omitido conserva su valor en la base de datos.
                continue;
            }

            campos.push(`${campo} = ?`);

            // Vaciar requiere enviar el campo expresamente como '' o null.
            const valor = req.body[campo];
            valores.push(valor === '' ? null : valor);
        }

        if (
            Object.prototype.hasOwnProperty.call(
                req.body,
                'especificaciones'
            ) &&
            req.body.especificaciones !== undefined
        ) {
            const especificacionesNormalizadas =
                normalizarEspecificaciones(
                    tipo,
                    req.body.especificaciones
                );

            if (!especificacionesNormalizadas.ok) {
                return res.status(400).json({
                    success: false,
                    mensaje: especificacionesNormalizadas.mensaje
                });
            }

            campos.push('especificaciones = ?');
            valores.push(
                Object.keys(especificacionesNormalizadas.valor).length > 0
                    ? JSON.stringify(especificacionesNormalizadas.valor)
                    : null
            );
        }

        valores.push(id, tipo);

        const [resultado] = await pool.query(`
            UPDATE equipo
            SET ${campos.join(', ')}
            WHERE id = ? AND tipo = ?
        `, valores);

        if (resultado.affectedRows === 0) {
            return res.status(409).json({
                success: false,
                mensaje:
                    'No se actualizó el equipo. El tipo está protegido y debe conservarse.'
            });
        }

        res.json({
            success: true,
            mensaje: 'Equipo actualizado correctamente'
        });

    } catch (error) {
        console.error('Error al editar equipo:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'El IMEI, la serie o el código patrimonial ya pertenecen a otro equipo'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                mensaje: 'El contrato/gama indicado no existe'
            });
        }

        res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar el equipo',
            error: error.message
        });
    }
};


module.exports = {
    listarTiposEquipo,
    listarEquipos,
    buscarPorImei,
    buscarPorSerie,
    registrarEquipo,
    registrarEquiposLote,
    editarEquipo,
    obtenerEquipoPorId
};
