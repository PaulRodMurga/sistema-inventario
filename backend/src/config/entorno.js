const ENTORNOS_PERMITIDOS = new Set([
    'development',
    'test',
    'production'
]);

const leerTextoRequerido = (entorno, nombre) => {
    const valor = entorno[nombre];

    if (typeof valor !== 'string' || !valor.trim()) {
        throw new Error(
            `Falta la variable de entorno obligatoria ${nombre}`
        );
    }

    return valor.trim();
};

const leerClaveRequerida = (entorno, nombre) => {
    const valor = entorno[nombre];

    if (typeof valor !== 'string' || valor.length === 0) {
        throw new Error(
            `Falta la variable de entorno obligatoria ${nombre}`
        );
    }

    return valor;
};

const leerEntero = (
    entorno,
    nombre,
    valorPorDefecto,
    minimo,
    maximo
) => {
    const valorOriginal = entorno[nombre];
    const valor = valorOriginal == null || valorOriginal === ''
        ? valorPorDefecto
        : Number(valorOriginal);

    if (
        !Number.isSafeInteger(valor) ||
        valor < minimo ||
        valor > maximo
    ) {
        throw new Error(
            `${nombre} debe ser un entero entre ${minimo} y ${maximo}`
        );
    }

    return valor;
};

const normalizarOrigen = (valor) => {
    let url;

    try {
        url = new URL(valor);
    } catch {
        throw new Error(
            `Origen CORS inválido: ${valor}`
        );
    }

    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        (url.pathname !== '/' && url.pathname !== '') ||
        url.search ||
        url.hash
    ) {
        throw new Error(
            `Origen CORS inválido: ${valor}`
        );
    }

    return url.origin;
};

const leerOrigenesCors = (entorno) => {
    const valor = typeof entorno.CORS_ORIGINS === 'string'
        ? entorno.CORS_ORIGINS
        : 'http://localhost:5173';

    const origenes = valor
        .split(',')
        .map((origen) => origen.trim())
        .filter(Boolean)
        .map(normalizarOrigen);

    if (origenes.length === 0 || origenes.includes('*')) {
        throw new Error(
            'CORS_ORIGINS debe incluir al menos un origen explícito'
        );
    }

    return [...new Set(origenes)];
};

const obtenerConfiguracion = (entorno = process.env) => {
    const modo = typeof entorno.NODE_ENV === 'string'
        ? entorno.NODE_ENV.trim().toLowerCase()
        : 'development';

    if (!ENTORNOS_PERMITIDOS.has(modo)) {
        throw new Error(
            'NODE_ENV debe ser development, test o production'
        );
    }

    const usuario = leerTextoRequerido(entorno, 'DB_USER');
    const advertencias = [];

    if (usuario.toLowerCase() === 'root') {
        advertencias.push(
            'DB_USER usa root. Crea una cuenta MySQL exclusiva para la aplicación.'
        );
    }

    return Object.freeze({
        servidor: Object.freeze({
            modo,
            esProduccion: modo === 'production',
            puerto: leerEntero(
                entorno,
                'PORT',
                3000,
                1,
                65535
            ),
            origenesCors: Object.freeze(
                leerOrigenesCors(entorno)
            ),
            // Admite las cargas masivas validadas de equipos y colaboradores.
            limiteJson: '10mb'
        }),
        baseDatos: Object.freeze({
            host: leerTextoRequerido(entorno, 'DB_HOST'),
            puerto: leerEntero(
                entorno,
                'DB_PORT',
                3306,
                1,
                65535
            ),
            usuario,
            clave: leerClaveRequerida(
                entorno,
                'DB_PASSWORD'
            ),
            nombre: leerTextoRequerido(entorno, 'DB_NAME'),
            limiteConexiones: leerEntero(
                entorno,
                'DB_CONNECTION_LIMIT',
                10,
                1,
                100
            )
        }),
        autenticacion: Object.freeze({
            duracionSesionHoras: leerEntero(
                entorno,
                'AUTH_SESSION_HOURS',
                8,
                1,
                168
            ),
            maxIntentos: leerEntero(
                entorno,
                'AUTH_MAX_ATTEMPTS',
                5,
                3,
                20
            ),
            minutosBloqueo: leerEntero(
                entorno,
                'AUTH_LOCK_MINUTES',
                15,
                1,
                1440
            )
        }),
        advertencias: Object.freeze(advertencias)
    });
};

module.exports = {
    obtenerConfiguracion
};
