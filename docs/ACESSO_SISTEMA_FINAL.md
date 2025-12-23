# 🎉 SISTEMA CRED30 ONLINE - INSTRUÇÕES DE ACESSO

## ✅ Status Atual

**ngrok está funcionando corretamente!**

- **URL ngrok**: https://2830c6066fa5.ngrok-free.app
- **Porta**: 3003 (backend)
- **Status**: Tunnel ativo e funcionando

## 🌐 URLs de Acesso

### Acesso Externo (ngrok)

```
Frontend:    https://2830c6066fa5.ngrok-free.app
API:         https://2830c6066fa5.ngrok-free.app/api
Dashboard:    https://2830c6066fa5.ngrok-free.app/admin
```

### Acesso Local (se estiver na mesma máquina)

```
Frontend:    http://localhost:5173
API:         http://localhost:5173/api
Dashboard:    http://localhost:5173/admin
```

## 👥 Credenciais de Acesso

### Usuários para Teste

#### Administrador

- **Email**: admin@cred30.com
- **Senha**: admin123

#### Cliente

- **Email**: joao@cred30.com
- **Senha**: cliente123

## 🚀 Como Acessar o Sistema

### Passo 1: Acessar o Frontend

Abra seu navegador e acesse:

```
https://2830c6066fa5.ngrok-free.app
```

### Passo 2: Fazer Login

1. Use as credenciais de administrador ou cliente
2. Clique em "Entrar"
3. Será redirecionado para o dashboard correspondente

### Passo 3: Explorar as Funcionalidades

#### Dashboard Administrativo

- **Acesso**: https://2830c6066fa5.ngrok-free.app/admin
- **Funcionalidades**:
  - Gerenciar membros
  - Aprovar/rejeitar transações
  - Aprovar/rejeitar apoios mútuos
  - Distribuir excedentes operacionais
  - Visualizar métricas financeiras

#### Dashboard Cliente

- **Acesso**: https://2830c6066fa5.ngrok-free.app (após login cliente)
- **Funcionalidades**:
  - Adquirir participações no clube
  - Solicitar apoios mútuos
  - Realizar saques
  - Indicar amigos
  - Visualizar extrato

## 🧪 Testes Recomendados

### Teste 1: Funcionalidade Básica

1. Faça login como cliente
2. Verifique o saldo inicial
3. Navegue pelas seções do dashboard

### Teste 2: Investimento em Cotas

1. Acesse "Participar"
2. Adquira 1 participação (R$ 50,00)
3. Verifique se aparece na carteira

### Teste 3: Empréstimo

1. Acesse "Apoios Mútuos"
2. Solicite R$ 100,00 em 1 reposição
3. Aguarde aprovação do administrador

### Teste 4: Saque

1. Após ter saldo, acesse "Saques"
2. Solicite saque de R$ 10,00
3. Aguarde aprovação

## 🛠️ Verificação Técnica

### Testar API Diretamente

```bash
# Health check
curl https://2830c6066fa5.ngrok-free.app/api/health

# Login admin
curl -X POST https://2830c6066fa5.ngrok-free.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cred30.com","password":"admin123"}'
```

### Verificar Status dos Serviços

```bash
# Verificar containers Docker
docker-compose -f docker-compose.single-ngrok.yml ps

# Verificar logs
docker-compose -f docker-compose.single-ngrok.yml logs -f
```

## 📱 Compartilhamento para Testes

### Para Compartilhar com Usuários

Envie esta mensagem:

```
🚀 SISTEMA CRED30 DISPONÍVEL PARA TESTES

📱 Acesso: https://2830c6066fa5.ngrok-free.app

👤 Usuários:
Admin: admin@cred30.com / admin123
Cliente: joao@cred30.com / cliente123

💰 Funcionalidades:
- Participação em cotas (R$ 50,00 cada)
- Apoios Mútuos (20% taxa de manutenção)
- Saques (taxa de 2% ou R$ 5,00)
- Sistema de indicações (R$ 5,00 por indicação)
- Níveis VIP (Bronze, Prata, Ouro)

⚠️ IMPORTANTE: Sistema em ambiente de teste. Use apenas dados fictícios.
```

## 🔒 Considerações de Segurança

### Ambiente de Teste

- ✅ Dados são simulados e controlados
- ✅ Use apenas credenciais fornecidas
- ✅ Não use dados reais ou sensíveis
- ⚠️ URL é pública - compartilhe com cuidado

### Recomendações

1. **Mantenha o ngrok ativo** apenas durante testes
2. **Monitore os acessos** regularmente
3. **Use senhas fortes** para produção
4. **Limpe dados** após os testes se necessário

## 🔄 Manutenção do Sistema

### Para Reiniciar Serviços

```bash
# Parar tudo
docker-compose -f docker-compose.single-ngrok.yml down

# Reiniciar
docker-compose -f docker-compose.single-ngrok.yml up -d

# Reiniciar ngrok
ngrok http 3003 --log=stdout
```

### Para Limpar Dados

```bash
# Reset completo do banco
cd backend
node scripts/reset-database-completely.js
```

## 📊 Monitoramento

### Métricas Importantes

- **Usuários cadastrados**: Verificar no dashboard admin
- **Transações pendentes**: Aprovar no painel administrativo
- **Empréstimos solicitados**: Analisar e aprovar
- **Sistema financeiro**: Verificar caixa e lucros

### Logs Úteis

```bash
# Logs do sistema
docker-compose -f docker-compose.single-ngrok.yml logs

# Logs específicos
docker logs cred30-backend-single
docker logs cred30-frontend-single
docker logs cred30-db-single
```

## 🎯 Próximos Passos

1. **Teste todas as funcionalidades** como cliente
2. **Teste as funcionalidades admin** como administrador
3. **Valide o fluxo completo** de investimento → empréstimo → saque
4. **Colete feedback** dos usuários teste
5. **Documente bugs** ou melhorias necessárias

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique o status do ngrok**:
   - A janela do ngrok deve estar ativa
   - A URL deve estar acessível

2. **Verifique os containers Docker**:
   - Todos os containers devem estar "running"
   - Não deve haver erros nos logs

3. **Reinicie tudo do zero**:
   ```bash
   docker-compose -f docker-compose.single-ngrok.yml down -v
   docker system prune -f
   ngrok http 3003 --log=stdout
   ```

---

## 🎉 PARABÉNS!

O sistema Cred30 está completamente funcional e acessível via internet. Você pode:

- ✅ Acessar o frontend via navegador
- ✅ Testar todas as funcionalidades
- ✅ Compartilhar a URL com usuários teste
- ✅ Validar o conceito da plataforma

Aproveite para testar e validar sua plataforma financeira! 🚀
