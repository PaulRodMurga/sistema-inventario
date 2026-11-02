import { extraerObjetoApi, solicitarApi } from './apiClient';

export const obtenerReportes = async (filtros = {}) => {
    const query = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor));
    const resultado = await solicitarApi(`/reportes?${query.toString()}`, {
        mensajeError: 'No se pudieron obtener los reportes gerenciales'
    });
    return extraerObjetoApi(resultado, 'La API no devolvió reportes válidos');
};
