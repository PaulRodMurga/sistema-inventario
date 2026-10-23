function normalizarClase(valor, usarGuiones) {
    const clase = String(valor ?? '')
        .trim()
        .toLowerCase();

    if (!clase) return 'sin-estado';

    return usarGuiones
        ? clase.replace(/[\s_]+/g, '-')
        : clase;
}

function EtiquetaEstado({
    estado,
    texto,
    className,
    prefijo = 'estado-',
    usarGuiones = false,
    title
}) {
    const sufijo = normalizarClase(
        estado,
        usarGuiones
    );

    return (
        <span
            className={`${className} ${prefijo}${sufijo}`.trim()}
            title={title}
        >
            {texto || estado || '-'}
        </span>
    );
}

export default EtiquetaEstado;
