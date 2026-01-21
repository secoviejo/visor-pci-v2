-- Script SQL para corregir las rutas de las imágenes de los campus
-- Ejecutar este script en el servidor de la Universidad

-- Primero, ver el estado actual
SELECT id, name, image_filename, background_image FROM campuses;

-- Actualizar las rutas de las imágenes para que incluyan el prefijo correcto
-- Solo actualiza si la ruta NO empieza con 'img/'

-- Campus San Francisco
UPDATE campuses
SET
    image_filename = CASE
        WHEN image_filename NOT LIKE 'img/%'
        AND image_filename IS NOT NULL THEN CONCAT(
            'img/campuses/',
            image_filename
        )
        ELSE image_filename
    END,
    background_image = CASE
        WHEN background_image NOT LIKE 'img/%'
        AND background_image IS NOT NULL THEN CONCAT(
            'img/campuses/',
            background_image
        )
        ELSE background_image
    END
WHERE
    name LIKE '%San Francisco%';

-- Campus Río Ebro
UPDATE campuses
SET
    image_filename = CASE
        WHEN image_filename NOT LIKE 'img/%'
        AND image_filename IS NOT NULL THEN CONCAT(
            'img/campuses/',
            image_filename
        )
        ELSE image_filename
    END,
    background_image = CASE
        WHEN background_image NOT LIKE 'img/%'
        AND background_image IS NOT NULL THEN CONCAT(
            'img/campuses/',
            background_image
        )
        ELSE background_image
    END
WHERE
    name LIKE '%Río Ebro%'
    OR name LIKE '%Rio Ebro%';

-- Campus Huesca
UPDATE campuses
SET
    image_filename = CASE
        WHEN image_filename NOT LIKE 'img/%'
        AND image_filename IS NOT NULL THEN CONCAT(
            'img/campuses/',
            image_filename
        )
        ELSE image_filename
    END,
    background_image = CASE
        WHEN background_image NOT LIKE 'img/%'
        AND background_image IS NOT NULL THEN CONCAT(
            'img/campuses/',
            background_image
        )
        ELSE background_image
    END
WHERE
    name LIKE '%Huesca%';

-- Campus Paraíso
UPDATE campuses
SET
    image_filename = CASE
        WHEN image_filename NOT LIKE 'img/%'
        AND image_filename IS NOT NULL THEN CONCAT(
            'img/campuses/',
            image_filename
        )
        ELSE image_filename
    END,
    background_image = CASE
        WHEN background_image NOT LIKE 'img/%'
        AND background_image IS NOT NULL THEN CONCAT(
            'img/campuses/',
            background_image
        )
        ELSE background_image
    END
WHERE
    name LIKE '%Paraíso%'
    OR name LIKE '%Paraiso%';

-- Campus Veterinaria
UPDATE campuses
SET
    image_filename = CASE
        WHEN image_filename NOT LIKE 'img/%'
        AND image_filename IS NOT NULL THEN CONCAT(
            'img/campuses/',
            image_filename
        )
        ELSE image_filename
    END,
    background_image = CASE
        WHEN background_image NOT LIKE 'img/%'
        AND background_image IS NOT NULL THEN CONCAT(
            'img/campuses/',
            background_image
        )
        ELSE background_image
    END
WHERE
    name LIKE '%Veterinaria%';

-- Campus Teruel
UPDATE campuses
SET
    image_filename = CASE
        WHEN image_filename NOT LIKE 'img/%'
        AND image_filename IS NOT NULL THEN CONCAT(
            'img/campuses/',
            image_filename
        )
        ELSE image_filename
    END,
    background_image = CASE
        WHEN background_image NOT LIKE 'img/%'
        AND background_image IS NOT NULL THEN CONCAT(
            'img/campuses/',
            background_image
        )
        ELSE background_image
    END
WHERE
    name LIKE '%Teruel%';

-- Verificar el resultado
SELECT id, name, image_filename, background_image FROM campuses;