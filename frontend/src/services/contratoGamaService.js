import { extraerListaApi, solicitarApi } from './apiClient';

const RUTA_API = '/contrato-gamas';

export const listarContratoGamas = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron obtener los contratos y gamas'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió los contratos y gamas correctamente'
    );
};
