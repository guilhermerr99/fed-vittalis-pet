# fed-vittalis-pet

Frontend do sistema **Vittalis Pet** (Reino Animal VAL LTDA), em Angular.

Três áreas de uso: **veterinário** (atendimento), **gestão** e **cliente** (portal do tutor, PWA). A API fica em `srv-vittalis-pet`, e a documentação técnica em `srv-vittalis-pet/docs`.

## Requisitos

- Node.js 24 e npm

## Comandos

```bash
npm install
npm start          # http://localhost:4200
npm test           # testes (Vitest)
npm run build      # build de produção em dist/
```

O `npm start` encaminha as chamadas `/api` para a API em `http://localhost:8080` (arquivo `proxy.conf.json`), então não há problema de CORS no desenvolvimento. Suba a API antes (veja o README do `srv-vittalis-pet`).

## Acesso e perfis

A entrada é pela tela de login. Cada perfil abre a sua área, e o menu mostra só o que o perfil pode ver:

| Perfil | Menu |
|---|---|
| Veterinário | Atendimento |
| Gestão | Painel, Usuários, Auditoria |
| Suporte técnico | Usuários |

O token de acesso fica só em memória. O de renovação fica no `sessionStorage`: recarregar a página mantém o login, e fechar a aba encerra o acesso. Usuário criado por outra pessoa entra com senha provisória e precisa trocá-la no primeiro acesso.

## Estrutura

```
src/app/
  app.ts, app.html     casca do sistema (topo e navegação)
  app.routes.ts        rotas com guardas por perfil, carregadas sob demanda
  core/auth/           sessão, interceptador de token (renova no 401) e guardas
  pages/               login, alterar senha, usuários e auditoria
  pages/configuracoes/ planos, procedimentos, cobertura (com importação) e parâmetros
  pages/tutores/       tutores e animais (formulários reutilizados na contratação)
  pages/contratos/     nova contratação em passos, lista e detalhe do contrato
  shared/              ícones e formatação de dinheiro (centavos)
  areas/               áreas ainda em construção (veterinário, gestão, cliente)
src/styles.scss        tokens visuais (base neutra, cor só em status e dados)
```

O visual segue o protótipo aprovado, pensado para notebook de 1366x768.

## Dados

Nenhum dado real de cliente entra no repositório.
