import {
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

export const buscarGlobalmente = async (consulta) => {
    const parametros = new URLSearchParams({
        q: String(consulta || '').trim()
    });

    const resultado = await solicitarApi(`/busqueda?${parametros.toString()}`, {
        mensajeError: 'No se pudo realizar la búsqueda global'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió resultados de búsqueda válidos'
    );
};
