const pool = require('../config/database');
const {
    TIPOS_EQUIPO,
    obtenerTipoEquipo,
    normalizarEspecificaciones
} = require('../config/tiposEquipo');
const {
    normalizarPeriferico,
    normalizarPerifericos,
    registrarPerifericos
} = require('../utils/perifericosEquipo');

const MAXIMO_EQUIPOS = 500;
const MAXIMO_PERIFERICOS = 1500;

const normalizarClave = (valor) => String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const texto = (valor, maximo, obligatorio = false) => {
    const salida = valor === null || valor === undefined
        ? ''
        : String(valor).trim();

    if ((obligatorio && !salida) || salida.length > maximo) {
        return null;
    }

    return salida;
};

const fecha = (valor) => {
    if (valor === null || valor === undefined || valor === '') return null;

    const salida = String(valor).trim();
    const coincidencia = salida.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!coincidencia) return undefined;

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);
    const comprobacion = new Date(Date.UTC(anio, mes - 1, dia));

    if (
        anio < 1000 ||
        comprobacion.getUTCFullYear() !== anio ||
        comprobacion.getUTCMonth() !== mes - 1 ||
        comprobacion.getUTCDate() !== dia
    ) {
        return undefined;
    }

    return salida;
};

const crearColectorErrores = () => {
    const errores = [];

    return {
        agregar(hoja, fila, campo, mensaje) {
            errores.push({ hoja, fila, campo, mensaje });
        },
        errores
    };
};

const convertirEspecificaciones = (
    tipo,
    entrada,
    colector,
    hoja,
    fila
) => {
    if (entrada === null || entrada === undefined) return {};

    if (typeof entrada !== 'object' || Array.isArray(entrada)) {
        colector.agregar(
            hoja,
            fila,
            'especificaciones',
            'Las especificaciones no tienen una estructura válida'
        );
        return null;
    }

    const definicion = obtenerTipoEquipo(tipo);

    if (!definicion) return null;

    const campos = new Map(
        definicion.campos.map((campo) => [campo.clave, campo])
    );
    const salida = {};

    for (const [clave, valorOriginal] of Object.entries(entrada)) {
        if (
            valorOriginal === '' ||
            valorOriginal === null ||
            valorOriginal === undefined
        ) {
            continue;
        }

        const campo = campos.get(clave);

        if (!campo) {
            colector.agregar(
                hoja,
                fila,
                clave,
                `El campo no corresponde al tipo ${tipo}`
            );
            continue;
        }

        if (campo.tipo === 'number') {
            const numero = typeof valorOriginal === 'number'
                ? valorOriginal
                : Number(String(valorOriginal).trim().replace(',', '.'));

            salida[clave] = numero;
            continue;
        }

        if (campo.tipo === 'select') {
            salida[clave] = normalizarClave(valorOriginal);
            continue;
        }

        salida[clave] = String(valorOriginal).trim();
    }

    const resultado = normalizarEspecificaciones(tipo, salida);

    if (!resultado.ok) {
        colector.agregar(
            hoja,
            fila,
            'especificaciones',
            resultado.mensaje
        );
        return null;
    }

    return resultado.valor;
};

const normalizarIdentificadores = (
    entrada,
    colector,
    hoja,
    fila,
    { permiteImei = true } = {}
) => {
    const codigoPatrimonial = texto(entrada.codigo_patrimonial, 50);
    const imei = permiteImei ? texto(entrada.imei, 30) : '';
    const serie = texto(entrada.serie, 30);

    if (
        codigoPatrimonial === null ||
        imei === null ||
        serie === null
    ) {
        colector.agregar(
            hoja,
            fila,
            'identificadores',
            'Un identificador supera la longitud permitida'
        );
        return null;
    }

    if (!codigoPatrimonial && !imei && !serie) {
        colector.agregar(
            hoja,
            fila,
            'identificadores',
            'Indica al menos código patrimonial, IMEI o serie'
        );
    }

    return {
        codigo_patrimonial: codigoPatrimonial || null,
        imei: imei || null,
        serie: serie || null
    };
};

