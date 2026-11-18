export const TIPOS_PERIFERICO = [
    'MONITOR',
    'TECLADO',
    'MOUSE',
    'PARLANTES',
    'CAMARA WEB',
    'AUDIFONOS'
];

export const TIPOS_PERIFERICO_OBLIGATORIOS_COMPUTADOR = [
    'MONITOR',
    'TECLADO',
    'MOUSE'
];

export function leerEspecificaciones(valor) {
    if (!valor) return {};
    if (typeof valor === 'object' && !Array.isArray(valor)) return valor;

    try {
        const resultado = JSON.parse(valor);
        return resultado && typeof resultado === 'object' &&
            !Array.isArray(resultado)
            ? resultado
            : {};
    } catch {
        return {};
    }
}

export function prepararEspecificaciones(definicion, valores, porUnidad = null) {
    const salida = {};

    for (const campo of definicion?.campos || []) {
        if (porUnidad !== null && campo.por_unidad !== porUnidad) continue;

        const original = valores?.[campo.clave];
        if (original === '' || original === null || original === undefined) {
            continue;
        }

        if (campo.tipo === 'number') {
            const numero = Number(original);

            if (
                !Number.isFinite(numero) ||
                numero < campo.min ||
                numero > campo.max ||
                (campo.entero && !Number.isInteger(numero))
            ) {
                return {
                    error: `${campo.etiqueta} no tiene un valor válido`
                };
            }

            salida[campo.clave] = numero;
        } else {
            const valor = String(original).trim();

            if (!valor) continue;

            if (campo.opciones && !campo.opciones.includes(valor)) {
                return {
                    error: `${campo.etiqueta} no tiene una opción válida`
                };
            }

            if (campo.max_length && valor.length > campo.max_length) {
                return {
                    error: `${campo.etiqueta} supera ${campo.max_length} caracteres`
                };
            }

            if (
                campo.formato === 'mac' &&
                !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(valor)
            ) {
                return {
                    error: `${campo.etiqueta} debe usar el formato AA:BB:CC:DD:EE:FF`
                };
            }

            salida[campo.clave] = valor;
        }
    }

    return { valor: salida };
}

export function prepararPerifericos(catalogo, valores, tipoPrincipal = '') {
    const perifericos = [];

    for (const tipo of TIPOS_PERIFERICO) {
        const entradas = Array.isArray(valores?.[tipo])
            ? valores[tipo]
            : (valores?.[tipo] ? [valores[tipo]] : []);

        for (const periferico of entradas) {
            if (!periferico?.habilitado) continue;

            if (!periferico.marca.trim() || !periferico.modelo.trim()) {
                return {
                    error: `Marca y modelo son obligatorios para el ${tipo}`
                };
            }

            if (
                !periferico.codigo_patrimonial.trim() &&
                !periferico.serie.trim()
            ) {
                return {
                    error: `Indica la serie o el código patrimonial del ${tipo}`
                };
            }

            const definicion = catalogo.find(({ codigo }) => codigo === tipo);
            const especificaciones = definicion
                ? prepararEspecificaciones(
                    definicion,
                    periferico.especificaciones
                )
                : { valor: {} };

            if (especificaciones.error) {
                return { error: `${tipo}: ${especificaciones.error}` };
            }

            perifericos.push({
                tipo,
                marca: periferico.marca.trim(),
                modelo: periferico.modelo.trim(),
                codigo_patrimonial:
                    periferico.codigo_patrimonial.trim() || null,
                serie: periferico.serie.trim() || null,
                observaciones: periferico.observaciones.trim() || null,
                especificaciones: especificaciones.valor
            });
        }
    }

    if (String(tipoPrincipal || '').trim().toUpperCase() === 'COMPUTADOR') {
        const tiposIncluidos = new Set(perifericos.map(({ tipo }) => tipo));
        const faltantes = TIPOS_PERIFERICO_OBLIGATORIOS_COMPUTADOR.filter(
            (tipo) => !tiposIncluidos.has(tipo)
        );

        if (faltantes.length > 0) {
            return {
                error: `Para registrar un COMPUTADOR debes agregar ${faltantes.join(', ')}`
            };
        }
    }

    return { valor: perifericos };
}

export function mostrarValorEspecificacion(campo, valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    return campo.unidad ? `${valor} ${campo.unidad}` : String(valor);
}

export function fechaCalendario(valor) {
    return valor ? String(valor).slice(0, 10) : null;
}

export function formatearFechaDetalle(valor) {
    const fechaTexto = fechaCalendario(valor);
    if (!fechaTexto) return '-';

    const fecha = new Date(`${fechaTexto}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) return fechaTexto;

    return fecha.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

export function estaDisponible(relacion) {
    const hoy = new Date().toISOString().slice(0, 10);
    const inicio = fechaCalendario(relacion.fecha_inicio_contrato);
    const fin = fechaCalendario(relacion.fecha_fin_contrato);

    return relacion.estado_contrato === 'VIGENTE' &&
        (!inicio || inicio <= hoy) &&
        (!fin || fin >= hoy);
}

export function fechaIsoHistorial(valor) {
    if (!valor) return undefined;
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
}

export function formatearTipoMovimiento(valor) {
    return String(valor || 'MOVIMIENTO')
        .replaceAll('_', ' ')
        .toLocaleLowerCase('es-PE')
        .replace(/\b\p{L}/gu, (letra) => letra.toLocaleUpperCase('es-PE'));
}

export function formatearFechaHistorial(valor) {
    if (!valor) return 'Fecha no disponible';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);
    return fecha.toLocaleString('es-PE', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

export function perteneceAFiltroHistorial(evento, filtro) {
    const tipo = String(evento?.tipo_movimiento || '').toUpperCase();
    const origen = String(evento?.origen || '').toUpperCase();

    if (filtro === 'TODOS') return true;
    if (filtro === 'ASIGNACIONES') {
        return ['ASIGNACION', 'DEVOLUCION'].includes(tipo);
    }
    if (filtro === 'MOVIMIENTOS') {
        return origen === 'MOVIMIENTO' &&
            !['ASIGNACION', 'DEVOLUCION'].includes(tipo);
    }
    if (filtro === 'ACTAS') return origen === 'ACTA' || Boolean(evento?.acta);
    if (filtro === 'INVENTARIO') return origen === 'INVENTARIO_FISICO';
    if (filtro === 'CAMBIOS') return origen === 'AUDITORIA';

    return true;
}
