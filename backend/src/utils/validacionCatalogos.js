const ESTADOS_CATALOGO = new Set([
    'ACTIVO',
    'INACTIVO'
]);

const resultadoValido = (valor) => ({
    valido: true,
    valor
});

const resultadoInvalido = (mensaje) => ({
    valido: false,
    mensaje
});

const esObjetoDatos = (valor) => (
    valor !== null &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
);

const tienePropiedad = (objeto, propiedad) => (
    Object.prototype.hasOwnProperty.call(objeto, propiedad)
);

const validarIdPositivo = (valor) => {
    if (
        !(
            typeof valor === 'number' ||
            (
                typeof valor === 'string' &&
                /^\d+$/.test(valor)
            )
        )
    ) {
        return resultadoInvalido(
            'El ID debe ser un número entero positivo'
        );
    }

    const id = Number(valor);

    if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        id > 2147483647
    ) {
        return resultadoInvalido(
            'El ID debe ser un número entero positivo'
        );
    }

    return resultadoValido(id);
};

const validarIdOpcional = (valor, etiqueta) => {
    if (valor === null) {
        return resultadoValido(null);
    }

    if (
        typeof valor !== 'number' ||
        !Number.isSafeInteger(valor) ||
        valor <= 0 ||
        valor > 2147483647
    ) {
        return resultadoInvalido(
            `${etiqueta} debe ser un número entero positivo o null`
        );
    }

    return resultadoValido(valor);
};

const validarDigitos = (
    valor,
    {
        etiqueta,
        maximo,
        opcional = false
    }
) => {
    if (valor === null && opcional) {
        return resultadoValido(null);
    }

    if (typeof valor !== 'string') {
        return resultadoInvalido(
            `${etiqueta} debe enviarse como texto numérico`
        );
    }

    const texto = valor.trim();

    if (!texto) {
        if (opcional) {
            return resultadoValido(null);
        }

        return resultadoInvalido(
            `${etiqueta} es obligatorio`
        );
    }

    if (texto.length > maximo) {
        return resultadoInvalido(
            `${etiqueta} no puede superar ${maximo} dígitos`
        );
    }

    if (!/^\d+$/.test(texto)) {
        return resultadoInvalido(
            `${etiqueta} solo puede contener dígitos`
        );
    }

    return resultadoValido(texto);
};

const validarNombre = (valor, maximo, etiqueta) => {
    if (typeof valor !== 'string') {
        return resultadoInvalido(
            `${etiqueta} debe ser un texto`
        );
    }

    const nombre = valor.trim();

    if (!nombre) {
        return resultadoInvalido(
            `${etiqueta} es obligatorio`
        );
    }

    if (nombre.length > maximo) {
        return resultadoInvalido(
            `${etiqueta} no puede superar ${maximo} caracteres`
        );
    }

    return resultadoValido(nombre);
};

const validarTextoOpcional = (valor, maximo, etiqueta) => {
    if (valor === null) {
        return resultadoValido(null);
    }

    if (typeof valor !== 'string') {
        return resultadoInvalido(
            `${etiqueta} debe ser un texto o null`
        );
    }

    const texto = valor.trim();

    if (!texto) {
        return resultadoValido(null);
    }

    if (texto.length > maximo) {
        return resultadoInvalido(
            `${etiqueta} no puede superar ${maximo} caracteres`
        );
    }

    return resultadoValido(texto);
};

const validarFecha = (
    valor,
    {
        etiqueta,
        opcional = false
    }
) => {
    if (valor === null && opcional) {
        return resultadoValido(null);
    }

    if (typeof valor !== 'string') {
        return resultadoInvalido(
            `${etiqueta} debe tener el formato YYYY-MM-DD`
        );
    }

    const fecha = valor.trim();

    if (!fecha) {
        if (opcional) {
            return resultadoValido(null);
        }

        return resultadoInvalido(
            `${etiqueta} es obligatoria`
        );
    }

    const coincidencia = fecha.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!coincidencia) {
        return resultadoInvalido(
            `${etiqueta} debe tener el formato YYYY-MM-DD`
        );
    }

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);
    const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));

    if (
        anio < 1000 ||
        fechaUtc.getUTCFullYear() !== anio ||
        fechaUtc.getUTCMonth() !== mes - 1 ||
        fechaUtc.getUTCDate() !== dia
    ) {
        return resultadoInvalido(
            `${etiqueta} no es una fecha válida`
        );
    }

    return resultadoValido(fecha);
};

const validarDecimalNoNegativo = (
    valor,
    {
        etiqueta,
        maximo,
        opcional = false
    }
) => {
    if (valor === null && opcional) {
        return resultadoValido(null);
    }

    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        return resultadoInvalido(
            `${etiqueta} debe enviarse como número${opcional ? ' o null' : ''}`
        );
    }

    if (valor < 0 || valor > maximo) {
        return resultadoInvalido(
            `${etiqueta} debe estar entre 0 y ${maximo}`
        );
    }

    const centesimas = valor * 100;

    if (
        Math.abs(centesimas - Math.round(centesimas)) >
        Number.EPSILON * Math.max(1, Math.abs(centesimas)) * 4
    ) {
        return resultadoInvalido(
            `${etiqueta} permite como máximo 2 decimales`
        );
    }

    return resultadoValido(valor);
};

const validarEnteroPositivo = (valor, etiqueta) => {
    if (
        typeof valor !== 'number' ||
        !Number.isSafeInteger(valor) ||
        valor <= 0 ||
        valor > 2147483647
    ) {
        return resultadoInvalido(
            `${etiqueta} debe ser un número entero positivo`
        );
    }

    return resultadoValido(valor);
};

const validarEstado = (valor) => {
    if (typeof valor !== 'string') {
        return resultadoInvalido(
            'El estado debe ser ACTIVO o INACTIVO'
        );
    }

    const estado = valor.trim().toUpperCase();

    if (!ESTADOS_CATALOGO.has(estado)) {
        return resultadoInvalido(
            'El estado debe ser ACTIVO o INACTIVO'
        );
    }

    return resultadoValido(estado);
};

const validarRuc = (valor) => {
    if (valor === null) {
        return resultadoValido(null);
    }

    if (typeof valor !== 'string') {
        return resultadoInvalido(
            'El RUC debe enviarse como texto de 11 dígitos o null'
        );
    }

    const ruc = valor.trim();

    if (!ruc) {
        return resultadoValido(null);
    }

    if (!/^\d{11}$/.test(ruc)) {
        return resultadoInvalido(
            'El RUC debe contener exactamente 11 dígitos'
        );
    }

    return resultadoValido(ruc);
};

const validarGb = (valor) => {
    if (valor === null) {
        return resultadoValido(null);
    }

    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        return resultadoInvalido(
            'Los GB deben enviarse como número o null'
        );
    }

    if (valor < 0 || valor > 99999999.99) {
        return resultadoInvalido(
            'Los GB deben estar entre 0 y 99999999.99'
        );
    }

    const centesimas = valor * 100;

    if (
        Math.abs(centesimas - Math.round(centesimas)) >
        Number.EPSILON * Math.max(1, Math.abs(centesimas)) * 4
    ) {
        return resultadoInvalido(
            'Los GB permiten como máximo 2 decimales'
        );
    }

    return resultadoValido(valor);
};

module.exports = {
    esObjetoDatos,
    tienePropiedad,
    validarIdPositivo,
    validarIdOpcional,
    validarDigitos,
    validarNombre,
    validarTextoOpcional,
    validarFecha,
    validarDecimalNoNegativo,
    validarEnteroPositivo,
    validarEstado,
    validarRuc,
    validarGb
};
