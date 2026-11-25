const ENTORNOS_PERMITIDOS = new Set([
    'development',
    'test',
    'production'
]);

const URL_AD_POR_DEFECTO = 'https://sap30003.distriluz.com.pe:60000/ActiveDirectory/Api/ActiveDirectory/ValidarDato';

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

    const urlDirectorioActivo = (
        typeof entorno.AD_API_URL === 'string' && entorno.AD_API_URL.trim()
            ? entorno.AD_API_URL.trim()
            : URL_AD_POR_DEFECTO
    );

    let urlAD;
    try {
        urlAD = new URL(urlDirectorioActivo);
    } catch {
        throw new Error('AD_API_URL debe ser una URL válida');
    }

    if (
        urlAD.protocol !== 'https:' ||
        urlAD.username ||
        urlAD.password
    ) {
        throw new Error('AD_API_URL debe utilizar HTTPS y no incluir credenciales');
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
        directorioActivo: Object.freeze({
            url: urlAD.toString(),
            key: typeof entorno.AD_KEY === 'string' ? entorno.AD_KEY : '',
            sistema: typeof entorno.AD_SISTEMA === 'string' && entorno.AD_SISTEMA.trim()
                ? entorno.AD_SISTEMA.trim()
                : '1',
            timeoutMs: leerEntero(
                entorno,
                'AD_TIMEOUT_MS',
                10000,
                1000,
                30000
            )
        }),
        advertencias: Object.freeze(advertencias)
    });
};

module.exports = {
    obtenerConfiguracion
};
