import {
    eliminarTokenSesion,
    extraerObjetoApi,
    guardarTokenSesion,
    obtenerTokenSesion,
    solicitarApi
} from './apiClient';

const ROLES_VALIDOS = new Set([
    'ADMINISTRADOR',
    'OPERADOR',
    'CONSULTA'
]);

const validarUsuario = (usuario) => {
    if (
        !usuario ||
        !Number.isSafeInteger(Number(usuario.id)) ||
        Number(usuario.id) < 1 ||
        typeof usuario.nombre !== 'string' ||
        !usuario.nombre.trim() ||
        typeof usuario.usuario !== 'string' ||
        !usuario.usuario.trim() ||
        !ROLES_VALIDOS.has(usuario.rol)
    ) {
        throw new Error('La API no devolvió un usuario válido');
    }

    return {
        id: Number(usuario.id),
        nombre: usuario.nombre.trim(),
        usuario: usuario.usuario.trim(),
        rol: usuario.rol
    };
};

export const hayTokenSesion = () => Boolean(obtenerTokenSesion());

export const iniciarSesion = async (usuario, clave) => {
    eliminarTokenSesion();

    const resultado = await solicitarApi('/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usuario, clave }),
        mensajeError: 'No se pudo iniciar sesión'
    });
    const datos = extraerObjetoApi(
        resultado,
        'La API no devolvió los datos de la sesión'
    );

    const usuarioValidado = validarUsuario(datos?.usuario);
    guardarTokenSesion(datos?.token);

    return usuarioValidado;
};

export const obtenerSesionActual = async () => {
    const resultado = await solicitarApi('/auth/sesion', {
        mensajeError: 'No se pudo comprobar la sesión'
    });

    const datos = extraerObjetoApi(
        resultado,
        'La API no devolvió los datos de la sesión'
    );

    return validarUsuario(datos.usuario);
};

export const cerrarSesion = async () => {
    try {
        if (hayTokenSesion()) {
            await solicitarApi('/auth/logout', {
                method: 'POST',
                mensajeError: 'No se pudo cerrar la sesión en el servidor'
            });
        }
    } finally {
        eliminarTokenSesion();
    }
};
