-- Permite crear usuarios locales vinculados a Active Directory sin
-- almacenar ni generar contraseñas locales.
-- Ejecutar una sola vez sobre la base de datos del inventario.

ALTER TABLE usuario
    MODIFY COLUMN clave_hash VARCHAR(255) NULL;
