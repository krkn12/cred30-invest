# Guia de Deploy - Projeto Cred30

Este documento explica como realizar o deploy do Frontend e do Backend, além de como verificar se as atualizações foram aplicadas com sucesso.

---

## 1. Como realizar o Deploy

O projeto está configurado com **Integração Contínua (CI/CD)**. Isso significa que você não precisa fazer o deploy manualmente via terminal na maioria das vezes.

### Fluxo Automático
Sempre que você rodar os comandos abaixo no seu terminal local, o deploy será iniciado:
```bash
git add .
git commit -m "Descricao da sua alteracao"
git push origin master
```

- **Backend**: O **Render.com** detecta o `push` na branch `master` e inicia o build automaticamente.
- **Frontend**: O **GitHub Actions** detecta o `push` e inicia o build e o deploy para o **Firebase Hosting**.

---

## 2. Como saber se foi atualizado?

### Backend (Render)
1. Acesse o painel do [Render](https://dashboard.render.com/).
2. Selecione o seu serviço de **Web Service** (ex: `cred30-backend`).
3. Vá na aba **Events** ou **Deployments**.
4. Lá você verá o status:
   - `Live`: A versão mais recente está no ar.
   - `In Progress`: O deploy ainda está acontecendo.
   - `Failed`: Ocorreu um erro no build (clique em "Logs" para ver o motivo).

### Frontend (GitHub & Firebase)
1. **GitHub Actions**: Vá no seu repositório no GitHub e clique na aba **Actions**. Lá você verá o progresso do workflow "Auto Deploy". Se estiver verde (✅), o build terminou.
2. **Firebase Hosting**: Acesse o [Console do Firebase](https://console.firebase.google.com/), escolha seu projeto e vá em **Hosting**. Lá aparecerá o histórico de "Versões", mostrando exatamente o horário do último deploy (ex: "Agora mesmo" ou "Há 5 minutos").

---

## 3. Variáveis de Ambiente Necessárias

Para que o deploy funcione corretamente, as seguintes variáveis **devem** ser configuradas nos respectivos painéis:

### No Render (Backend -> Environment)
- `DATABASE_URL`: Link de conexão do Supabase.
- `JWT_SECRET`: Chave para segurança de login.
- `MP_ACCESS_TOKEN`: Token de acesso do Mercado Pago.
- `MP_WEBHOOK_SECRET`: Segredo para validar notificações de pagamento.
- `PORT`: Deve ser `3001`.

### No Firebase/GitHub Secrets (Frontend)
- `VITE_API_URL`: `https://sua-url-do-render.com/api`
- `VITE_MP_PUBLIC_KEY`: Sua chave pública do Mercado Pago.

---

## 4. Deploy Manual (Emergência)

Caso o fluxo automático falhe:

**Frontend (Local para Firebase):**
```bash
cd packages/frontend-v2
npm install
npm run build
firebase deploy
```

**Backend (Local):**
Não há deploy manual direto para o Render. Se o deploy travar, vá no painel do Render e clique em **"Manual Deploy" -> "Clear Cache and Deploy"**.
