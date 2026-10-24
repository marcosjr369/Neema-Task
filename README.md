# Marcos Tasks

Tarefas, cronómetro de foco, pausas, ranking e gestão de equipas. Next.js 16 + React 19, instalável como PWA.

## Começar

```bash
npm install
cp .env.example .env.local   # opcional: credenciais do Google
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Sem credenciais Google, o ecrã de entrada mostra um login só com nome e email (útil para testar com várias pessoas: usa janelas privadas ou browsers diferentes).

## Fluxo de entrada

`/entrar` é um onboarding em passos, com a mascote (Marcos) a explicar cada um:

1. **Olá** → **Como funciona** (tarefas, cronómetro, XP/ranking, equipas)
2. **Login** com o [Clerk](https://clerk.com): Google, Microsoft, Apple, Facebook, GitHub, email com código… (os que activares no painel do Clerk aparecem sozinhos). Quem já usa a app entra directo.
3. **Como vais usar?** Só para mim / Com a minha empresa
4. Pessoal: **meta diária** de foco. Empresa: **criar** (nome, sector, tamanho, departamentos) ou **código de convite** (ou juntar-se pelo domínio do email)
5. **Pronto**, com os próximos passos

O login é obrigatório e nada fica guardado no browser: tarefas, tempo, definições, cronómetro activo e espaço escolhido vivem na conta (funcionam em qualquer dispositivo). Ao arrancar, a app limpa o `localStorage` e o `sessionStorage` do browser (restos de versões anteriores). Para começar do zero: sem base de dados, apaga a pasta `.data/`; com Supabase, apaga as linhas das tabelas (e os utilizadores no painel do Clerk).

## Tipos de conta

- **Pessoal**: as tuas tarefas, foco e o **ranking global**. Cada pessoa escolhe aparecer com nome, iniciais ou esconder-se.
- **Empresa**: quem cria fica administrador. Os funcionários entram por código/link de convite, pelo domínio do email, ou são adicionados à mão / por CSV (ficam activos quando entram com esse email). Uma pessoa pode ter espaço pessoal e várias empresas, e troca no menu lateral.

### Papéis na empresa

| Papel | Pode |
|---|---|
| Administrador | Tudo: funcionários, departamentos, relatórios, definições |
| Supervisor | Atribuir tarefas e aprovar trabalho no(s) seu(s) departamento(s), ver o tempo da equipa |
| Funcionário | As suas tarefas, cronómetro, anexos, estado, ranking e o próprio relatório |

### Fluxo das tarefas de empresa

`A fazer → Em curso → Enviada para revisão → Aprovada` ou `Devolvida (com comentário) → Em curso`.
Opções por tarefa: precisa de aprovação, exige anexo (não deixa concluir sem comprovativo), recorrência (diária/semanal/mensal: ao concluir cria a próxima), checklist e comentários.

### Presença

Estados: a trabalhar, reunião, formação, pausa, almoço, ausente. O cronómetro muda o estado sozinho (foco → a trabalhar, pausa → pausa). Após 15 min sem actividade, pergunta “Ainda estás aí?” e passa a ausente se não houver resposta. Sem sinal durante 3 min (app fechada), conta como offline. No primeiro acesso à empresa, o funcionário vê e aceita o que é registado.

### Pontos (XP)

1 XP por 5 min de foco · tarefa concluída 8/10/15 XP (prioridade baixa/média/alta) · +5 antes do prazo · +15 se aprovada à primeira · −5 por rejeição. Rankings por pontos, horas e tarefas; por semana, mês ou sempre; na empresa também por departamento.

### Celebrações e lembretes

- **Celebrações** (centro do ecrã, com o Marcos a pular): meta diária, novo nível, sequências de 3/7/14/30/50/100 dias, conquistas e 5/10/20 tarefas no dia.
- **Lembretes de inactividade**: sem cronómetro a correr durante o intervalo escolhido (Perfil → Definições), dentro do horário definido e até cumprires a meta diária. Na empresa não reclama de quem está em pausa, almoço, reunião, formação ou ausente.
  - Com a app aberta: janela com o Marcos triste e notificação.
  - Com a app fechada: notificação **push** enviada pelo servidor (precisa das chaves `VAPID_*` no `.env.local` e de activar em Perfil → Definições → "Lembretes com a app fechada"). No iPhone só funciona com a app instalada no ecrã principal (iOS 16.4+).
  - O servidor verifica a cada 5 minutos ([instrumentation.ts](instrumentation.ts)). Em alojamento sem servidor sempre ligado (ex.: Vercel), agenda `GET /api/cron/reminders` a cada 5 min com `Authorization: Bearer <CRON_SECRET>`.

## Estrutura

```
app/
  api/                 route handlers (auth, me, personal, orgs, files, ranking)
  components/
    layout/            AppShell, navegação lateral/inferior, barra de topo, painel direito
    ui/                Mascot, ícones (categorias/estados), Avatar, Modal, Confetti, Splash…
    tasks/             item, formulário e estado de revisão das tarefas
    focus/             mini-cronómetro, alerta de pausa, celebração
    account/           troca de espaço, estado de presença, consentimento
  context/             AccountContext (sessão, definições), AppContext (tarefas/tempo), OrgContext (empresa)
  lib/                 regras partilhadas (pontos, estatísticas, empresa) e lib/server (dados, auth, permissões)
  empresa/ entrar/ perfil/ ranking/ tarefas/ foco/ estatisticas/   páginas
```

Ícones: [Phosphor](https://phosphoricons.com) (traço "bold" por omissão, "duotone" nos destaques). As categorias e os estados de presença têm ícone próprio em `components/ui/icons.tsx`.

## Backend

Route handlers em `app/api/`; sessões pelo **Clerk** ([proxy.ts](proxy.ts) + `auth()` em [auth.ts](app/lib/server/auth.ts)). Na primeira visita, o perfil do Clerk dá origem à conta na tabela `users` (ligada pelo `clerkId`) e ocupa convites pendentes com o mesmo email, se o Clerk o tiver confirmado.

**Dados** ([store.ts](app/lib/server/store.ts)):
- Com `DATABASE_URL` (Supabase Postgres, "transaction pooler"): cada tabela guarda o objecto em `data` (jsonb) e as colunas de filtro à parte; as tabelas criam-se sozinhas. Cada pedido carrega só o âmbito de que precisa ([scopes.ts](app/lib/server/scopes.ts): utilizador, empresa, período) e `mutate()` grava apenas as linhas novas/alteradas/apagadas, numa transacção com bloqueio (seguro com várias instâncias na Vercel).
- Sem `DATABASE_URL`: ficheiro `.data/db.json` (desenvolvimento sem internet).

**Anexos** ([files.ts](app/lib/server/files.ts)): Supabase Storage (bucket privado `attachments`, criado sozinho) com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; sem eles, `.data/uploads/`.

Permissões em [api.ts](app/lib/server/api.ts); regras de pontuação em [points.ts](app/lib/points.ts), partilhadas com o cliente.
