const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Linter } = require('eslint');

const frontendDir = path.join(__dirname, '..');
const linter = new Linter();

const leerJsx = (archivo) => {
    const source = fs.readFileSync(archivo, 'utf8');
    const mensajes = linter.verify(source, [{
        files: ['**/*.jsx'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } }
        }
    }], { filename: path.basename(archivo) });

    assert.deepEqual(
        mensajes.filter((mensaje) => mensaje.fatal),
        [],
        `${path.basename(archivo)} contiene JSX inválido`
    );
    return source;
};

test('Configuración incluye una pestaña de usuarios para administradores', () => {
    const source = leerJsx(
        path.join(frontendDir, 'src/pages/ConfiguracionPage.jsx')
    );

    assert.match(source, /id: 'usuarios', nombre: 'Usuarios'/);
    assert.match(source, /<UsuariosPanel/);
    assert.match(source, /usuarioActual=\{usuarioActual\}/);
});

test('el panel permite alta, edición y restablecimiento sin mostrar hashes', () => {
    const source = leerJsx(
        path.join(frontendDir, 'src/pages/UsuariosPanel.jsx')
    );

    assert.match(source, /Registrar usuario/);
    assert.match(source, /Editar usuario/);
    assert.match(source, /Restablecer contraseña/);
    assert.match(source, /esCuentaActual/);
    assert.match(source, /sesion_actual_revocada/);
    assert.doesNotMatch(source, /clave_hash|token_hash/);
});

test('Equipos, colaboradores, líneas y asignaciones reciben soloLectura', () => {
    const app = leerJsx(path.join(frontendDir, 'src/App.jsx'));

    for (const componente of [
        'EquiposPage',
        'ColaboradoresPage',
        'LineasPage',
        'AsignacionesPage'
    ]) {
        assert.match(
            app,
            new RegExp(`<${componente} soloLectura=\\{esConsulta\\}`)
        );
    }
});

test('el modo consulta oculta todas las acciones de escritura disponibles', () => {
    const casos = [
        ['EquiposPage.jsx', 'Registrar equipo', 'Editar equipo'],
        ['ColaboradoresPage.jsx', 'Registrar colaborador', 'Editar colaborador'],
        ['LineasPage.jsx', 'Registrar línea', 'Editar línea'],
        ['AsignacionesPage.jsx', 'Nueva asignación', 'Registrar devolución']
    ];

    for (const [archivo, alta, cambio] of casos) {
        const source = leerJsx(path.join(frontendDir, 'src/pages', archivo));
        assert.match(source, /soloLectura = false/);

        for (const texto of [alta, cambio]) {
            const posicion = source.indexOf(texto);
            assert.notEqual(posicion, -1, `${archivo}: existe ${texto}`);
            const contexto = source.slice(Math.max(0, posicion - 900), posicion);
            assert.match(contexto, /!soloLectura/);
        }
    }
});

test('usuarioService conserva los cuatro contratos HTTP administrativos', async () => {
    const source = fs.readFileSync(
        path.join(frontendDir, 'src/services/usuarioService.js'),
        'utf8'
    );
    const peticiones = [];
    const servicioEjecutable = source.replace(
        /^import \{ obtenerApiUrl \} from '\.\/apiClient';\r?\n/m,
        ''
    );
    const api = vm.runInNewContext(
        `${servicioEjecutable.replace(/^export /gm, '')}\n({ listarUsuarios, registrarUsuario, actualizarUsuario, restablecerClaveUsuario });`,
        {
            obtenerApiUrl: (ruta = '') =>
                `http://localhost:3000/api/${String(ruta).replace(/^\/+/, '')}`,
            async fetch(url, opciones = {}) {
                peticiones.push({ url, opciones });
                return {
                    ok: true,
                    headers: { get: () => 'application/json' },
                    async json() {
                        return {
                            success: true,
                            data: opciones.method ? { id: 1 } : []
                        };
                    }
                };
            },
            Set
        }
    );

    await api.listarUsuarios();
    await api.registrarUsuario({ usuario: 'ana' });
    await api.actualizarUsuario(4, { rol: 'CONSULTA' });
    await api.restablecerClaveUsuario(4, 'NuevaClave2026');

    assert.deepEqual(
        peticiones.map((peticion) => [peticion.url, peticion.opciones.method || 'GET']),
        [
            ['http://localhost:3000/api/usuarios', 'GET'],
            ['http://localhost:3000/api/usuarios', 'POST'],
            ['http://localhost:3000/api/usuarios/4', 'PUT'],
            ['http://localhost:3000/api/usuarios/4/clave', 'PUT']
        ]
    );
});
