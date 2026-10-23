import {
    extraerListaApi,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

const RUTA_API = '/lineas';

export const listarLineas = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron obtener las líneas'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un listado de líneas válido'
    );
};

export const obtenerLineaPorId = async (id) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}`, {
        mensajeError: 'No se pudo obtener la línea'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió un detalle de línea válido'
    );
};

export const registrarLinea = async (linea) => {
    return solicitarApi(RUTA_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(linea),
        mensajeError: 'No se pudo registrar la línea'
    });
};

export const actualizarLinea = async (id, linea) => {
    return solicitarApi(`${RUTA_API}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(linea),
        mensajeError: 'No se pudo actualizar la línea'
    });
};

export const obtenerCatalogosLinea = async () => {
    const [resultadoPlanes, resultadoEquipos] =
        await Promise.all([
            solicitarApi('/planes', {
                mensajeError: 'No se pudieron cargar los planes'
            }),
            solicitarApi('/equipos', {
                mensajeError: 'No se pudieron cargar los equipos'
            })
        ]);

    return {
        planes: extraerListaApi(
            resultadoPlanes,
            'La API no devolvió un listado de planes válido'
        ),
        equipos: extraerListaApi(
            resultadoEquipos,
            'La API no devolvió un listado de equipos válido'
        )
    };
};
