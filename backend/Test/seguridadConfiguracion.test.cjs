const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const backendDir = process.env.INVENTARIO_BACKEND_DIR ||
    path.join(__dirname, '..');
const projectDir = process.env.INVENTARIO_PROJECT_DIR ||
    path.join(backendDir, '..');

const {
    obtenerConfiguracion
} = require(path.join(backendDir, 'src/config/entorno.js'));
const {
    crearOpcionesCors,
    ocultarDetallesInternos,
    manejarErroresHttp
} = require(path.join(backendDir, 'src/middleware/seguridad.js'));

const entornoValido = (cambios = {}) => ({
    NODE_ENV: 'development',
    PORT: '3000',
    CORS_ORIGINS: 'http://localhost:5173',
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'inventario_app',
    DB_PASSWORD: 'clave-ficticia-para-pruebas',
    DB_NAME: 'gestion_equipos',
    DB_CONNECTION_LIMIT: '10',
    ...cambios
});

function respuesta() {
    return {
        statusCode: 200,
        body: undefined,
        headersSent: false,
        status(codigo) {
            this.statusCode = codigo;
            return this;
        },
        json(cuerpo) {
            this.body = JSON.parse(JSON.stringify(cuerpo));
            return this;
        }
    };
}

test('la configuración convierte puertos, límites y orígenes sin exponer la clave', () => {
    const configuracion = obtenerConfiguracion(entornoValido({
        NODE_ENV: ' production ',
        PORT: '3100',
        DB_PORT: '3307',
        DB_CONNECTION_LIMIT: '20',
        CORS_ORIGINS:
            'http://localhost:5173/, https://inventario.example.com'
    }));

    assert.equal(configuracion.servidor.modo, 'production');
    assert.equal(configuracion.servidor.esProduccion, true);
    assert.equal(configuracion.servidor.puerto, 3100);
    assert.deepEqual(
        [...configuracion.servidor.origenesCors],
        [
            'http://localhost:5173',
            'https://inventario.example.com'
        ]
    );
    assert.equal(configuracion.baseDatos.puerto, 3307);
    assert.equal(configuracion.baseDatos.limiteConexiones, 20);
    assert.equal(
        configuracion.baseDatos.clave,
        'clave-ficticia-para-pruebas'
    );
    assert.equal(configuracion.advertencias.length, 0);
});

test('la configuración usa valores locales seguros cuando son opcionales', () => {
    const entorno = entornoValido();
    delete entorno.NODE_ENV;
    delete entorno.PORT;
    delete entorno.CORS_ORIGINS;
    delete entorno.DB_CONNECTION_LIMIT;

    const configuracion = obtenerConfiguracion(entorno);

    assert.equal(configuracion.servidor.modo, 'development');
    assert.equal(configuracion.servidor.puerto, 3000);
    assert.deepEqual(
        [...configuracion.servidor.origenesCors],
        ['http://localhost:5173']
    );
    assert.equal(configuracion.baseDatos.limiteConexiones, 10);
});

for (const nombre of [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME'
]) {
    test(`la configuración falla rápido si falta ${nombre}`, () => {
        const entorno = entornoValido();
        delete entorno[nombre];

        assert.throws(
            () => obtenerConfiguracion(entorno),
            new RegExp(nombre)
        );
    });
}

for (const cambios of [
    { NODE_ENV: 'staging' },
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: '3000.5' },
    { DB_PORT: 'abc' },
    { DB_CONNECTION_LIMIT: '0' },
    { DB_CONNECTION_LIMIT: '101' },
    { CORS_ORIGINS: '' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'localhost:5173' },
    { CORS_ORIGINS: 'ftp://localhost:5173' },
    { CORS_ORIGINS: 'http://localhost:5173/api' }
]) {
    test(`la configuración rechaza ${JSON.stringify(cambios)}`, () => {
        assert.throws(
            () => obtenerConfiguracion(entornoValido(cambios))
        );
    });
}

test('los orígenes CORS repetidos se normalizan una sola vez', () => {
    const configuracion = obtenerConfiguracion(entornoValido({
        CORS_ORIGINS:
            'http://localhost:5173,http://localhost:5173/'
    }));

    assert.deepEqual(
        [...configuracion.servidor.origenesCors],
        ['http://localhost:5173']
    );
});

test('usar root genera advertencia sin impedir el arranque local', () => {
    const configuracion = obtenerConfiguracion(entornoValido({
        DB_USER: 'root'
    }));

    assert.equal(configuracion.advertencias.length, 1);
    assert.match(configuracion.advertencias[0], /cuenta MySQL exclusiva/i);
    assert.doesNotMatch(
        configuracion.advertencias[0],
        /clave-ficticia-para-pruebas/
    );
});

test('CORS admite únicamente los orígenes configurados', async () => {
    const opciones = crearOpcionesCors([
        'http://localhost:5173'
    ]);

    const comprobar = (origen) => new Promise((resolve) => {
        opciones.origin(origen, (error, permitido) => {
            resolve({ error, permitido });
        });
    });

    const permitido = await comprobar('http://localhost:5173');
    assert.equal(permitido.error, null);
    assert.equal(permitido.permitido, true);

    const sinOrigen = await comprobar(undefined);
    assert.equal(sinOrigen.error, null);
    assert.equal(sinOrigen.permitido, true);

    const rechazado = await comprobar('http://sitio-no-autorizado.test');
    assert.equal(rechazado.permitido, undefined);
    assert.equal(rechazado.error.code, 'CORS_ORIGIN_DENIED');
});

