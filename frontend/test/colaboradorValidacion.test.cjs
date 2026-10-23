const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagesDir = process.env.INVENTARIO_PAGES_DIR ||
    path.join(__dirname, '../src/pages');
const source = fs.readFileSync(
    path.join(pagesDir, 'ColaboradoresPage.jsx'),
    'utf8'
);

const obtenerInput = (nombre) => {
    const coincidencia = source.match(
        new RegExp(`<input[\\s\\S]*?name="${nombre}"[\\s\\S]*?/>`)
    );

    assert.ok(coincidencia, `Existe el input ${nombre}`);
    return coincidencia[0];
};

test('el formulario limita código, apellidos y nombres como la base de datos', () => {
    assert.match(obtenerInput('codigo'), /maxLength="20"/);
    assert.match(obtenerInput('apellidos'), /maxLength="100"/);
    assert.match(obtenerInput('nombres'), /maxLength="100"/);
});

test('el DNI conserva formato textual y exige únicamente dígitos', () => {
    const input = obtenerInput('dni');

    assert.match(input, /type="text"/);
    assert.match(input, /inputMode="numeric"/);
    assert.match(input, /maxLength="15"/);
    assert.match(input, /pattern="\[0-9\]\+"/);
});

test('los cuatro datos de identidad siguen bloqueados durante la edición', () => {
    for (const campo of ['codigo', 'apellidos', 'nombres', 'dni']) {
        const input = obtenerInput(campo);

        assert.match(input, /modoFormulario === 'EDITAR'/);
    }
});
