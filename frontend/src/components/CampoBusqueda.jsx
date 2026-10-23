import { Search } from 'lucide-react';

function CampoBusqueda({
    className,
    etiqueta,
    placeholder,
    value,
    onChange
}) {
    return (
        <div className={className}>
            <Search size={18} aria-hidden="true" />

            <input
                type="text"
                aria-label={etiqueta}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />
        </div>
    );
}

export default CampoBusqueda;
