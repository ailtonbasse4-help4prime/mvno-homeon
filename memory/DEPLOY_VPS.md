# Deploy VPS — Comando completo, correto e SEGURO

**Ambiente do usuário:**
- VPS Ubuntu com Python 3.12
- Backend: uvicorn rodando em venv `/app/venv`, porta 3002 (SEM `--reload` em producao)
- Frontend: React CRA build servido por nginx de `/var/www/mvno/frontend/`
- Repo em `/opt/mvno-homeon/`
- Dominio: https://mvno.homeonapp.com.br
- Config nginx ativa: `/etc/nginx/sites-enabled/app-ativacao` (tem `try_files $uri $uri/ /index.html;`)

## REGRAS CRITICAS — NUNCA QUEBRAR

⛔ **JAMAIS RODAR `mongosh` com `$unset` em campos manuais ou de configuracao do usuario.**
   Em particular, NUNCA tocar:
   - `expirar_dados_manual` (flag de edicao manual da Recarga Ta - editado pelo usuario)
   - `expirar_dados` (data de Recarga Ta - editavel)
   - `complemento`, `desconto`, `incluir_custo`, `incluir_lucro`
   - Qualquer campo gravado por edicao inline na planilha

⛔ **NUNCA** sugerir comandos de "re-sync forcado" que usam `$unset` ou `deleteMany` em colecoes de producao.

✅ **SEMPRE** preservar o `yarn.lock` se possivel. So apagar se git pull abortar.

---

## Comando de deploy completo (validado e seguro)

```bash
cd /opt/mvno-homeon && \
LAST_OK=$(git rev-parse HEAD) && \
git stash && git pull && \
cd frontend && yarn install && yarn build && \
sudo rm -rf /var/www/mvno/frontend/homeon && \
sudo cp -r /opt/mvno-homeon/frontend/build/* /var/www/mvno/frontend/ && \
sudo chown -R www-data:www-data /var/www/mvno/frontend && \
pkill -9 -f "uvicorn server:app.*3002"; sleep 2 && \
cd /opt/mvno-homeon/backend && \
nohup /app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 3002 > /var/log/mvno-backend.log 2>&1 & \
sleep 6 && \
if curl -s http://localhost:3002/api/auth/login -X POST -H "Content-Type: application/json" -d '{}' -o /dev/null -w "%{http_code}" | grep -qE "^(200|401|422)$"; then \
  sudo systemctl reload nginx && \
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

## Se git pull abortar com "untracked working tree files"

So neste caso, e somente neste caso, rodar antes:
```bash
rm -f frontend/yarn.lock yarn.lock
```

## Bibliotecas a NAO incluir em requirements.txt
- emergentintegrations, openai, anthropic, google-genai, google-auth, litellm

## Assets estaticos importantes
- `/var/www/mvno/frontend/homeon-assets/` (logo HomeOn)
- NUNCA criar pasta chamada `homeon/` em `public/` (conflita com rota React)

## Troubleshooting rapido
- 403 Forbidden em rota SPA -> remove pastas com mesmo nome da rota: `sudo rm -rf /var/www/mvno/frontend/{nome_rota}`
- 502 Bad Gateway -> backend caiu: `nohup /app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 3002 > /var/log/mvno-backend.log 2>&1 &`
- Login nao funciona apos deploy -> `tail -n 50 /var/log/mvno-backend.log`

## Recuperar edicoes manuais perdidas (caso aconteca)

Se por algum motivo edicoes manuais da coluna "Recarga Ta" forem perdidas, rodar como admin (autenticado):
```
POST /api/operacional/restaurar-edicoes-manuais
```
O endpoint le os logs de auditoria e restaura todas as edicoes manuais ja feitas pelo usuario.
