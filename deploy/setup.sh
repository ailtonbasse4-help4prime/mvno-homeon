#!/bin/bash
set -e

echo "======================================="
echo "  MVNO Manager - Setup de Deploy"
echo "======================================="

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "[!] Docker nao encontrado. Instalando..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "[OK] Docker instalado. Faca logout e login para ativar o grupo docker."
fi

# Verificar Docker Compose
if ! docker compose version &> /dev/null; then
    echo "[!] Docker Compose nao encontrado."
    echo "    Instale com: sudo apt install docker-compose-plugin"
    exit 1
fi

# Verificar .env
if [ ! -f .env ]; then
    echo "[!] Arquivo .env nao encontrado."
    echo "    Copiando .env.example para .env..."
    cp .env.example .env
    echo ""
    echo ">>> IMPORTANTE: Edite o arquivo .env com suas credenciais antes de continuar!"
    echo "    nano .env"
    echo ""
    echo "    Campos obrigatorios:"
    echo "    - JWT_SECRET (gere com: python3 -c \"import secrets; print(secrets.token_hex(32))\")"
    echo "    - TATELECOM_USER_TOKEN"
    echo "    - REACT_APP_BACKEND_URL (ex: https://seudominio.com.br)"
    echo "    - DOMAIN"
    echo ""
    exit 1
fi

echo "[1/3] Construindo imagens Docker..."
docker compose build --no-cache

echo "[2/3] Iniciando servicos..."
docker compose up -d

echo "[3/3] Aguardando servicos ficarem prontos..."
sleep 10

# Verificar saude
echo ""
echo "Verificando servicos..."
if docker compose ps | grep -q "healthy"; then
    echo "[OK] Backend saudavel"
else
    echo "[!] Backend ainda iniciando... aguarde alguns segundos"
fi

echo ""
echo "======================================="
echo "  Deploy concluido!"
echo "======================================="
echo ""
echo "  Frontend: http://$(grep DOMAIN .env | cut -d= -f2)"
echo "  Backend:  http://$(grep DOMAIN .env | cut -d= -f2)/api"
echo ""
echo "  Credenciais iniciais:"
echo "  Email: admin@mvno.com"
echo "  Senha: admin123"
echo ""
echo "  >>> ALTERE A SENHA IMEDIATAMENTE! <<<"
echo ""
echo "  Comandos uteis:"
echo "  docker compose logs -f        # Ver logs"
echo "  docker compose restart         # Reiniciar"
echo "  docker compose down            # Parar"
echo "  docker compose up -d --build   # Reconstruir"
echo "======================================="
