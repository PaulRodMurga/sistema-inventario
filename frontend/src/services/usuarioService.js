import { extraerListaApi, solicitarApi } from './apiClient';

const RUTA_API = '/usuarios';

export const listarUsuarios = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron obtener los usuarios'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió una lista de usuarios válida'
    );
};

export const registrarUsuario = async (usuario) => {
    return solicitarApi(RUTA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usuario),
        mensajeError: 'No se pudo registrar el usuario'
    });
};

export const actualizarUsuario = async (id, cambios) => {
    return solicitarApi(`${RUTA_API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
        mensajeError: 'No se pudo actualizar el usuario'
    });
};

export const restablecerClaveUsuario = async (id, clave) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}/clave`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
        mensajeError: 'No se pudo actualizar la contraseña'
    });

    return resultado.data || {};
};
