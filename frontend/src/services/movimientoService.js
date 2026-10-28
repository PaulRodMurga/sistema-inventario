import {
    extraerListaApi,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

const RUTA_API = '/movimientos';

export const listarMovimientos = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron cargar los movimientos'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un listado de movimientos válido'
    );
};

export const obtenerMovimientoPorId = async (id) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}`, {
        mensajeError: 'No se pudo obtener el movimiento'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió un detalle de movimiento válido'
    );
};


export const listarMovimientosPorEquipo = async (equipoId) => {
    const resultado = await solicitarApi(
        `${RUTA_API}/equipo/${encodeURIComponent(equipoId)}`,
        {
            mensajeError: 'No se pudo cargar el historial del equipo'
        }
    );

    return extraerListaApi(
        resultado,
        'La API no devolvió un historial válido para el equipo'
    );
};
