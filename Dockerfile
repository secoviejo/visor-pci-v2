# Usar una imagen oficial de Node.js ligera como base
FROM node:20-slim

# Instalar dependencias del sistema necesarias para compilar módulos nativos (si los hubiera)
# y herramientas útiles para SQLite/Networking
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar archivos de definición de dependencias
COPY package*.json ./

# Instalar dependencias de producción (omitimos las de desarrollo para ahorrar espacio)
RUN npm install --omit=dev

# Copiar el resto del código de la aplicación al contenedor
COPY . .

# Asegurar que existan las carpetas de persistencia antes de ejecutar
RUN mkdir -p uploads/temp datos_edificios

# Exponer el puerto de la aplicación (definido en server.js como 3000 por defecto)
EXPOSE 3000

# Metadata de la imagen
LABEL maintainer="Unizar PCI Project"
LABEL version="1.0.0"

# Comando para iniciar la aplicación
CMD [ "node", "server.js" ]
