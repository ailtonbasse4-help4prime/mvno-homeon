#!/bin/bash
set -e

echo "======================================="
echo "  MVNO Manager - Deploy na VPS"
echo "======================================="
echo ""

# 1. Criar diretorio do frontend
echo "[1/4] Criando diretorio do frontend..."
sudo mkdir -p /var/www/mvno/frontend

# 2. Copiar build do frontend
echo "[2/4] Copiando arquivos do frontend..."
sudo cp -r /tmp/mvno-deploy/frontend-build/* /var/www/mvno/frontend/
sudo chown -R www-data:www-data /var/www/mvno/frontend

# 3. Configurar Nginx
echo "[3/4] Configurando Nginx..."
sudo cp /tmp/mvno-deploy/nginx-mvno.conf /etc/nginx/sites-available/mvno
sudo ln -sf /etc/nginx/sites-available/mvno /etc/nginx/sites-enabled/mvno

# Remover config default se existir
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Testar config do Nginx
sudo nginx -t
if [ $? -ne 0 ]; then
    echo "[ERRO] Configuracao do Nginx invalida!"
    echo "Verifique o arquivo /etc/nginx/sites-available/mvno"
    exit 1
fi

# 4. Reiniciar Nginx
echo "[4/4] Reiniciando Nginx..."
sudo systemctl reload nginx

echo ""
echo "======================================="
echo "  Deploy concluido!"
echo "======================================="
echo ""
echo "  https://mvno.homeonapp.com.br"
echo ""
echo "  Frontend: /var/www/mvno/frontend/"
echo "  Nginx:    /etc/nginx/sites-available/mvno"
echo ""
echo "  Credenciais:"
echo "  Email: admin@mvno.com"
echo "  Senha: admin123"
echo ""
echo "  >>> ALTERE A SENHA NO PRIMEIRO ACESSO! <<<"
echo "======================================="
