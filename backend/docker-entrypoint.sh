#!/bin/sh
set -e

host="${DATABASE_HOST:-db}"
port="${DATABASE_PORT:-3306}"

echo "Aguardando banco em ${host}:${port}..."
until node -e "
  const net = require('node:net');
  const socket = net.createConnection({ host: '${host}', port: Number('${port}') });
  socket.on('connect', () => { socket.end(); process.exit(0); });
  socket.on('error', () => process.exit(1));
" 2>/dev/null; do
  sleep 2
done

echo "Aplicando migrações..."
npx prisma migrate deploy

echo "Iniciando API na porta ${PORT:-3333}..."
exec node dist/src/index.js
