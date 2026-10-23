import { extraerListaApi, solicitarApi } from './apiClient';

const RUTA_API = '/gamas';

export const listarGamas = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron obtener las gamas'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un listado de gamas válido'
    );
};

export const registrarGama = async (gama) => {
    return solicitarApi(RUTA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gama),
        mensajeError: 'No se pudo registrar la gama'
    });
};

export const actualizarGama = async (id, gama) => {
    return solicitarApi(`${RUTA_API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gama),
        mensajeError: 'No se pudo actualizar la gama'
    });
};

export const inhabilitarGama = async (id) => {
    return solicitarApi(`${RUTA_API}/${id}/inhabilitar`, {
        method: 'PUT',
        mensajeError: 'No se pudo inhabilitar la gama'
    });
};
