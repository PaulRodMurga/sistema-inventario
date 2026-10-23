const ROLES_USUARIO = Object.freeze([
    'ADMINISTRADOR',
    'OPERADOR',
    'CONSULTA'
]);

const ESTADOS_USUARIO = Object.freeze([
    'ACTIVO',
    'INACTIVO'
]);

const validarIdUsuario = (valor) => {
    const texto = String(valor ?? '');

    if (!/^[1-9]\d*$/.test(texto)) {
        return { valido: false, mensaje: 'El ID del usuario no es válido' };
    }

    const numero = Number(texto);

    if (!Number.isSafeInteger(numero) || numero > 4294967295) {
        return { valido: false, mensaje: 'El ID del usuario no es válido' };
    }

    return { valido: true, valor: numero };
};

const validarNombrePersona = (valor) => {
    if (typeof valor !== 'string') {
        return { valido: false, mensaje: 'El nombre debe ser texto' };
    }

    const nombre = valor.trim().replace(/\s+/g, ' ');

    if (!nombre || nombre.length > 120) {
        return {
            valido: false,
            mensaje: 'El nombre es obligatorio y admite hasta 120 caracteres'
        };
    }

    return { valido: true, valor: nombre };
};

const validarNombreCuenta = (valor) => {
    if (typeof valor !== 'string') {
        return { valido: false, mensaje: 'El usuario debe ser texto' };
    }

    const usuario = valor.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,60}$/.test(usuario)) {
        return {
            valido: false,
            mensaje: 'El usuario debe tener de 3 a 60 caracteres: letras, números, punto, guion o guion bajo'
        };
    }

    return { valido: true, valor: usuario };
};

const validarRolUsuario = (valor) => {
    if (typeof valor !== 'string') {
        return { valido: false, mensaje: 'El rol no es válido' };
    }

    const rol = valor.trim().toUpperCase();

    return ROLES_USUARIO.includes(rol)
        ? { valido: true, valor: rol }
        : { valido: false, mensaje: 'El rol no es válido' };
};

const validarEstadoUsuario = (valor) => {
    if (typeof valor !== 'string') {
        return { valido: false, mensaje: 'El estado no es válido' };
    }

    const estado = valor.trim().toUpperCase();

    return ESTADOS_USUARIO.includes(estado)
        ? { valido: true, valor: estado }
        : { valido: false, mensaje: 'El estado no es válido' };
};

const validarClaveSegura = (clave) => {
    if (typeof clave !== 'string' || clave.length < 10 || clave.length > 128) {
        return {
            valido: false,
            mensaje: 'La contraseña debe tener entre 10 y 128 caracteres'
        };
    }

    if (!/[a-z]/.test(clave) || !/[A-Z]/.test(clave) || !/\d/.test(clave)) {
        return {
            valido: false,
            mensaje: 'La contraseña debe incluir mayúscula, minúscula y número'
        };
    }

    return { valido: true, valor: clave };
};

module.exports = {
    ESTADOS_USUARIO,
    ROLES_USUARIO,
    validarClaveSegura,
    validarEstadoUsuario,
    validarIdUsuario,
    validarNombreCuenta,
    validarNombrePersona,
    validarRolUsuario
};
