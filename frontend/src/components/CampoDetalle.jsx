const CLASES_VARIANTE = {
    predeterminada: 'detalle-campo',
    linea: 'campo-detalle-linea',
    movimiento: 'campo-detalle-movimiento',
    acta: 'campo-detalle-acta'
};

function CampoDetalle({
    icono,
    etiqueta,
    valor,
    variante = 'predeterminada',
    completo = false,
    claseCompleto
}) {
    const claseBase = CLASES_VARIANTE[variante] ||
        CLASES_VARIANTE.predeterminada;

    const claseExtendida = completo
        ? claseCompleto || 'campo-completo'
        : '';

    // Actas ya distinguía entre texto vacío y dato ausente;
    // las demás variantes usaban la sustitución por valor falso.
    const sinContenido = variante === 'acta'
        ? valor === null || valor === undefined
        : !valor;

    const contenido = sinContenido ? '-' : valor;

    return (
        <div className={`${claseBase} ${claseExtendida}`.trim()}>
            <span>
                {icono}
                {etiqueta}
            </span>

            <strong>{contenido}</strong>
        </div>
    );
}

export default CampoDetalle;