const normalizarCargaEquipos = (cuerpo) => {
    const colector = crearColectorErrores();
    const equiposEntrada = cuerpo?.equipos;
    const perifericosEntrada = cuerpo?.perifericos ?? [];

    if (!Array.isArray(equiposEntrada)) {
        colector.agregar(
            'Equipos',
            null,
            'archivo',
            'La hoja Equipos no tiene una estructura válida'
        );
        return { errores: colector.errores, equipos: [], perifericos: [] };
    }

    if (!Array.isArray(perifericosEntrada)) {
        colector.agregar(
            'Perifericos',
            null,
            'archivo',
            'La hoja Perifericos no tiene una estructura válida'
        );
        return { errores: colector.errores, equipos: [], perifericos: [] };
    }

    if (equiposEntrada.length === 0) {
        colector.agregar(
            'Equipos',
            null,
            'archivo',
            'La hoja Equipos debe contener al menos un registro'
        );
    }

    if (equiposEntrada.length > MAXIMO_EQUIPOS) {
        colector.agregar(
            'Equipos',
            null,
            'archivo',
            `Solo se permiten ${MAXIMO_EQUIPOS} equipos por importación`
        );
    }

    if (perifericosEntrada.length > MAXIMO_PERIFERICOS) {
        colector.agregar(
            'Perifericos',
            null,
            'archivo',
            `Solo se permiten ${MAXIMO_PERIFERICOS} periféricos por importación`
        );
    }

    const equipos = [];
    const claves = new Set();

    equiposEntrada.slice(0, MAXIMO_EQUIPOS).forEach((entrada, indice) => {
        const fila = Number(entrada?.fila) || indice + 2;

        if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
            colector.agregar(
                'Equipos',
                fila,
                'fila',
                'La fila no tiene una estructura válida'
            );
            return;
        }

        const clave = texto(entrada.clave_importacion, 80, true);
        const tipo = normalizarClave(entrada.tipo);
        const marca = texto(entrada.marca, 50, true);
        const modelo = texto(entrada.modelo, 100, true);
        const nroContrato = texto(entrada.nro_contrato, 50, true);
        const codigoGama = texto(entrada.codigo_gama, 30, true);
        const fechaInicio = fecha(entrada.fecha_inicio_alquiler);
        const fechaFin = fecha(entrada.fecha_fin_alquiler);
        const observaciones = texto(entrada.observaciones, 5000);

        if (!clave) {
            colector.agregar(
                'Equipos', fila, 'clave_importacion',
                'La clave de importación es obligatoria y admite hasta 80 caracteres'
            );
        } else if (claves.has(normalizarClave(clave))) {
            colector.agregar(
                'Equipos', fila, 'clave_importacion',
                'La clave de importación está repetida'
            );
        } else {
            claves.add(normalizarClave(clave));
        }

        if (!TIPOS_EQUIPO.has(tipo)) {
            colector.agregar(
                'Equipos', fila, 'tipo',
                'Selecciona un tipo de equipo válido'
            );
        }

        if (!marca) {
            colector.agregar(
                'Equipos', fila, 'marca',
                'La marca es obligatoria y admite hasta 50 caracteres'
            );
        }

        if (!modelo) {
            colector.agregar(
                'Equipos', fila, 'modelo',
                'El modelo es obligatorio y admite hasta 100 caracteres'
            );
        }

        if (!nroContrato) {
            colector.agregar(
                'Equipos', fila, 'nro_contrato',
                'El número de contrato es obligatorio'
            );
        }

        if (!codigoGama) {
            colector.agregar(
                'Equipos', fila, 'codigo_gama',
                'El código de gama es obligatorio'
            );
        }

        if (fechaInicio === undefined || fechaFin === undefined) {
            colector.agregar(
                'Equipos', fila, 'fechas',
                'Las fechas deben tener el formato YYYY-MM-DD'
            );
        } else if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
            colector.agregar(
                'Equipos', fila, 'fecha_fin_alquiler',
                'La fecha de fin no puede ser anterior a la fecha de inicio'
            );
        }

        if (observaciones === null) {
            colector.agregar(
                'Equipos', fila, 'observaciones',
                'Las observaciones admiten hasta 5000 caracteres'
            );
        }

        const identificadores = normalizarIdentificadores(
            entrada,
            colector,
            'Equipos',
            fila
        );
        const especificaciones = TIPOS_EQUIPO.has(tipo)
            ? convertirEspecificaciones(
                tipo,
                entrada.especificaciones,
                colector,
                'Equipos',
                fila
            )
            : null;

        equipos.push({
            _hoja: 'Equipos',
            _fila: fila,
            clave_importacion: clave || '',
            tipo,
            marca: marca || '',
            modelo: modelo || '',
            nro_contrato: nroContrato || '',
            codigo_gama: codigoGama || '',
            ...identificadores,
            fecha_inicio_alquiler: fechaInicio ?? null,
            fecha_fin_alquiler: fechaFin ?? null,
            observaciones: observaciones || null,
            especificaciones: especificaciones || {},
            perifericos: []
        });
    });

    const porClave = new Map(
        equipos.map((equipo) => [
            normalizarClave(equipo.clave_importacion),
            equipo
        ])
    );
    const perifericos = [];
    const tiposPorEquipo = new Map();

    perifericosEntrada.slice(0, MAXIMO_PERIFERICOS)
        .forEach((entrada, indice) => {
            const fila = Number(entrada?.fila) || indice + 2;

            if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
                colector.agregar(
                    'Perifericos', fila, 'fila',
                    'La fila no tiene una estructura válida'
                );
                return;
            }

            const equipoClave = texto(entrada.equipo_clave, 80, true);
            const tipo = normalizarClave(entrada.tipo);
            const equipo = porClave.get(normalizarClave(equipoClave));
            const especificaciones = convertirEspecificaciones(
                tipo,
                entrada.especificaciones,
                colector,
                'Perifericos',
                fila
            );
            const candidato = {
                ...entrada,
                tipo,
                marca: texto(entrada.marca, 50, true) || '',
                modelo: texto(entrada.modelo, 100, true) || '',
                codigo_patrimonial: texto(entrada.codigo_patrimonial, 50) || '',
                serie: texto(entrada.serie, 30) || '',
                observaciones: texto(entrada.observaciones, 5000) || '',
                especificaciones: especificaciones || {}
            };
            const resultado = normalizarPeriferico(candidato);

            if (!equipoClave) {
                colector.agregar(
                    'Perifericos', fila, 'equipo_clave',
                    'La clave del equipo principal es obligatoria'
                );
            } else if (!equipo) {
                colector.agregar(
                    'Perifericos', fila, 'equipo_clave',
                    'No existe un equipo con esa clave en la hoja Equipos'
                );
            } else if (!['COMPUTADOR', 'LAPTOP'].includes(equipo.tipo)) {
                colector.agregar(
                    'Perifericos', fila, 'equipo_clave',
                    'Solo COMPUTADOR y LAPTOP pueden tener periféricos'
                );
            }

            if (!resultado.ok) {
                colector.agregar(
                    'Perifericos', fila, 'periferico',
                    resultado.mensaje
                );
                return;
            }

            if (equipo) {
                const claveEquipo = normalizarClave(equipo.clave_importacion);
                const tipos = tiposPorEquipo.get(claveEquipo) || new Set();

                if (tipos.has(tipo)) {
                    colector.agregar(
                        'Perifericos', fila, 'tipo',
                        `El equipo ya tiene un ${tipo} en esta importación`
                    );
                } else {
                    tipos.add(tipo);
                    tiposPorEquipo.set(claveEquipo, tipos);
                    equipo.perifericos.push(resultado.valor);
                }
            }

            perifericos.push({
                ...resultado.valor,
                _hoja: 'Perifericos',
                _fila: fila,
                equipo_clave: equipoClave || ''
            });
        });

    for (const equipo of equipos) {
        const resultado = normalizarPerifericos(
            equipo.tipo,
            equipo.perifericos
        );

        if (!resultado.ok) {
            colector.agregar(
                'Equipos',
                equipo._fila,
                'perifericos',
                resultado.mensaje
            );
        }
    }

    const identificadores = {
        imei: new Map(),
        serie: new Map(),
        codigo_patrimonial: new Map()
    };

    const revisarRepetido = (registro, campo) => {
        const valor = registro[campo];
        if (!valor) return;

        const clave = normalizarClave(valor);
        const anterior = identificadores[campo].get(clave);

        if (anterior) {
            colector.agregar(
                registro._hoja,
                registro._fila,
                campo,
                `El valor está repetido (también aparece en ${anterior.hoja}, fila ${anterior.fila})`
            );
        } else {
            identificadores[campo].set(clave, {
                hoja: registro._hoja,
                fila: registro._fila
            });
        }
    };

    for (const registro of [...equipos, ...perifericos]) {
        revisarRepetido(registro, 'imei');
        revisarRepetido(registro, 'serie');
        revisarRepetido(registro, 'codigo_patrimonial');
    }

    return {
        errores: colector.errores,
        equipos,
        perifericos
    };
};

