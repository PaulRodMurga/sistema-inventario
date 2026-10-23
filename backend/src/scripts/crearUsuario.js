require('dotenv').config();

const readline = require('node:readline');
const readlinePromises = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const pool = require('../config/database');
const { generarHashClave } = require('../utils/criptografia');
const {
    validarClaveSegura,
    validarNombreCuenta,
    validarNombrePersona,
    validarRolUsuario
} = require('../utils/validacionUsuario');

const leerSecreto = (mensaje) => new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
        reject(new Error(
            'La creación de usuarios requiere una terminal interactiva'
        ));
        return;
    }

    let valor = '';
    const estadoRawAnterior = stdin.isRaw;

    const limpiar = () => {
        stdin.off('keypress', recibirTecla);
        stdin.setRawMode(Boolean(estadoRawAnterior));
        stdin.pause();
    };

    const recibirTecla = (texto, tecla) => {
        if (tecla?.ctrl && tecla.name === 'c') {
            limpiar();
            stdout.write('\n');
            reject(new Error('Operación cancelada'));
            return;
        }

        if (tecla?.name === 'return' || tecla?.name === 'enter') {
            limpiar();
            stdout.write('\n');
            resolve(valor);
            return;
        }

        if (tecla?.name === 'backspace') {
            if (valor.length > 0) {
                valor = valor.slice(0, -1);
                stdout.write('\b \b');
            }
            return;
        }

        if (
            texto &&
            !tecla?.ctrl &&
            !tecla?.meta &&
            valor.length < 128
        ) {
            valor += texto;
            stdout.write('*');
        }
    };

    stdout.write(mensaje);
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('keypress', recibirTecla);
});

const ejecutar = async () => {
    const interfaz = readlinePromises.createInterface({
        input: stdin,
        output: stdout
    });

    stdout.write('\nCreación segura de usuario local\n\n');

    const nombreIngresado = await interfaz.question('Nombre completo: ');
    const usuarioIngresado = await interfaz.question('Usuario: ');
    const rolIngresado = await interfaz.question(
        'Rol [ADMINISTRADOR/OPERADOR/CONSULTA]: '
    );

    interfaz.close();

    const nombre = validarNombrePersona(nombreIngresado);
    const usuario = validarNombreCuenta(usuarioIngresado);
    const rol = validarRolUsuario(rolIngresado);

    for (const validacion of [nombre, usuario, rol]) {
        if (!validacion.valido) throw new Error(validacion.mensaje);
    }

    const clave = await leerSecreto('Contraseña: ');
    const claveValidada = validarClaveSegura(clave);

    if (!claveValidada.valido) throw new Error(claveValidada.mensaje);

    const confirmacion = await leerSecreto('Repite la contraseña: ');

    if (clave !== confirmacion) {
        throw new Error('Las contraseñas no coinciden');
    }

    const claveHash = await generarHashClave(clave);

    await pool.query(
        `
        INSERT INTO usuario (
            nombre,
            usuario,
            clave_hash,
            rol,
            estado
        )
        VALUES (?, ?, ?, ?, 'ACTIVO')
        `,
        [nombre.valor, usuario.valor, claveHash, rol.valor]
    );

    stdout.write(`\nUsuario ${usuario.valor} creado correctamente.\n`);
};

ejecutar()
    .catch((error) => {
        if (error?.code === 'ER_DUP_ENTRY') {
            console.error('\nYa existe una cuenta con ese usuario.');
        } else if (error?.code === 'ER_NO_SUCH_TABLE') {
            console.error(
                '\nPrimero ejecuta sql/013_autenticacion_local.sql en MySQL.'
            );
        } else {
            console.error(`\n${error.message}`);
        }

        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
