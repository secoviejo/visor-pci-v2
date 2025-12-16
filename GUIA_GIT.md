# Guía de Gestión de Versiones con Git

Actualmente tu proyecto ya tiene Git configurado y conectado a un repositorio remoto. A continuación te explico cómo "actuar" en tu día a día para gestionar nuevas implementaciones de forma segura.

## 1. El Ciclo Básico de Trabajo

Para cada cambio pequeño (corregir un texto, un error):

1.  **Modificar**: Haces tus cambios en el código.
2.  **Verificar**: Abres la terminal y ejecutas `git status`. Verás los archivos modificados en rojo.
3.  **Preparar (Stage)**: Seleccionas qué guardar.
    ```powershell
    git add .
    ```
    (El punto `.` añade todo. Si solo quieres un archivo, usa `git add nombre_archivo`).
4.  **Confirmar (Commit)**: Guardas una "foto" de esa versión.
    ```powershell
    git commit -m "Descripción breve de lo que hiciste"
    ```
5.  **Subir (Push)**: Envías los cambios a la nube (GitHub).
    ```powershell
    git push
    ```

## 2. Implementar Nuevas Funcionalidades (Recomendado)

Cuando vayas a crear algo nuevo (ej: "Sistema de Login", "Nueva Vista de Mapa"), no trabajes directo en `main`. Usa **Ramas (Branches)**. Esto te permite romper cosas sin miedo a dañar la versión principal.

### Paso A: Crear la rama
```powershell
git checkout -b nombre-de-la-nueva-funcionalidad
# Ejemplo: git checkout -b filtro-busqueda
```

### Paso B: Trabajar
Haces cambios, guardas y haces commits en tu rama:
```powershell
git add .
git commit -m "Avance en el filtro"
```
(Puedes hacer esto tantas veces como quieras).

### Paso C: Integrar (Merge)
Cuando termines y todo funcione:

1.  Vuelve a la rama principal:
    ```powershell
    git checkout main
    ```
2.  Trae los últimos cambios de internet (por si acaso):
    ```powershell
    git pull
    ```
3.  Fusiona tu rama:
    ```powershell
    git merge nombre-de-la-nueva-funcionalidad
    ```
4.  Sube todo:
    ```powershell
    git push
    ```

## Resumen de Comandos Útiles

| Comando | Acción |
| :--- | :--- |
| `git status` | Ver qué archivos han cambiado. |
| `git log --oneline` | Ver historial de cambios reciente. |
| `git checkout main` | Volver a la versión principal. |
| `git checkout -b [nombre]` | Crear y cambiar a una rama nueva. |
| `git reset --hard` | **PELIGRO**: Borra cambios no guardados y vuelve al último commit. |