const completarValidacionBaseDatos = async (baseDatos, resultado) => {
    const colector = { agregar: (...argumentos) => {
        resultado.errores.push({
            hoja: argumentos[0],
            fila: argumentos[1],
            campo: argumentos[2],
            mensaje: argumentos[3]
        });
    } };

    const [contratosGamas] = await baseDatos.query(`
        SELECT
            cg.id,
            cm.nro_contrato,
            ge.codigo AS codigo_gama
        FROM contrato_gama cg
        INNER JOIN contrato_movil cm ON cm.id = cg.contrato_id
        INNER JOIN gama_equipo ge ON ge.id = cg.gama_id
        WHERE cm.estado = 'VIGENTE'
          AND cm.fecha_inicio <= CURRENT_DATE
          AND (cm.fecha_fin IS NULL OR cm.fecha_fin >= CURRENT_DATE)
    `);
    const mapaContratos = new Map(
        contratosGamas.map((registro) => [
            `${normalizarClave(registro.nro_contrato)}|${normalizarClave(registro.codigo_gama)}`,
            Number(registro.id)
        ])
    );

    for (const equipo of resultado.equipos) {
        const clave = `${normalizarClave(equipo.nro_contrato)}|${normalizarClave(equipo.codigo_gama)}`;
        equipo.contrato_gama_id = mapaContratos.get(clave) || null;

        if (!equipo.contrato_gama_id) {
            colector.agregar(
                equipo._hoja,
                equipo._fila,
                'nro_contrato/codigo_gama',
                'No corresponde a un contrato vigente y una gama habilitada'
            );
        }
    }

    const [existentes] = await baseDatos.query(`
        SELECT imei, serie, codigo_patrimonial
        FROM equipo
        WHERE imei IS NOT NULL
           OR serie IS NOT NULL
           OR codigo_patrimonial IS NOT NULL
    `);
    const usados = {
        imei: new Set(),
        serie: new Set(),
        codigo_patrimonial: new Set()
    };

    for (const registro of existentes) {
        for (const campo of Object.keys(usados)) {
            if (registro[campo]) usados[campo].add(normalizarClave(registro[campo]));
        }
    }

    for (const registro of [...resultado.equipos, ...resultado.perifericos]) {
        for (const campo of Object.keys(usados)) {
            if (registro[campo] && usados[campo].has(normalizarClave(registro[campo]))) {
                colector.agregar(
                    registro._hoja,
                    registro._fila,
                    campo,
                    'El valor ya está registrado en el inventario'
                );
            }
        }
    }

    return resultado;
};

