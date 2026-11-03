import { useEffect, useRef, useState } from 'react';
import {
    Camera,
    ImagePlus,
    LoaderCircle,
    Save,
    Trash2,
    X
} from 'lucide-react';

import {
    actualizarFotoPerfil,
    actualizarNombrePerfil,
    eliminarFotoPerfil,
    obtenerUrlFotoPerfil
} from '../services/perfilService';

import './ModalPerfil.css';

const TIPOS_IMAGEN_PERMITIDOS = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
]);
const TAMANO_MAXIMO_FOTO = 2 * 1024 * 1024;

function obtenerIniciales(nombre) {
    return String(nombre || 'Usuario')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0])
        .join('')
        .toUpperCase();
}

export default function ModalPerfil({ usuario, onCerrar, onActualizado }) {
    const [nombre, setNombre] = useState(usuario.nombre || '');
    const [fotoVista, setFotoVista] = useState(
        obtenerUrlFotoPerfil(usuario.foto_perfil)
    );
    const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
    const [quitarFoto, setQuitarFoto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const archivoRef = useRef(null);
    const nombreRef = useRef(null);

    useEffect(() => {
        nombreRef.current?.focus();
    }, []);

    useEffect(() => {
        const cerrarConEscape = (evento) => {
            if (evento.key === 'Escape' && !guardando) onCerrar();
        };

        document.addEventListener('keydown', cerrarConEscape);
        return () => document.removeEventListener('keydown', cerrarConEscape);
    }, [guardando, onCerrar]);

    const seleccionarFoto = (evento) => {
        const archivo = evento.target.files?.[0];
        evento.target.value = '';

        if (!archivo) return;

        if (!TIPOS_IMAGEN_PERMITIDOS.has(archivo.type)) {
            setError('Selecciona una imagen JPG, PNG o WEBP.');
            return;
        }

        if (archivo.size > TAMANO_MAXIMO_FOTO) {
            setError('La imagen no debe superar los 2 MB.');
            return;
        }

        const lector = new FileReader();
        lector.onload = () => {
            setFotoSeleccionada(archivo);
            setFotoVista(String(lector.result || ''));
            setQuitarFoto(false);
            setError('');
            setMensaje('');
        };
        lector.onerror = () => setError('No se pudo abrir la imagen seleccionada.');
        lector.readAsDataURL(archivo);
    };

    const restablecerFoto = () => {
        setFotoSeleccionada(null);
        setFotoVista(obtenerUrlFotoPerfil(usuario.foto_perfil));
        setQuitarFoto(false);
        setError('');
        setMensaje('');
    };

    const marcarFotoParaEliminar = () => {
        setFotoSeleccionada(null);
        setFotoVista('');
        setQuitarFoto(Boolean(usuario.foto_perfil));
        setError('');
        setMensaje('');
    };

    const guardarCambios = async (evento) => {
        evento.preventDefault();
        if (guardando) return;

        const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
        if (!nombreLimpio) {
            setError('El nombre es obligatorio.');
            nombreRef.current?.focus();
            return;
        }

        if (nombreLimpio.length > 120) {
            setError('El nombre admite hasta 120 caracteres.');
            nombreRef.current?.focus();
            return;
        }

        const hayCambioNombre = nombreLimpio !== usuario.nombre;
        const hayCambioFoto = Boolean(fotoSeleccionada) || quitarFoto;

        if (!hayCambioNombre && !hayCambioFoto) {
            onCerrar();
            return;
        }

        setGuardando(true);
        setError('');
        setMensaje('');

        let perfilActualizado = { ...usuario };
        let huboActualizacion = false;

        try {
            if (hayCambioNombre) {
                perfilActualizado = await actualizarNombrePerfil(nombreLimpio);
                huboActualizacion = true;
                onActualizado(perfilActualizado);
            }

            if (fotoSeleccionada) {
                perfilActualizado = await actualizarFotoPerfil(fotoSeleccionada);
                huboActualizacion = true;
                onActualizado(perfilActualizado);
            } else if (quitarFoto) {
                perfilActualizado = await eliminarFotoPerfil();
                huboActualizacion = true;
                onActualizado(perfilActualizado);
            }

            setMensaje('Perfil actualizado correctamente.');
            onCerrar();
        } catch (errorSolicitud) {
            if (huboActualizacion) onActualizado(perfilActualizado);
            setError(errorSolicitud.message || 'No se pudieron guardar los cambios.');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div
            className="perfil-modal-fondo"
            onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget && !guardando) onCerrar();
            }}
        >
            <section
                className="perfil-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="perfil-modal-titulo"
            >
                <header className="perfil-modal-cabecera">
                    <div>
                        <span className="perfil-modal-eyebrow">CUENTA PERSONAL</span>
                        <h2 id="perfil-modal-titulo">Editar perfil</h2>
                        <p>Administra tu foto y la información que se muestra en el sistema.</p>
                    </div>
                    <button
                        type="button"
                        className="perfil-modal-cerrar"
                        onClick={onCerrar}
                        disabled={guardando}
                        aria-label="Cerrar edición de perfil"
                    >
                        <X size={19} />
                    </button>
                </header>

                <form onSubmit={guardarCambios}>
                    <div className="perfil-modal-contenido">
                        <section className="perfil-foto-seccion" aria-label="Foto de perfil">
                            <div className="perfil-foto-marco">
                                {fotoVista ? (
                                    <img src={fotoVista} alt="Vista previa de la foto de perfil" />
                                ) : (
                                    <span>{obtenerIniciales(nombre || usuario.nombre)}</span>
                                )}
                                <button
                                    type="button"
                                    className="perfil-foto-camara"
                                    onClick={() => archivoRef.current?.click()}
                                    disabled={guardando}
                                    aria-label="Seleccionar foto de perfil"
                                    title="Cambiar foto"
                                >
                                    <Camera size={16} />
                                </button>
                            </div>

                            <div className="perfil-foto-acciones">
                                <strong>Foto de perfil</strong>
                                <p>Una imagen cuadrada funciona mejor. Máximo 2 MB.</p>
                                <div>
                                    <button
                                        type="button"
                                        className="perfil-boton-foto"
                                        onClick={() => archivoRef.current?.click()}
                                        disabled={guardando}
                                    >
                                        <ImagePlus size={15} />
                                        Cambiar foto
                                    </button>
                                    {(fotoVista || usuario.foto_perfil) && (
                                        <button
                                            type="button"
                                            className="perfil-boton-quitar"
                                            onClick={marcarFotoParaEliminar}
                                            disabled={guardando}
                                        >
                                            <Trash2 size={14} />
                                            Quitar
                                        </button>
                                    )}
                                    {fotoSeleccionada && (
                                        <button
                                            type="button"
                                            className="perfil-boton-restablecer"
                                            onClick={restablecerFoto}
                                            disabled={guardando}
                                        >
                                            Deshacer
                                        </button>
                                    )}
                                </div>
                                <input
                                    ref={archivoRef}
                                    className="perfil-archivo-oculto"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={seleccionarFoto}
                                    tabIndex={-1}
                                />
                            </div>
                        </section>

                        <div className="perfil-separador" />

                        <section className="perfil-datos-seccion">
                            <label className="perfil-campo">
                                <span>Nombre completo</span>
                                <input
                                    ref={nombreRef}
                                    type="text"
                                    value={nombre}
                                    onChange={(evento) => {
                                        setNombre(evento.target.value);
                                        setError('');
                                        setMensaje('');
                                    }}
                                    maxLength={120}
                                    autoComplete="name"
                                    placeholder="Escribe tu nombre"
                                    disabled={guardando}
                                    required
                                />
                                <small>Este nombre aparecerá en la barra superior.</small>
                            </label>

                            <div className="perfil-cuenta-datos">
                                <div>
                                    <span>Usuario de acceso</span>
                                    <strong>{usuario.usuario}</strong>
                                </div>
                                <div>
                                    <span>Tipo de cuenta</span>
                                    <strong>{usuario.rol}</strong>
                                </div>
                            </div>
                        </section>

                        {error && <p className="perfil-mensaje perfil-mensaje-error" role="alert">{error}</p>}
                        {mensaje && <p className="perfil-mensaje perfil-mensaje-exito" role="status">{mensaje}</p>}
                    </div>

                    <footer className="perfil-modal-pie">
                        <button
                            type="button"
                            className="perfil-boton-cancelar"
                            onClick={onCerrar}
                            disabled={guardando}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="perfil-boton-guardar"
                            disabled={guardando}
                        >
                            {guardando
                                ? <><LoaderCircle size={16} className="perfil-guardando-icono" /> Guardando...</>
                                : <><Save size={16} /> Guardar cambios</>}
                        </button>
                    </footer>
                </form>
            </section>
        </div>
    );
}
