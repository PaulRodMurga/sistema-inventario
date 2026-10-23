import {
    extraerListaApi,
    extraerObjetoApi,
    solicitarApi
} from './apiClient';

const RUTA_API = '/asignaciones';

export const listarActasDisponibles = async (colaboradorId, equipoId) => {
    const idValido = (valor) => /^[1-9]\d*$/.test(String(valor)) &&
        Number.isSafeInteger(Number(valor)) && Number(valor) <= 2147483647;
    if (!idValido(colaboradorId) || !idValido(equipoId)) {
        throw new Error('Selecciona un colaborador y un equipo válidos');
    }
    const resultado = await solicitarApi(
        `${RUTA_API}/actas-disponibles?colaborador_id=${Number(colaboradorId)}&equipo_id=${Number(equipoId)}`,
        { mensajeError: 'No se pudieron consultar las actas disponibles' }
    );
    const actas = extraerListaApi(
        resultado,
        'La respuesta de actas disponibles no contiene un listado'
    );
    if (!Array.isArray(actas) || actas.some((acta) => !acta ||
        !idValido(acta.id) || !idValido(acta.detalle_id) ||
        Number(acta.colaborador_id) !== Number(colaboradorId) ||
        Number(acta.equipo_id) !== Number(equipoId) ||
        !['PENDIENTE', 'ACTIVA'].includes(acta.estado) ||
        typeof acta.fecha_entrega !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(acta.fecha_entrega)) ||
        new Set(actas.map((acta) => Number(acta.id))).size !== actas.length) {
        throw new Error('La respuesta de actas disponibles no corresponde a la selección');
    }
    return actas;
};

export const listarAsignaciones = async () => {
    const resultado = await solicitarApi(RUTA_API, {
        mensajeError: 'No se pudieron obtener las asignaciones'
    });

    return extraerListaApi(
        resultado,
        'La API no devolvió un listado de asignaciones válido'
    );
};

export const obtenerAsignacionPorId = async (id) => {
    const resultado = await solicitarApi(`${RUTA_API}/${id}`, {
        mensajeError: 'No se pudo obtener la asignación'
    });

    return extraerObjetoApi(
        resultado,
        'La API no devolvió un detalle de asignación válido'
    );
};

export const registrarAsignacion = async (asignacion) => {
    return solicitarApi(RUTA_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(asignacion),
        mensajeError: 'No se pudo registrar la asignación'
    });
};

export const devolverAsignacion = async (
    id,
    datosDevolucion
) => {
    return solicitarApi(
        `${RUTA_API}/${id}/devolver`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datosDevolucion),
            mensajeError: 'No se pudo registrar la devolución'
        }
    );
};

export const enviarActaPorCorreo = async (id, tipo, html) => {
    return solicitarApi(`${RUTA_API}/${id}/enviar-acta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, html }),
        mensajeError: 'No se pudo enviar el acta al correo del colaborador'
    });
};
