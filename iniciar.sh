#!/bin/bash
# Script de inicio para el Sistema de Gestión de Campo Agrícola
cd "$(dirname "$0")"

echo "🌱 Iniciando Sistema de Gestión de Campo Agrícola..."
echo "📂 Directorio de trabajo: $(pwd)"

# Inicializar o verificar base de datos
python3 database.py

# Iniciar servidor en segundo plano si no está corriendo
PORT=8000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  El puerto $PORT ya está en uso. Abriendo en el navegador..."
else
    echo "🚀 Arrancando servidor local en http://localhost:$PORT ..."
    python3 server.py $PORT &
    SERVER_PID=$!
    sleep 1
fi

# Abrir automáticamente en el navegador predeterminado en macOS
echo "🌐 Abriendo navegador web..."
open "http://localhost:$PORT"

echo "✅ ¡Listo! La aplicación está en ejecución."
