import { useEffect, useRef } from 'react';

const SELECTOR_ENFOCABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

function obtenerElementosEnfocables(contenedor) {
    if (!contenedor?.querySelectorAll) return [];

    return [...contenedor.querySelectorAll(SELECTOR_ENFOCABLE)]
        .filter((elemento) =>
            elemento.getAttribute('aria-hidden') !== 'true' &&
            elemento.tabIndex >= 0
        );
}

function mantenerFocoEnDialogo(evento, contenedor) {
    if (evento.key !== 'Tab') return;

    const elementos = obtenerElementosEnfocables(contenedor);

    if (elementos.length === 0) {
        evento.preventDefault();
        contenedor.focus();
        return;
    }

    const primero = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    const activo = contenedor.ownerDocument?.activeElement;

    if (evento.shiftKey && (activo === primero || activo === contenedor)) {
        evento.preventDefault();
        ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
        evento.preventDefault();
        primero.focus();
    }
}

function DialogoAccesible({
    children,
    className = '',
    tituloId,
    descripcionId,
    onCerrar,
    bloqueado = false,
    ocupado = false
}) {
    const dialogoRef = useRef(null);
    const focoAnteriorRef = useRef(null);

    useEffect(() => {
        const dialogo = dialogoRef.current;
        focoAnteriorRef.current = document.activeElement;
        dialogo?.focus({ preventScroll: true });

        return () => {
            const focoAnterior = focoAnteriorRef.current;

            if (
                focoAnterior?.isConnected !== false &&
                typeof focoAnterior?.focus === 'function'
            ) {
                focoAnterior.focus({ preventScroll: true });
            }
        };
    }, []);

    const manejarTeclado = (evento) => {
        if (evento.key === 'Escape') {
            evento.preventDefault();
            evento.stopPropagation();
            if (!bloqueado) onCerrar();
            return;
        }

        mantenerFocoEnDialogo(evento, dialogoRef.current);
    };

    const manejarFondo = (evento) => {
        if (
            evento.target === evento.currentTarget &&
            !bloqueado
        ) {
            onCerrar();
        }
    };

    return (
        <div className="modal-fondo" onMouseDown={manejarFondo}>
            <div
                ref={dialogoRef}
                className={`modal-contenido ${className}`.trim()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={tituloId}
                aria-describedby={descripcionId}
                aria-busy={ocupado || undefined}
                tabIndex={-1}
                onKeyDown={manejarTeclado}
                onMouseDown={(evento) => evento.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

export default DialogoAccesible;
