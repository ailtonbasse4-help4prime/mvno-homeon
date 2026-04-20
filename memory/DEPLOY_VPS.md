# Deploy VPS — Comando completo e correto

**Ambiente do usuário:**
- VPS Ubuntu com Python 3.12
- Backend: uvicorn rodando em venv `/app/venv`, porta 3002 (SEM `--reload` em producao)
- Frontend: React CRA build servido por nginx de `/var/www/mvno/frontend/`
- Repo em `/opt/mvno-homeon/`
- Dominio: https://mvno.homeonapp.com.br
- systemd: NAO tem servico chamado `mvno-backend` - o backend é iniciado via `nohup uvicorn`

**Comando de deploy completo e validado (sempre usar esse):**

```bash
cd /opt/mvno-homeon && \
LAST_OK=$(git rev-parse HEAD) && \
git stash && git pull && \
cd frontend && yarn install && yarn build && \
cp -r /opt/mvno-homeon/frontend/build/* /var/www/mvno/frontend/ && \
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
  cd frontend && yarn build && cp -r build/* /var/www/mvno/frontend/ && \
  cd /opt/mvno-homeon/backend && nohup /app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 3002 > /var/log/mvno-backend.log 2>&1 & \
  echo "↩️ Revertido para versao anterior"; \
fi
```

**Passos que TODO deploy precisa ter:**
1. `git pull` - traz codigo novo
2. `yarn install` - instala deps do frontend se houve mudanca em package.json
3. `yarn build` - rebuild do React
4. `cp -r frontend/build/* /var/www/mvno/frontend/` ← **PASSO CRITICO QUE FALTOU ANTES**
5. `pip install -r requirements.txt` (backend) SE houve mudanca em requirements.txt
6. Matar uvicorn antigo e subir novo SEM `--reload`

**Bibliotecas a NAO incluir em requirements.txt** (sao internas do Emergent/nao usadas):
- emergentintegrations
- openai
- anthropic
- google-genai
- google-auth
- litellm
- stripe (se nao estiver em uso real)

**Comportamentos conhecidos:**
- `curl /api/` retorna 404 (nao existe essa rota root) - nao e erro
- `curl /api/auth/login` sem credenciais retorna 401 - isso significa que o backend esta funcionando
- Se Service Worker cachear versao antiga apos deploy, usuario precisa abrir em aba anonima ou Ctrl+Shift+R
