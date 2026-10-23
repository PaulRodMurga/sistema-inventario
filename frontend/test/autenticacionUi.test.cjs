const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Linter } = require('eslint');

const frontendDir = path.join(__dirname, '..');
const linter = new Linter();

const validarJsx = (ruta) => {
    const source = fs.readFileSync(ruta, 'utf8');
    const mensajes = linter.verify(source, [{
        files: ['**/*.jsx'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } }
        }
    }], { filename: path.basename(ruta) });

    assert.deepEqual(
        mensajes.filter((mensaje) => mensaje.fatal),
        [],
        `${path.basename(ruta)} contiene JSX inválido`
    );

    return source;
};

test('App exige una sesión y muestra la identidad real del usuario', () => {
    const source = validarJsx(path.join(frontendDir, 'src/App.jsx'));

    assert.match(source, /<LoginPage onAutenticado=/);
    assert.match(source, /obtenerSesionActual/);
    assert.match(source, /usuario\.nombre/);
    assert.match(source, /formatearRol\(usuario\.rol\)/);
    assert.match(source, /onCerrarSesion/);
    assert.match(source, /esAdministrador &&/);
});

test('Login usa autocompletado, contraseña oculta y errores accesibles', () => {
    const source = validarJsx(
        path.join(frontendDir, 'src/pages/LoginPage.jsx')
    );

    assert.match(source, /autoComplete="username"/);
    assert.match(source, /type="password"/);
    assert.match(source, /autoComplete="current-password"/);
    assert.match(source, /role="alert"/);
    assert.match(source, /disabled=\{cargando\}/);
});

test('el cliente HTTP adjunta Bearer solo a la API y borra sesiones vencidas', () => {
    const source = fs.readFileSync(
        path.join(frontendDir, 'src/services/apiClient.js'),
        'utf8'
    );

    assert.match(source, /perteneceALaApi/);
    assert.match(source, /Authorization/);
    assert.match(source, /Bearer/);
    assert.match(source, /respuesta\.status === 401/);
    assert.match(source, /sessionStorage/);
    assert.doesNotMatch(source, /localStorage/);
});
