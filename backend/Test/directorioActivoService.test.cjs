const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ErrorDirectorioActivo,
    validarCuentaDirectorioActivo
} = require('../src/services/directorioActivoService');

const configuracion = {
    url: 'https://sap30003.distriluz.com.pe:60000/ActiveDirectory/Api/ActiveDirectory/ValidarDato',
    key: 'key-de-prueba',
    sistema: '1',
    timeoutMs: 10000
};

const respuestaAD = (sobreEscritura = {}) => ({
    ok: true,
    json: async () => ({
        getAuth: {
            resultAuth: true,
            codResult: 'A000',
            desResult: 'OK'
        },
        getUser: {
            CargaUsuario: {
                codigo: 'usuario.prueba',
                activo: true
            }
        },
        ...sobreEscritura
    })
});

test('envía las credenciales y los parámetros requeridos al servicio AD', async (t) => {
    const fetchOriginal = global.fetch;
    t.after(() => {
        global.fetch = fetchOriginal;
    });

    let solicitud;
    global.fetch = async (url, opciones) => {
        solicitud = { url: String(url), opciones };
        return respuestaAD();
    };

    const resultado = await validarCuentaDirectorioActivo(
        'usuario.prueba',
        'clave-prueba',
        configuracion
    );

    assert.equal(resultado, true);
    assert.equal(solicitud.url, configuracion.url);
    assert.equal(solicitud.opciones.method, 'POST');
    assert.deepEqual(JSON.parse(solicitud.opciones.body), {
        ADUser: 'usuario.prueba',
        ADPassword: 'clave-prueba',
        Sistema: '1',
        Key: 'key-de-prueba'
    });
});

test('rechaza credenciales cuando AD informa autenticación fallida', async (t) => {
    const fetchOriginal = global.fetch;
    t.after(() => {
        global.fetch = fetchOriginal;
    });

    global.fetch = async () => ({
        ok: true,
        json: async () => ({
            getAuth: {
                resultAuth: false,
                codResult: 'A001',
                desResult: 'Credenciales inválidas'
            },
            getUser: {
                CargaUsuario: {
                    codigo: 'usuario.prueba',
                    activo: true
                }
            }
        })
    });

    const resultado = await validarCuentaDirectorioActivo(
        'usuario.prueba',
        'clave-incorrecta',
        configuracion
    );

    assert.equal(resultado, false);
});

test('rechaza una cuenta AD inactiva o cuyo código no coincide', async (t) => {
    const fetchOriginal = global.fetch;
    t.after(() => {
        global.fetch = fetchOriginal;
    });

    global.fetch = async () => respuestaAD({
        getUser: {
            CargaUsuario: {
                codigo: 'otro.usuario',
                activo: false
            }
        }
    });

    const resultado = await validarCuentaDirectorioActivo(
        'usuario.prueba',
        'clave-prueba',
        configuracion
    );

    assert.equal(resultado, false);
});

test('no realiza la solicitud si falta la Key institucional', async () => {
    await assert.rejects(
        validarCuentaDirectorioActivo('usuario.prueba', 'clave', {
            ...configuracion,
            key: ''
        }),
        (error) => error instanceof ErrorDirectorioActivo &&
            error.estadoHttp === 503
    );
});

test('informa indisponibilidad cuando el servicio AD no responde', async (t) => {
    const fetchOriginal = global.fetch;
    t.after(() => {
        global.fetch = fetchOriginal;
    });

    global.fetch = async () => {
        throw new Error('Error de conexión simulado');
    };

    await assert.rejects(
        validarCuentaDirectorioActivo(
            'usuario.prueba',
            'clave-prueba',
            configuracion
        ),
        (error) => error instanceof ErrorDirectorioActivo &&
            error.estadoHttp === 502
    );
});
