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

const {
    validarClaveSegura,
    validarEstadoUsuario,
    validarIdUsuario,
    validarNombreCuenta,
    validarNombrePersona,
    validarRolUsuario
} = require('../src/utils/validacionUsuario');
const {
    crearControladorUsuario
} = require('../src/controllers/usuarioController');

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

function conexionSimulada(responder) {
    const eventos = [];
    const conexion = {
        async beginTransaction() { eventos.push('BEGIN'); },
        async query(sql, parametros = []) {
            const consulta = {
                sql: sql.replace(/\s+/g, ' ').trim(),
                parametros: Array.from(parametros)
            };
            eventos.push(consulta);
            return responder(consulta);
        },
        async commit() { eventos.push('COMMIT'); },
        async rollback() { eventos.push('ROLLBACK'); },
        release() { eventos.push('RELEASE'); },
        destroy() { eventos.push('DESTROY'); }
    };
    return { conexion, eventos };
}

test('las validaciones normalizan identidad, rol y estado', () => {
    assert.deepEqual(
        validarNombrePersona('  Ana   Torres  '),
        { valido: true, valor: 'Ana Torres' }
    );
    assert.equal(validarNombreCuenta(' Admin.TI ').valor, 'admin.ti');
    assert.equal(validarRolUsuario(' operador ').valor, 'OPERADOR');
    assert.equal(validarEstadoUsuario(' activo ').valor, 'ACTIVO');
    assert.equal(validarIdUsuario('15').valor, 15);
});

test('la contraseña exige longitud, mayúscula, minúscula y número', () => {
    assert.equal(validarClaveSegura('ClaveSegura2026').valido, true);

    for (const clave of [
        'Corta1',
        'sinmayuscula2026',
        'SINMINUSCULA2026',
        'SinNumerosSegura',
        null
    ]) {
        assert.equal(validarClaveSegura(clave).valido, false);
    }
});

