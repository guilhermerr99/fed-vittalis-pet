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

## Estrutura

```
src/app/
  app.ts, app.html     casca do sistema (topo e navegação)
  app.routes.ts        rotas das três áreas, carregadas sob demanda
  areas/               uma página por área (veterinário, gestão, cliente)
src/styles.scss        tokens visuais (base neutra, cor só em status e dados)
```

O visual segue o protótipo aprovado, pensado para notebook de 1366x768.

## Dados

Nenhum dado real de cliente entra no repositório.
