const {
    TIPOS_PERIFERICO,
    TIPOS_PRINCIPALES_PERIFERICOS,
    normalizarEspecificaciones
} = require('../config/tiposEquipo');

const TIPOS_OBLIGATORIOS_COMPUTADOR = new Set([
    'MONITOR',
    'TECLADO',
    'MOUSE'
]);
const MAXIMO_PERIFERICOS = 20;

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

const resultadoError = (mensaje) => ({
    ok: false,
    mensaje
});

const normalizarPeriferico = (entrada, tipoEsperado = null) => {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
        return resultadoError('El periférico no tiene una estructura válida');
    }

    const tipo = tipoEsperado || entrada.tipo;

    if (!TIPOS_PERIFERICO.has(tipo)) {
        return resultadoError('El periférico debe ser MONITOR, TECLADO, MOUSE, PARLANTES, CAMARA WEB o AUDIFONOS');
    }

    if (entrada.tipo !== undefined && entrada.tipo !== tipo) {
        return resultadoError('El tipo del periférico no coincide con la operación');
    }

    const marca = normalizarTexto(entrada.marca, 50, true);
    const modelo = normalizarTexto(entrada.modelo, 100, true);
    const codigoPatrimonial = normalizarTexto(
        entrada.codigo_patrimonial,
        50
    );
    const serie = normalizarTexto(entrada.serie, 30);
    const observaciones = normalizarTexto(entrada.observaciones, 5000);

    if (!marca || !modelo) {
        return resultadoError(
            `Marca y modelo son obligatorios para el ${tipo}`
        );
    }

    if (
        codigoPatrimonial === null ||
        serie === null ||
        observaciones === null
    ) {
        return resultadoError(
            `Algún dato del ${tipo} supera la longitud permitida`
        );
    }

    if (!codigoPatrimonial && !serie) {
        return resultadoError(
            `Indica la serie o el código patrimonial del ${tipo}`
        );
    }

    const tiposConEspecificaciones = new Set([
        'MONITOR',
        'TECLADO',
        'MOUSE'
    ]);
    const especificaciones = tiposConEspecificaciones.has(tipo)
        ? normalizarEspecificaciones(tipo, entrada.especificaciones)
        : { ok: true, valor: {} };

    if (!especificaciones.ok) {
        return resultadoError(especificaciones.mensaje);
    }

    return {
        ok: true,
        valor: {
            tipo,
            marca,
            modelo,
            codigo_patrimonial: codigoPatrimonial || null,
            serie: serie || null,
            observaciones: observaciones || null,
            especificaciones: especificaciones.valor
        }
    };
};



const normalizarPerifericos = (tipoPrincipal, entrada) => {
    if (entrada === null || entrada === undefined) {
        return { ok: true, valor: [] };
    }

    if (!Array.isArray(entrada)) {
        return resultadoError(
            'Los periféricos deben enviarse como una lista'
        );
    }

    if (entrada.length === 0) {
        if (tipoPrincipal === 'COMPUTADOR') {
            return resultadoError(
                'Para un COMPUTADOR debes agregar MONITOR, TECLADO y MOUSE'
            );
        }

        return { ok: true, valor: [] };
    }

    if (!TIPOS_PRINCIPALES_PERIFERICOS.has(tipoPrincipal)) {
        return resultadoError(
            'Solo COMPUTADOR y LAPTOP pueden registrar periféricos'
        );
    }

    if (entrada.length > MAXIMO_PERIFERICOS) {
        return resultadoError(
            `No puedes registrar más de ${MAXIMO_PERIFERICOS} periféricos por equipo`
        );
    }

    const perifericos = [];

    for (let indice = 0; indice < entrada.length; indice += 1) {
        const periferico = normalizarPeriferico(entrada[indice]);

        if (!periferico.ok) {
            return resultadoError(
                `Periférico ${indice + 1}: ${periferico.mensaje}`
            );
        }

        perifericos.push(periferico.valor);
    }

    // COMPUTADOR requiere como mínimo uno de cada tipo
    if (tipoPrincipal === 'COMPUTADOR') {
        const tiposPresentes = new Set(
            perifericos.map((periferico) => periferico.tipo)
        );

        const faltantes = [...TIPOS_OBLIGATORIOS_COMPUTADOR].filter(
            (tipo) => !tiposPresentes.has(tipo)
        );

        if (faltantes.length > 0) {
            return resultadoError(
                `Para un COMPUTADOR debes agregar: ${faltantes.join(', ')}`
            );
        }
    }

    return {
        ok: true,
        valor: perifericos
    };
};


const insertarRegistroPeriferico = async (
    baseDatos,
    periferico,
    contratoGamaId
) => {
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
            observaciones,
            especificaciones
        )
        VALUES (?, ?, ?, ?, NULL, ?, 'VINCULADO', ?, ?, ?)
    `, [
        periferico.tipo,
        periferico.marca,
        periferico.modelo,
        periferico.codigo_patrimonial,
        periferico.serie,
        contratoGamaId,
        periferico.observaciones,
        Object.keys(periferico.especificaciones).length > 0
            ? JSON.stringify(periferico.especificaciones)
            : null
    ]);

    return Number(resultado.insertId);
};


const obtenerPerifericoExistente = async (
    baseDatos,
    perifericoId,
    tipoEsperado
) => {
    const id = Number(perifericoId);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error('El ID del periférico no es válido');
    }

    const [filas] = await baseDatos.query(
        `SELECT id, tipo, estado_actual
         FROM equipo
         WHERE id = ?
         FOR UPDATE`,
        [id]
    );

    if (filas.length === 0) {
        throw new Error('El periférico seleccionado no existe');
    }

    const periferico = filas[0];

    if (periferico.tipo !== tipoEsperado) {
        throw new Error(
            'El periférico seleccionado no corresponde al tipo solicitado'
        );
    }

    if (periferico.estado_actual === 'BAJA') {
        throw new Error('No se puede asignar un periférico dado de baja');
    }

    const [vinculos] = await baseDatos.query(
        `SELECT equipo_principal_id
         FROM equipo_periferico
         WHERE periferico_id = ?
         FOR UPDATE`,
        [id]
    );

    if (vinculos.length > 0) {
        throw new Error(
            'El periférico seleccionado ya está vinculado a otro equipo'
        );
    }

    return id;
};

const insertarVinculoPeriferico = async (
    baseDatos,
    equipoPrincipalId,
    perifericoId,
    tipo
) => {
    await baseDatos.query(`
        INSERT INTO equipo_periferico (
            equipo_principal_id,
            periferico_id,
            tipo_periferico
        )
        VALUES (?, ?, ?)
    `, [equipoPrincipalId, perifericoId, tipo]);
};

const registrarPerifericos = async (
    baseDatos,
    equipoPrincipalId,
    contratoGamaId,
    perifericos
) => {
    const registros = [];

    for (const periferico of perifericos) {
        const perifericoId = await insertarRegistroPeriferico(
            baseDatos,
            periferico,
            contratoGamaId
        );

        await insertarVinculoPeriferico(
            baseDatos,
            equipoPrincipalId,
            perifericoId,
            periferico.tipo
        );

        registros.push({
            tipo: periferico.tipo,
            id: perifericoId
        });
    }

    return registros;
};

module.exports = {
    TIPOS_PERIFERICO,
    TIPOS_PRINCIPALES_PERIFERICOS,
    insertarRegistroPeriferico,
    insertarVinculoPeriferico,
    obtenerPerifericoExistente,
    normalizarPeriferico,
    normalizarPerifericos,
    registrarPerifericos
};
