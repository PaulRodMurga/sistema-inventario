import {
    API_BASE,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

export const obtenerPerfil = async () => {
    const resultado = await solicitarApi('/perfil', {
        mensajeError: 'No se pudo obtener el perfil'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió los datos del perfil'
    );
};

export const actualizarNombrePerfil = async (nombre) => {
    const resultado = await solicitarApi('/perfil', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nombre }),
        mensajeError: 'No se pudo actualizar el nombre'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió el perfil actualizado'
    );
};

export const actualizarFotoPerfil = async (archivo) => {
    const formulario = new FormData();
    formulario.append('foto', archivo);

    const resultado = await solicitarApi('/perfil/foto', {
        method: 'POST',
        body: formulario,
        mensajeError: 'No se pudo actualizar la foto de perfil'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió la foto de perfil actualizada'
    );
};

export const eliminarFotoPerfil = async () => {
    const resultado = await solicitarApi('/perfil/foto', {
        method: 'DELETE',
        mensajeError: 'No se pudo eliminar la foto de perfil'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió el perfil actualizado'
    );
};

export const actualizarClavePerfil = async (claveActual, claveNueva) => {
    return solicitarApi('/perfil/clave', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claveActual, claveNueva }),
        mensajeError: 'No se pudo actualizar la contraseña'
    });
};

export const obtenerUrlFotoPerfil = (ruta) => {
    if (typeof ruta !== 'string' || !ruta.trim()) return '';

    try {
        const origenApi = new URL(API_BASE, window.location.href).origin;
        return new URL(ruta, origenApi).toString();
    } catch {
        return '';
    }
};
