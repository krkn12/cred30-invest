# Guia de Deploy - Projeto Cred30

Este documento explica como realizar o deploy do Frontend e do Backend, além de como verificar se as atualizações foram aplicadas com sucesso.

---

## 1. Como realizar o Deploy

O projeto está configurado com **Integração Contínua (CI/CD)**. Isso significa que você não precisa fazer o deploy manualmente via terminal na maioria das vezes.

### Fluxo Completo de Lançamento (Recomendado)
Para atualizar a versão e enviar para produção em um único comando:
```bash
npm run release
```
*Este comando executa o `bump` (+0.0.1) e o `deploy` automaticamente.*

### Componentes Internos
Caso queira rodar os passos separadamente:
- `npm run bump`: Apenas incrementa a versão em todos os pacotes.
- `npm run deploy`: Apenas gera a build e envia para os servidores.

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

## 4. Deploy Manual

Caso a automação falhe ou você prefira fazer manualmente:

### Frontend (Local para Firebase)
Execute estes comandos na raiz do projeto:
```bash
# 1. Gerar os arquivos de produção
npm run build:frontend

# 2. Enviar para o Firebase Hosting
firebase deploy --only hosting
```

### Backend (Render)
O Render não permite um comando direto de terminal como o Firebase, mas você pode forçar o deploy pelo painel:
1. Acesse o dashboard do [Render](https://dashboard.render.com/).
2. Abra o seu projeto de Backend.
3. Clique no botão azul **"Manual Deploy"**.
4. Escolha **"Clear Cache and Deploy"** (recomendado para garantir que pegue as novas variáveis de ambiente).

---

## 5. Como saber se foi atualizado?

### No Frontend
- Abra o site e aperte `F12` -> aba `Network`.
- Recarregue a página (`Ctrl + F5`) para garantir que não está pegando cache antigo.
- O horário do arquivo `index.html` ou as novas funcionalidades (como o pagamento por cartão) devem aparecer.

### No Backend
- No painel do Render, vá em **Logs**.
- Se você vir mensagens novas (ex: `[WEBHOOK MP] Assinatura Validada`), significa que a nova versão está ativa.
