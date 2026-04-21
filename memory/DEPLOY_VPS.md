# Deploy VPS — Comando completo e correto

**Ambiente do usuário:**
- VPS Ubuntu com Python 3.12
- Backend: uvicorn rodando em venv `/app/venv`, porta 3002 (SEM `--reload` em producao)
- Frontend: React CRA build servido por nginx de `/var/www/mvno/frontend/`
- Repo em `/opt/mvno-homeon/`
- Dominio: https://mvno.homeonapp.com.br
- Config nginx ativa: `/etc/nginx/sites-enabled/app-ativacao` (tem `try_files $uri $uri/ /index.html;`)
- systemd: NAO tem servico chamado `mvno-backend` - o backend é iniciado via `nohup uvicorn`

**Comando de deploy completo e validado (sempre usar esse):**

```bash
cd /opt/mvno-homeon && \
LAST_OK=$(git rev-parse HEAD) && \
git stash && git pull && \
cd frontend && yarn install && yarn build && \
sudo rm -rf /var/www/mvno/frontend/homeon && \
sudo cp -r /opt/mvno-homeon/frontend/build/* /var/www/mvno/frontend/ && \
sudo chown -R www-data:www-data /var/www/mvno/frontend && \
sudo systemctl reload nginx && \
pkill -9 -f "uvicorn server:app.*3002"; sleep 2 && \
cd /opt/mvno-homeon/backend && \
nohup /app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 3002 > /var/log/mvno-backend.log 2>&1 & \
sleep 6 && \
if curl -s http://localhost:3002/api/auth/login -X POST -H "Content-Type: application/json" -d '{}' -o /dev/null -w "%{http_code}" | grep -qE "^(200|401|422)$"; then \
  echo "✅ DEPLOY OK"; \
else \
  echo "❌ FALHOU - revertendo..." && \
  pkill -9 -f "uvicorn server:app.*3002" && \
  cd /opt/mvno-homeon && git reset --hard $LAST_OK && \
  cd frontend && yarn build && sudo cp -r build/* /var/www/mvno/frontend/ && \
  cd /opt/mvno-homeon/backend && nohup /app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 3002 > /var/log/mvno-backend.log 2>&1 & \
  echo "↩️ Revertido para versao anterior"; \
fi
```

**Passos que TODO deploy precisa ter:**
1. `git pull` - traz codigo novo
2. `yarn install` - instala deps do frontend se houve mudanca em package.json
3. `yarn build` - rebuild do React
4. `sudo rm -rf /var/www/mvno/frontend/homeon` ← **CRITICO: evita 403 do nginx por conflito de pasta vs rota SPA**
5. `cp -r frontend/build/* /var/www/mvno/frontend/` ← **PASSO CRITICO**
6. `chown www-data` - garante permissoes
7. `pip install -r requirements.txt` (backend) SE houve mudanca em requirements.txt
8. Matar uvicorn antigo e subir novo SEM `--reload`

**Bibliotecas a NAO incluir em requirements.txt** (sao internas do Emergent/nao usadas):
- emergentintegrations
- openai
- anthropic
- google-genai
- google-auth
- litellm
- stripe (se nao estiver em uso real)

**Assets estaticos publicados em /var/www/mvno/frontend/:**
- `homeon-assets/` (logo HomeOn e tight version) - NAO renomear
- NUNCA criar pasta chamada `homeon/` em `public/` - conflita com rota React `/homeon`

**Comportamentos conhecidos:**
- `curl /api/` retorna 404 (nao existe essa rota root) - nao e erro
- `curl /api/auth/login` sem credenciais retorna 401/422 - isso significa que o backend esta funcionando
- Se Service Worker cachear versao antiga apos deploy, usuario precisa abrir em aba anonima ou Ctrl+Shift+R
- Se `git pull` abortar por "untracked working tree files", rode `rm -f frontend/yarn.lock yarn.lock` antes

**Troubleshooting rapido:**
- 403 Forbidden em alguma rota SPA -> confere `ls /var/www/mvno/frontend/` e remove pastas com mesmo nome da rota
- 502 Bad Gateway -> backend caiu, roda: `nohup /app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 3002 > /var/log/mvno-backend.log 2>&1 &`
- Login nao funciona apos deploy -> confere `tail -n 50 /var/log/mvno-backend.log`