const prepararImportacion = async (baseDatos, cuerpo) => {
    const resultado = normalizarCargaEquipos(cuerpo);

    if (resultado.equipos.length > 0) {
        await completarValidacionBaseDatos(baseDatos, resultado);
    }

    return resultado;
};

const resumen = (resultado) => ({
    valido: resultado.errores.length === 0,
    cantidad_equipos: resultado.equipos.length,
    cantidad_perifericos: resultado.perifericos.length,
    errores: resultado.errores
});

const validarImportacionEquipos = async (req, res) => {
    try {
        const resultado = await prepararImportacion(pool, req.body);

        return res.json({
            success: true,
            data: resumen(resultado)
        });
    } catch (error) {
        console.error('Error al validar la importación de equipos:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'No se pudo validar la importación de equipos'
        });
    }
};

const importarEquipos = async (req, res) => {
    let conexion;

    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        const resultado = await prepararImportacion(conexion, req.body);

        if (resultado.errores.length > 0) {
            await conexion.rollback();
            return res.status(422).json({
                success: false,
                mensaje: 'Corrige los errores del archivo antes de importar',
                data: resumen(resultado)
            });
        }

        const ids = [];
        let cantidadPerifericos = 0;

        for (const equipo of resultado.equipos) {
            const [registro] = await conexion.query(`
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
                equipo.tipo,
                equipo.marca,
                equipo.modelo,
                equipo.codigo_patrimonial,
                equipo.imei,
                equipo.serie,
                equipo.contrato_gama_id,
                equipo.fecha_inicio_alquiler,
                equipo.fecha_fin_alquiler,
                equipo.observaciones,
                Object.keys(equipo.especificaciones).length > 0
                    ? JSON.stringify(equipo.especificaciones)
                    : null
            ]);
            const equipoId = Number(registro.insertId);
            ids.push(equipoId);

            const registrados = await registrarPerifericos(
                conexion,
                equipoId,
                equipo.contrato_gama_id,
                equipo.perifericos
            );
            cantidadPerifericos += registrados.length;
        }

        await conexion.commit();

        return res.status(201).json({
            success: true,
            mensaje: `${ids.length} equipos importados correctamente`,
            id: ids[0],
            data: {
                cantidad_equipos: ids.length,
                cantidad_perifericos: cantidadPerifericos,
                ids
            }
        });
    } catch (error) {
        if (conexion) await conexion.rollback();
        console.error('Error al importar equipos:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                mensaje: 'Un IMEI, serie o código patrimonial ya fue registrado'
            });
        }

        return res.status(500).json({
            success: false,
            mensaje: 'No se pudieron importar los equipos'
        });
    } finally {
        conexion?.release();
    }
};

module.exports = {
    completarValidacionBaseDatos,
    importarEquipos,
    normalizarCargaEquipos,
    validarImportacionEquipos
};