test('registrar usuario almacena el hash y normaliza los datos', async () => {
    const consultas = [];
    const controlador = crearControladorUsuario({
        baseDatos: {
            async query(sql, parametros) {
                consultas.push({ sql, parametros });
                return [{ insertId: 21 }];
            }
        },
        async crearHash(clave) {
            assert.equal(clave, 'ClaveSegura2026');
            return 'scrypt$hash-simulado';
        }
    });
    const res = respuesta();

    await controlador.registrarUsuario({
        body: {
            nombre: '  Ana   Torres ',
            usuario: ' ANA.TI ',
            clave: 'ClaveSegura2026',
            rol: 'operador'
        }
    }, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(consultas[0].parametros, [
        'Ana Torres',
        'ana.ti',
        'scrypt$hash-simulado',
        'OPERADOR',
        'ACTIVO'
    ]);
    assert.equal(JSON.stringify(consultas).includes('ClaveSegura2026'), false);
});

test('registro rechaza contraseña débil y campos desconocidos sin escribir', async () => {
    let consultas = 0;
    const controlador = crearControladorUsuario({
        baseDatos: { async query() { consultas += 1; } },
        async crearHash() { throw new Error('No debe crear hash'); }
    });

    for (const body of [
        {
            nombre: 'Ana', usuario: 'ana', clave: 'debil',
            rol: 'OPERADOR'
        },
        {
            nombre: 'Ana', usuario: 'ana', clave: 'ClaveSegura2026',
            rol: 'OPERADOR', administrador: true
        }
    ]) {
        const res = respuesta();
        await controlador.registrarUsuario({ body }, res);
        assert.equal(res.statusCode, 400);
    }

    assert.equal(consultas, 0);
});

test('un administrador no puede quitarse su propio acceso', async () => {
    const app = conexionSimulada((consulta) => {
        if (/SELECT id, rol, estado/.test(consulta.sql)) {
            return [[{ id: 1, rol: 'ADMINISTRADOR', estado: 'ACTIVO' }]];
        }
        throw new Error(`Consulta inesperada: ${consulta.sql}`);
    });
    const controlador = crearControladorUsuario({
        baseDatos: { async getConnection() { return app.conexion; } }
    });
    const res = respuesta();

    await controlador.actualizarUsuario({
        params: { id: '1' },
        usuario: { id: 1, rol: 'ADMINISTRADOR' },
        body: { rol: 'OPERADOR' }
    }, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.mensaje, /propio acceso/i);
    assert.deepEqual(
        app.eventos.filter((evento) => typeof evento === 'string'),
        ['BEGIN', 'ROLLBACK', 'RELEASE']
    );
});

test('el sistema conserva al menos un administrador activo', async () => {
    const app = conexionSimulada((consulta) => {
        if (/SELECT id, rol, estado/.test(consulta.sql)) {
            return [[{ id: 2, rol: 'ADMINISTRADOR', estado: 'ACTIVO' }]];
        }
        if (/SELECT COUNT\(\*\)/.test(consulta.sql)) {
            return [[{ cantidad: 1 }]];
        }
        throw new Error(`Consulta inesperada: ${consulta.sql}`);
    });
    const controlador = crearControladorUsuario({
        baseDatos: { async getConnection() { return app.conexion; } }
    });
    const res = respuesta();

    await controlador.actualizarUsuario({
        params: { id: '2' },
        usuario: { id: 1, rol: 'ADMINISTRADOR' },
        body: { estado: 'INACTIVO' }
    }, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.mensaje, /al menos un administrador/i);
    assert.equal(
        app.eventos.some((evento) =>
            typeof evento === 'object' && /^UPDATE usuario/.test(evento.sql)
        ),
        false
    );
});

test('cambiar rol revoca sesiones y confirma todo en una transacción', async () => {
    const app = conexionSimulada((consulta) => {
        if (/SELECT id, rol, estado/.test(consulta.sql)) {
            return [[{ id: 8, rol: 'OPERADOR', estado: 'ACTIVO' }]];
        }
        if (/^UPDATE usuario/.test(consulta.sql)) return [{ affectedRows: 1 }];
        if (/^DELETE FROM sesion_usuario/.test(consulta.sql)) {
            return [{ affectedRows: 1 }];
        }
        throw new Error(`Consulta inesperada: ${consulta.sql}`);
    });
    const controlador = crearControladorUsuario({
        baseDatos: { async getConnection() { return app.conexion; } }
    });
    const res = respuesta();

    await controlador.actualizarUsuario({
        params: { id: '8' },
        usuario: { id: 1, rol: 'ADMINISTRADOR' },
        body: { nombre: 'Usuario Consulta', rol: 'CONSULTA' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(
        app.eventos.some((evento) =>
            typeof evento === 'object' &&
            /^DELETE FROM sesion_usuario/.test(evento.sql)
        ),
        true
    );
    assert.deepEqual(
        app.eventos.filter((evento) => typeof evento === 'string'),
        ['BEGIN', 'COMMIT', 'RELEASE']
    );
});

test('cambiar solo el nombre conserva la sesión del usuario', async () => {
    const app = conexionSimulada((consulta) => {
        if (/SELECT id, rol, estado/.test(consulta.sql)) {
            return [[{ id: 8, rol: 'OPERADOR', estado: 'ACTIVO' }]];
        }
        if (/^UPDATE usuario/.test(consulta.sql)) return [{ affectedRows: 1 }];
        throw new Error(`Consulta inesperada: ${consulta.sql}`);
    });
    const controlador = crearControladorUsuario({
        baseDatos: { async getConnection() { return app.conexion; } }
    });
    const res = respuesta();

    await controlador.actualizarUsuario({
        params: { id: '8' },
        usuario: { id: 1 },
        body: { nombre: 'Nombre Nuevo' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(
        app.eventos.some((evento) =>
            typeof evento === 'object' && /DELETE FROM sesion_usuario/.test(evento.sql)
        ),
        false
    );
});

test('restablecer contraseña revoca sesiones y avisa si era la cuenta actual', async () => {
    const app = conexionSimulada((consulta) => {
        if (/^UPDATE usuario/.test(consulta.sql)) return [{ affectedRows: 1 }];
        if (/^DELETE FROM sesion_usuario/.test(consulta.sql)) {
            return [{ affectedRows: 2 }];
        }
        throw new Error(`Consulta inesperada: ${consulta.sql}`);
    });
    const controlador = crearControladorUsuario({
        baseDatos: { async getConnection() { return app.conexion; } },
        async crearHash() { return 'scrypt$nuevo-hash'; }
    });
    const res = respuesta();

    await controlador.restablecerClave({
        params: { id: '3' },
        usuario: { id: 3, rol: 'ADMINISTRADOR' },
        body: { clave: 'NuevaClave2026' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.sesion_actual_revocada, true);
    assert.deepEqual(
        app.eventos.filter((evento) => typeof evento === 'string'),
        ['BEGIN', 'COMMIT', 'RELEASE']
    );
});

test('el listado no selecciona hashes ni tokens', async () => {
    const consultas = [];
    const controlador = crearControladorUsuario({
        baseDatos: {
            async query(sql) {
                consultas.push(sql);
                return [[{
                    id: 1,
                    nombre: 'Admin',
                    usuario: 'admin',
                    rol: 'ADMINISTRADOR',
                    estado: 'ACTIVO'
                }]];
            }
        }
    });
    const res = respuesta();

    await controlador.listarUsuarios({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.cantidad, 1);
    assert.doesNotMatch(consultas[0], /clave_hash|token_hash/);
});

test('la ruta administrativa exige explícitamente rol ADMINISTRADOR', () => {
    const servidor = fs.readFileSync(
        path.join(__dirname, '../src/server.js'),
        'utf8'
    );
    const rutas = fs.readFileSync(
        path.join(__dirname, '../src/routes/usuarioRoutes.js'),
        'utf8'
    );

    assert.match(
        servidor,
        /'\/api\/usuarios',[\s\S]*?requiereAutenticacion,[\s\S]*?permitirRoles\('ADMINISTRADOR'\)/
    );
    assert.match(rutas, /router\.put\('\/:id\/clave', restablecerClave\)/);
    assert.match(rutas, /router\.put\('\/:id', actualizarUsuario\)/);
});
