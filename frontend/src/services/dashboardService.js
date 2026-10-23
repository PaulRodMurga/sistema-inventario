import { extraerObjetoApi, solicitarApi } from './apiClient';

export const obtenerDashboard = async () => {
    const resultado = await solicitarApi('/dashboard', {
        mensajeError: 'No se pudo obtener el dashboard'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió un dashboard válido'
    );
};
