import { extraerListaApi, solicitarApi } from './apiClient';

const RUTA_API = '/planes';

// ==========================================
// LISTAR PLANES
// ==========================================
export const listarPlanes = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudo completar la consulta de planes'
    });

    return extraerListaApi(
        resultado,
        'La respuesta no contiene una lista de planes'
    );
};
