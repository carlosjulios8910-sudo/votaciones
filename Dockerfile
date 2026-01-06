# 1. Usar una imagen base ligera de Node.js (necesaria para el paquete 'serve')
FROM node:20-alpine AS build

# 2. Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiar los archivos de configuración y dependencias
# Se copian primero para aprovechar el caché de Docker si solo cambian los archivos fuente
COPY package.json package-lock.json ./

# 4. Instalar las dependencias (solo 'serve' en este caso)
RUN npm install

# 5. Copiar el resto de los archivos de la aplicación (su HTML, CSS, JS)
# El '.' se refiere al directorio raíz de su proyecto
COPY . .

# 6. Exponer el puerto que 'serve' utilizará (definido en su package.json como 3000)
EXPOSE 3000

# 7. Definir el comando de inicio para la aplicación. 
# Esto ejecutará el script "start": "serve -s . -l 3000"
CMD ["npm", "start"]
