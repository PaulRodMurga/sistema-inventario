const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'inventario_pruebas',
    DB_PASSWORD: 'clave-simulada',
    DB_NAME: 'gestion_equipos_pruebas'
});

const backendDir = path.join(__dirname, '..');
const {
    crearTokenSesion,
    generarHashClave,
    hashearToken,
    verificarClave
} = require('../src/utils/criptografia');
const {
    crearMiddlewareAutenticacion,
    extraerToken,
    permitirMutaciones,
    permitirRoles
} = require('../src/middleware/autenticacion');
const {
    crearControladorAutenticacion
} = require('../src/controllers/authController');

function respuesta() {
    return {
        statusCode: 200,
        body: undefined,
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

test('scrypt genera hashes distintos y verifica únicamente la clave correcta', async () => {
    const primero = await generarHashClave('ClaveSegura2026');
    const segundo = await generarHashClave('ClaveSegura2026');

    assert.match(primero, /^scrypt\$/);
    assert.notEqual(primero, segundo);
    assert.doesNotMatch(primero, /ClaveSegura2026/);
    assert.equal(await verificarClave('ClaveSegura2026', primero), true);
    assert.equal(await verificarClave('ClaveIncorrecta1', primero), false);
    assert.equal(await verificarClave('ClaveSegura2026', 'hash-invalido'), false);
});

test('los tokens son aleatorios, no se guardan directamente y tienen formato Bearer', () => {
    const primero = crearTokenSesion();
    const segundo = crearTokenSesion();

    assert.match(primero, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(primero, segundo);
    assert.match(hashearToken(primero), /^[a-f0-9]{64}$/);
    assert.notEqual(hashearToken(primero), primero);
    assert.equal(extraerToken(`Bearer ${primero}`), primero);
    assert.equal(extraerToken(`Basic ${primero}`), null);
    assert.equal(extraerToken('Bearer corto'), null);
});

test('una sesión válida adjunta un usuario mínimo a la solicitud', async () => {
    const token = 'a'.repeat(43);
    const consultas = [];
    const middleware = crearMiddlewareAutenticacion({
        async query(sql, parametros) {
            consultas.push({ sql, parametros });
            return [[{
                id: 7,
                nombre: 'Usuario Prueba',
                usuario: 'prueba',
                rol: 'OPERADOR'
            }]];
        }
    });
    const req = {
        get(nombre) {
            return nombre === 'authorization' ? `Bearer ${token}` : undefined;
        }
    };
    const res = respuesta();
    let continuo = false;

    await middleware(req, res, () => { continuo = true; });

    assert.equal(continuo, true);
    assert.deepEqual(req.usuario, {
        id: 7,
        nombre: 'Usuario Prueba',
        usuario: 'prueba',
        rol: 'OPERADOR'
    });
    assert.deepEqual(consultas[0].parametros, [hashearToken(token)]);
    assert.doesNotMatch(consultas[0].sql, new RegExp(token));
});

test('una solicitud sin token o con sesión vencida recibe 401', async () => {
    const sinToken = respuesta();
    await crearMiddlewareAutenticacion({
        async query() {
            throw new Error('No debe consultar la base de datos');
        }
    })({ get() { } }, sinToken, () => { });
    assert.equal(sinToken.statusCode, 401);

    const vencida = respuesta();
    await crearMiddlewareAutenticacion({
        async query() { return [[]]; }
    })({
        get() { return `Bearer ${'b'.repeat(43)}`; }
    }, vencida, () => { });
    assert.equal(vencida.statusCode, 401);
});

test('los permisos distinguen administración, operación y consulta', () => {
    const soloAdmin = permitirRoles('ADMINISTRADOR');
    const denegada = respuesta();
    soloAdmin(
        { usuario: { rol: 'OPERADOR' } },
        denegada,
        () => assert.fail('No debe permitir el acceso')
    );
    assert.equal(denegada.statusCode, 403);

    const escritura = permitirMutaciones('ADMINISTRADOR', 'OPERADOR');
    let lecturas = 0;
    escritura(
        { method: 'GET', usuario: { rol: 'CONSULTA' } },
        respuesta(),
        () => { lecturas += 1; }
    );
    assert.equal(lecturas, 1);

    const mutacion = respuesta();
    escritura(
        { method: 'POST', usuario: { rol: 'CONSULTA' } },
        mutacion,
        () => assert.fail('Consulta no puede escribir')
    );
    assert.equal(mutacion.statusCode, 403);
});

test('login correcto reemplaza la sesión anterior y nunca devuelve el hash', async () => {
    const consultasConexion = [];
    const cuenta = {
        id: 4,
        nombre: 'Administradora',
        usuario: 'admin',
        clave_hash: 'hash-simulado',
        rol: 'ADMINISTRADOR',
        estado: 'ACTIVO',
        intentos_fallidos: 0,
        bloqueado_hasta: null
    };
    const conexion = {
        async beginTransaction() { consultasConexion.push('BEGIN'); },
        async query(sql, parametros) {
            consultasConexion.push({ sql, parametros });
            return [{}];
        },
        async commit() { consultasConexion.push('COMMIT'); },
        async rollback() { consultasConexion.push('ROLLBACK'); },
        release() { consultasConexion.push('RELEASE'); }
    };
    const controlador = crearControladorAutenticacion({
        baseDatos: {
            async query() { return [[cuenta]]; },
            async getConnection() { return conexion; }
        },
        configuracion: {
            duracionSesionHoras: 8,
            maxIntentos: 5,
            minutosBloqueo: 15
        },
        criptografia: {
            async obtenerHashFicticio() { return 'ficticio'; },
            async verificarClave(clave, hash) {
                return clave === 'ClaveCorrecta1' && hash === 'hash-simulado';
            },
            crearTokenSesion() { return 't'.repeat(43); },
            hashearToken() { return 'h'.repeat(64); }
        }
    });
    const res = respuesta();

    await controlador.iniciarSesion({
        body: { usuario: ' ADMIN ', clave: 'ClaveCorrecta1' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.token, 't'.repeat(43));
    assert.equal(res.body.data.usuario.rol, 'ADMINISTRADOR');
    assert.equal(JSON.stringify(res.body).includes('hash-simulado'), false);
    assert.equal(
        consultasConexion.some((entrada) =>
            typeof entrada === 'object' &&
            /DELETE FROM sesion_usuario/.test(entrada.sql)
        ),
        true
    );
    assert.deepEqual(
        consultasConexion.filter((entrada) => typeof entrada === 'string'),
        ['BEGIN', 'COMMIT', 'RELEASE']
    );
});

test('una contraseña incorrecta aumenta intentos y no crea sesión', async () => {
    const consultas = [];
    const controlador = crearControladorAutenticacion({
        baseDatos: {
            async query(sql, parametros) {
                consultas.push({ sql, parametros });
                if (/^\s*SELECT/.test(sql)) {
                    return [[{
                        id: 9,
                        nombre: 'Operador',
                        usuario: 'operador',
                        clave_hash: 'hash',
                        rol: 'OPERADOR',
                        estado: 'ACTIVO',
                        intentos_fallidos: 4,
                        bloqueado_hasta: null
                    }]];
                }
                return [{ affectedRows: 1 }];
            },
            async getConnection() {
                assert.fail('No debe crear una sesión');
            }
        },
        configuracion: {
            duracionSesionHoras: 8,
            maxIntentos: 5,
            minutosBloqueo: 15
        },
        criptografia: {
            async obtenerHashFicticio() { return 'ficticio'; },
            async verificarClave() { return false; },
            crearTokenSesion() { return 'x'; },
            hashearToken() { return 'x'; }
        }
    });
    const res = respuesta();

    await controlador.iniciarSesion({
        body: { usuario: 'operador', clave: 'Incorrecta1' }
    }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(consultas.length, 2);
    assert.deepEqual(consultas[1].parametros, [5, 5, 5, 15, 9]);
});

test('la migración y el servidor declaran la protección completa', () => {
    const migracion = fs.readFileSync(
        path.join(backendDir, 'sql/013_autenticacion_local.sql'),
        'utf8'
    );
    const servidor = fs.readFileSync(
        path.join(backendDir, 'src/server.js'),
        'utf8'
    );

    assert.match(migracion, /CREATE TABLE IF NOT EXISTS usuario/);
    assert.match(migracion, /CREATE TABLE IF NOT EXISTS sesion_usuario/);
    assert.match(migracion, /FOREIGN KEY \(usuario_id\)/);
    assert.match(servidor, /app\.use\('\/api\/auth', authRoutes\)/);
    assert.match(servidor, /requiereAutenticacion/);
    assert.match(servidor, /accesoOperativo/);
    assert.match(servidor, /accesoConfiguracion/);
});
