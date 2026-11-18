function CampoTecnico({
    id,
    campo,
    valor,
    onChange,
    disabled
}) {
    const etiqueta = campo.unidad
        ? `${campo.etiqueta} (${campo.unidad})`
        : campo.etiqueta;

    return (
        <div className="campo-formulario campo-tecnico">
            <label htmlFor={id}>
                {etiqueta}{campo.requerido ? ' *' : ''}
            </label>

            {campo.tipo === 'select' ? (
                <select
                    id={id}
                    value={valor}
                    onChange={(evento) => onChange(evento.target.value)}
                    disabled={disabled}
                    required={campo.requerido}
                >
                    <option value="">Seleccionar</option>
                    {campo.opciones.map((opcion) => (
                        <option key={opcion} value={opcion}>
                            {opcion.replaceAll('_', ' ')}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    id={id}
                    type={campo.tipo}
                    value={valor}
                    min={campo.min}
                    max={campo.max}
                    step={campo.step}
                    maxLength={campo.max_length}
                    placeholder={campo.placeholder || ''}
                    onChange={(evento) => onChange(evento.target.value)}
                    disabled={disabled}
                    required={campo.requerido}
                />
            )}
        </div>
    );
}

export default CampoTecnico;