test('producción elimina detalles internos de respuestas 500', () => {
    const res = respuesta();
    res.statusCode = 500;
    let continuo = false;

    ocultarDetallesInternos(true)(
        {},
        res,
        () => { continuo = true; }
    );

    res.json({
        success: false,
        mensaje: 'Error controlado',
        error: 'contraseña o SQL interno',
        stack: 'traza interna',
        sql: 'SELECT secreto',
        sqlMessage: 'detalle MySQL'
    });

    assert.equal(continuo, true);
    assert.deepEqual(res.body, {
        success: false,
        mensaje: 'Error controlado'
    });
});

test('desarrollo conserva diagnósticos y producción oculta campos técnicos en errores 400', () => {
    const desarrollo = respuesta();
    desarrollo.statusCode = 500;
    ocultarDetallesInternos(false)({}, desarrollo, () => { });
    desarrollo.json({ mensaje: 'Error', error: 'detalle' });
    assert.equal(desarrollo.body.error, 'detalle');

    const validacion = respuesta();
    validacion.statusCode = 400;
    ocultarDetallesInternos(true)({}, validacion, () => { });
    validacion.json({
        success: false,
        mensaje: 'Dato inválido',
        error: 'detalle técnico',
        sqlMessage: 'Unknown column secret_column'
    });
    assert.deepEqual(validacion.body, {
        success: false,
        mensaje: 'Dato inválido'
    });
});

test('producción oculta campos SQL en errores 409 y conserva el mensaje funcional', () => {
    const conflicto = respuesta();
    conflicto.statusCode = 409;
    ocultarDetallesInternos(true)({}, conflicto, () => { });
    conflicto.json({
        success: false,
        mensaje: 'La serie ya está registrada',
        detalle: 'Revisa los datos e inténtalo nuevamente',
        sqlMessage: 'Duplicate entry secret value',
        stack: 'traza interna'
    });

    assert.deepEqual(conflicto.body, {
        success: false,
        mensaje: 'La serie ya está registrada',
        detalle: 'Duplicate entry in table equipo'
    });
});

test('el manejador devuelve JSON controlado para CORS, tamaño y JSON inválido', () => {
    const cors = respuesta();
    manejarErroresHttp(
        { code: 'CORS_ORIGIN_DENIED' },
        {},
        cors,
        () => { }
    );
    assert.equal(cors.statusCode, 403);
    assert.equal(cors.body.mensaje, 'Origen no permitido');

    const grande = respuesta();
    manejarErroresHttp(
        { type: 'entity.too.large' },
        {},
        grande,
        () => { }
    );
    assert.equal(grande.statusCode, 413);

    const errorJson = new SyntaxError('JSON inválido');
    errorJson.status = 400;
    errorJson.body = '{';
    const json = respuesta();
    manejarErroresHttp(errorJson, {}, json, () => { });
    assert.equal(json.statusCode, 400);
    assert.match(json.body.mensaje, /JSON no es válido/);
});

test('database usa exclusivamente la configuración validada del entorno', () => {
    const source = fs.readFileSync(
        path.join(backendDir, 'src/config/database.js'),
        'utf8'
    );
    let opcionesPool;
    const modulo = { exports: {} };

    vm.runInNewContext(source, {
        module: modulo,
        exports: modulo.exports,
        require(nombre) {
            if (nombre === 'mysql2/promise') {
                return {
                    createPool(opciones) {
                        opcionesPool = opciones;
                        return { nombre: 'pool-simulado' };
                    }
                };
            }
            if (nombre === './entorno') {
                return {
                    obtenerConfiguracion() {
                        return {
                            baseDatos: {
                                host: 'db-interno',
                                puerto: 3307,
                                usuario: 'inventario_app',
                                clave: 'secreto-simulado',
                                nombre: 'gestion_equipos',
                                limiteConexiones: 12
                            }
                        };
                    }
                };
            }
            throw new Error(`Módulo inesperado: ${nombre}`);
        }
    });

    assert.equal(modulo.exports.nombre, 'pool-simulado');
    assert.deepEqual(JSON.parse(JSON.stringify(opcionesPool)), {
        host: 'db-interno',
        port: 3307,
        user: 'inventario_app',
        password: 'secreto-simulado',
        database: 'gestion_equipos',
        waitForConnections: true,
        connectionLimit: 12,
        queueLimit: 0,
        enableKeepAlive: true
    });
});

test('el servidor aplica CORS restringido, límite JSON y respuestas finales JSON', () => {
    const source = fs.readFileSync(
        path.join(backendDir, 'src/server.js'),
        'utf8'
    );

    assert.match(source, /app\.disable\('x-powered-by'\)/);
    assert.match(source, /crearOpcionesCors/);
    assert.match(source, /limiteJson/);
    assert.match(source, /mensaje: 'Ruta no encontrada'/);
    assert.match(source, /app\.use\(manejarErroresHttp\)/);
    assert.doesNotMatch(source, /app\.use\(cors\(\)\)/);
    assert.doesNotMatch(
        source,
        /mensaje: 'No se pudo conectar a MySQL',[\s\S]*?error:/
    );
});

test('gitignore protege entornos y el ejemplo no contiene credenciales reales', () => {
    const gitignore = fs.readFileSync(
        path.join(projectDir, '.gitignore'),
        'utf8'
    );
    const ejemplo = fs.readFileSync(
        path.join(backendDir, '.env.example'),
        'utf8'
    );

    assert.match(gitignore, /\*\*\/\.env/);
    assert.match(gitignore, /!\*\*\/\.env\.example/);
    assert.match(gitignore, /\*\*\/node_modules\//);
    assert.match(ejemplo, /DB_USER=inventario_app/);
    assert.match(
        ejemplo,
        /DB_PASSWORD=CAMBIAR_POR_UNA_CLAVE_SEGURA/
    );
    assert.doesNotMatch(ejemplo, /DB_USER=root/);
});
