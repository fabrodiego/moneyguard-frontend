# MoneyGuard Frontend

Interface web do **MoneyGuard**, controle financeiro pessoal. Funciona no PC e no celular (inclusive como app na tela inicial do iPhone).

## Stack
- Angular 22 (standalone, signals, zoneless) + TypeScript
- SCSS com tema preto e ciano
- Gráficos em SVG próprio (sem biblioteca), com tooltip e visão em tabela
- Nginx (imagem não-root) servindo o build

## Telas
| Rota | Conteúdo |
|---|---|
| `/login`, `/cadastro` | Entrar e criar conta |
| `/` | Visão geral: mês, trimestre, semestre ou ano; rendas x gastos; ranking por categoria; metas |
| `/lancamentos` | Lançamentos do mês com filtros; criar, editar e excluir |
| `/categorias` | Categorias de gasto e de renda |
| `/empresas` | Empresas ligadas a categorias (usadas pelo bot do Discord) |
| `/metas` | Metas, aportes, retiradas e quanto guardar por mês |

## Desenvolvimento
```bash
npm ci
npm start          # http://localhost:4200, API em http://localhost:8080
npm test           # testes unitários (Vitest)
npm run build      # build de produção em dist/
```

A URL da API fica em `src/environments/` (produção: `https://api-moneyguard.fabrodiego.com`).
