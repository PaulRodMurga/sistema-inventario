import { Cable, Eye, Pencil } from 'lucide-react';

const ICONOS = {
    editar: Pencil,
    perifericos: Cable,
    ver: Eye
};

function BotonAccionTabla({
    tipo = 'ver',
    etiqueta,
    className = '',
    onClick,
    disabled = false
}) {
    const Icono = ICONOS[tipo] || Eye;
    const claseTipo = tipo === 'editar'
        ? 'accion-editar'
        : tipo === 'perifericos'
            ? 'accion-perifericos'
            : 'accion-ver';

    return (
        <button
            type="button"
            className={`${claseTipo} ${className}`.trim()}
            title={etiqueta}
            aria-label={etiqueta}
            onClick={onClick}
            disabled={disabled}
        >
            <Icono size={17} aria-hidden="true" />
        </button>
    );
}

export default BotonAccionTabla;
