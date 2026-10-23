import { extraerListaApi, solicitarApi } from './apiClient';

const LIMITE_PREDETERMINADO = 100;
const LIMITE_MAXIMO = 200;

export const listarAuditoria = async (
    limite = LIMITE_PREDETERMINADO
) => {
    const cantidad = Number(limite);

    if (
        !Number.isSafeInteger(cantidad) ||
        cantidad < 1 ||
        cantidad > LIMITE_MAXIMO
    ) {
        throw new Error(
            `El límite debe ser un entero entre 1 y ${LIMITE_MAXIMO}`
        );
    }

    const resultado = await solicitarApi(
        `/auditoria?limite=${cantidad}`,
        { mensajeError: 'No se pudo consultar la auditoría' }
    );

    return extraerListaApi(
        resultado,
        'La API no devolvió una lista de auditoría válida'
    );
};

