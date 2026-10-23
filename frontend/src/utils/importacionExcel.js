import leerLibroExcel from 'read-excel-file/browser';

const normalizarEncabezado = (valor) => String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const nombreHoja = (valor) => normalizarEncabezado(valor);

const estaVacio = (valor) =>
    valor === null ||
    valor === undefined ||
    (typeof valor === 'string' && !valor.trim());

const convertirFecha = (valor) => {
    if (!(valor instanceof Date)) return valor;

    const anio = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
};

const comoTexto = (valor) => {
    if (estaVacio(valor)) return '';
    return String(convertirFecha(valor)).trim();
};

const obtenerHoja = (libro, buscado, obligatoria = true) => {
    const hoja = libro.find(({ sheet }) => nombreHoja(sheet) === buscado);

    if (!hoja && obligatoria) {
        throw new Error(`El archivo no contiene la hoja ${buscado === 'equipos' ? 'Equipos' : 'Colaboradores'}`);
    }

    return hoja?.data || [];
};

const convertirTabla = (filas, hoja) => {
    if (!Array.isArray(filas) || filas.length === 0) {
        throw new Error(`La hoja ${hoja} está vacía`);
    }

    const encabezados = filas[0].map(normalizarEncabezado);
    const repetidos = encabezados.filter(
        (valor, indice) => valor && encabezados.indexOf(valor) !== indice
    );

    if (repetidos.length > 0) {
        throw new Error(`La hoja ${hoja} tiene columnas repetidas: ${[...new Set(repetidos)].join(', ')}`);
    }

    return filas.slice(1).flatMap((fila, indice) => {
        if (!fila.some((valor) => !estaVacio(valor))) return [];

        const registro = { fila: indice + 2 };

        encabezados.forEach((encabezado, posicion) => {
            if (encabezado) registro[encabezado] = convertirFecha(fila[posicion]);
        });

        return [registro];
    });
};

const CAMPOS_EQUIPO = new Set([
    'fila',
    'clave_importacion',
    'tipo',
    'marca',
    'modelo',
    'nro_contrato',
    'codigo_gama',
    'codigo_patrimonial',
    'imei',
    'serie',
    'fecha_inicio_alquiler',
    'fecha_fin_alquiler',
    'observaciones'
]);

const CAMPOS_PERIFERICO = new Set([
    'fila',
    'equipo_clave',
    'tipo',
    'marca',
    'modelo',
    'codigo_patrimonial',
    'serie',
    'observaciones'
]);

const separarEspecificaciones = (registro, camposBase) => {
    const salida = { especificaciones: {} };

    for (const [clave, valor] of Object.entries(registro)) {
        if (camposBase.has(clave)) {
            salida[clave] = clave === 'fila' ? valor : comoTexto(valor);
        } else if (!estaVacio(valor)) {
            salida.especificaciones[clave] = valor;
        }
    }

    return salida;
};

export const leerImportacionEquipos = async (archivo) => {
    const libro = await leerLibroExcel(archivo);
    const equipos = convertirTabla(
        obtenerHoja(libro, 'equipos'),
        'Equipos'
    ).map((registro) => separarEspecificaciones(registro, CAMPOS_EQUIPO));
    const hojaPerifericos = obtenerHoja(libro, 'perifericos', false);
    const perifericos = hojaPerifericos.length > 0
        ? convertirTabla(hojaPerifericos, 'Perifericos')
            .map((registro) => separarEspecificaciones(registro, CAMPOS_PERIFERICO))
        : [];

    return { equipos, perifericos };
};

const CAMPOS_COLABORADOR = new Set([
    'codigo',
    'apellidos',
    'nombres',
    'dni',
    'correo',
    'cargo',
    'area',
    'centro_costos',
    'unidad_empresarial',
    'estado'
]);

export const leerImportacionColaboradores = async (archivo) => {
    const libro = await leerLibroExcel(archivo);
    const registros = convertirTabla(
        obtenerHoja(libro, 'colaboradores'),
        'Colaboradores'
    );

    const columnasDesconocidas = new Set();

    for (const registro of registros) {
        for (const clave of Object.keys(registro)) {
            if (clave !== 'fila' && !CAMPOS_COLABORADOR.has(clave)) {
                columnasDesconocidas.add(clave);
            }
        }
    }

    if (columnasDesconocidas.size > 0) {
        throw new Error(
            `La hoja Colaboradores contiene columnas no reconocidas: ${[...columnasDesconocidas].join(', ')}`
        );
    }

    return {
        colaboradores: registros.map((registro) => Object.fromEntries(
            Object.entries(registro).map(([clave, valor]) => [
                clave,
                clave === 'fila' ? valor : comoTexto(valor)
            ])
        ))
    };
};

export const contarRegistrosImportacion = (carga) => ({
    equipos: carga?.equipos?.length || 0,
    perifericos: carga?.perifericos?.length || 0,
    colaboradores: carga?.colaboradores?.length || 0
});
