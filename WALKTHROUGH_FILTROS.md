# Implementación de Filtros de Elementos

Se ha completado la funcionalidad de filtrado de elementos en la rama `feature/filtro-elementos`.

## Cambios Realizados

### 1. Interfaz de Usuario (`index.html`)
Se añadieron tres botones en la barra superior para controlar la visibilidad de cada tipo de dispositivo:

```html
<div class="controls">
    <button onclick="toggleFilter('detector')">Detectores</button>
    <button onclick="toggleFilter('pulsador')">Pulsadores</button>
    <button onclick="toggleFilter('sirena')">Sirenas</button>
</div>
```

### 2. Lógica de Filtrado (`js/app.js`)
- Se creó un estado global `visibleTypes` para rastrear qué elementos están activos.
- Se implementó la función `toggleFilter(type)` que:
  - Invierte el estado de visibilidad.
  - Actualiza el estilo del botón (relleno = visible, borde = oculto).
  - Llama a `applyFilters()`.
- Se añadió `applyFilters()` que recorre los elementos en pantalla (`.hotspot`) y ajusta su propiedad `display` según su clase CSS (`type-detector`, etc.).

## Cómo Probar

1.  Abre la aplicación.
2.  Verás tres botones nuevos junto a los selectores de edificio.
3.  Haz clic en "Detectores". Los puntos rojos deberían desaparecer y el botón cambiará de estilo.
4.  Haz clic nuevamente para mostrarlos.
5.  Cambia de planta: los filtros deberían mantenerse (si ocultaste detectores, seguirán ocultos en la nueva planta).

## Siguientes Pasos (Git)

Si estás satisfecho con la funcionalidad, podemos fusionar esta rama con la principal (`main`).

```powershell
git checkout main
git merge feature/filtro-elementos
```
