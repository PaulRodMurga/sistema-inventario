const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

const PARAMETROS_SCRYPT = Object.freeze({
    N: 16384,
    r: 8,
    p: 1,
    longitud: 64,
    maxmem: 64 * 1024 * 1024
});

const SAL_FICTICIA = Buffer.from(
    '8ad944f631e95c77892583a5a0e8ab32',
    'hex'
);

const derivarClave = async (clave, sal, parametros) => scrypt(
    clave,
    sal,
    parametros.longitud,
    {
        N: parametros.N,
        r: parametros.r,
        p: parametros.p,
        maxmem: parametros.maxmem
    }
);

const codificarHash = (parametros, sal, derivada) => [
    'scrypt',
    parametros.N,
    parametros.r,
    parametros.p,
    sal.toString('hex'),
    derivada.toString('hex')
].join('$');

const generarHashClave = async (clave) => {
    if (typeof clave !== 'string' || clave.length < 10 || clave.length > 128) {
        throw new Error(
            'La contraseña debe tener entre 10 y 128 caracteres'
        );
    }

    const sal = crypto.randomBytes(16);
    const derivada = await derivarClave(
        clave,
        sal,
        PARAMETROS_SCRYPT
    );

    return codificarHash(PARAMETROS_SCRYPT, sal, derivada);
};

const interpretarHash = (hashAlmacenado) => {
    if (typeof hashAlmacenado !== 'string') return null;

    const partes = hashAlmacenado.split('$');

    if (partes.length !== 6 || partes[0] !== 'scrypt') return null;

    const [N, r, p] = partes.slice(1, 4).map(Number);
    const sal = Buffer.from(partes[4], 'hex');
    const derivada = Buffer.from(partes[5], 'hex');

    if (
        !Number.isSafeInteger(N) || N < 2 ||
        !Number.isSafeInteger(r) || r < 1 ||
        !Number.isSafeInteger(p) || p < 1 ||
        sal.length < 16 || derivada.length < 32
    ) {
        return null;
    }

    return {
        N,
        r,
        p,
        longitud: derivada.length,
        maxmem: Math.max(64 * 1024 * 1024, 128 * N * r + 1024),
        sal,
        derivada
    };
};

const verificarClave = async (clave, hashAlmacenado) => {
    const parametros = interpretarHash(hashAlmacenado);

    if (typeof clave !== 'string' || !parametros) return false;

    const calculada = await derivarClave(
        clave,
        parametros.sal,
        parametros
    );

    return calculada.length === parametros.derivada.length &&
        crypto.timingSafeEqual(calculada, parametros.derivada);
};

let hashFicticio;

const obtenerHashFicticio = async () => {
    if (!hashFicticio) {
        const derivada = await derivarClave(
            'comparacion-interna-no-utilizable',
            SAL_FICTICIA,
            PARAMETROS_SCRYPT
        );

        hashFicticio = codificarHash(
            PARAMETROS_SCRYPT,
            SAL_FICTICIA,
            derivada
        );
    }

    return hashFicticio;
};

const crearTokenSesion = () =>
    crypto.randomBytes(32).toString('base64url');

const hashearToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
    crearTokenSesion,
    generarHashClave,
    hashearToken,
    obtenerHashFicticio,
    verificarClave
};
