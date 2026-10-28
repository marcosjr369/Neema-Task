# Udacha

Tarefas, cronómetro de foco, pausas, ranking e gestão de equipas. Next.js 16 + React 19, instalável como PWA.

## Começar

```bash
npm install
cp .env.example .env.local   # opcional: credenciais do Google
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Sem credenciais Google, o ecrã de entrada mostra um login só com nome e email (útil para testar com várias pessoas: usa janelas privadas ou browsers diferentes).

## Fluxo de entrada

`/entrar` é um onboarding em passos, com a mascote (Udacha) a explicar cada um:

1. **Olá** → **Como funciona** (tarefas, cronómetro, XP/ranking, equipas)
2. **Tipo de conta**: Pessoal / Empresa / Tenho um convite
3. Conforme o tipo, **antes do login**:
   - Pessoal: nada (segue para o login)
   - Empresa: **dados da empresa** (nome, área de actuação, tamanho, departamentos)
   - Convite: **código**, validado logo (`GET /api/orgs/convite`): só avança se for de uma empresa registada, e mostra qual
4. **Login / registo** com o [Clerk](https://clerk.com) (Google, Microsoft, Apple, email…). Os dados escolhidos vão no URL de regresso, por isso a seguir a app **cria a empresa** ou **entra na equipa** sozinha. Pessoal: **meta diária** de foco.
5. **Pronto**, com os próximos passos

Quem criou a empresa é o dono: não aparece "Sair da empresa" nem pode ser removido. Sair só existe para quem foi convidado ou adicionado.

O login é obrigatório e nada fica guardado no browser: tarefas, tempo, definições, cronómetro activo e espaço escolhido vivem na conta (funcionam em qualquer dispositivo). Ao arrancar, a app limpa o `localStorage` e o `sessionStorage` do browser (restos de versões anteriores). Para começar do zero: sem base de dados, apaga a pasta `.data/`; com Supabase, apaga as linhas das tabelas (e os utilizadores no painel do Clerk).

## Tipos de conta

O tipo escolhe-se uma vez e não se mistura (`User.accountType`):

- **Pessoal**: as tuas tarefas, foco e o ranking **só entre contas pessoais**. Cada pessoa escolhe aparecer com nome, iniciais ou esconder-se. Se aceitar o convite de uma empresa (link, ou código no Perfil), confirma a conversão e passa a conta de empresa, sem volta.
- **Empresa**: sem espaço pessoal. Quem cria a empresa fica administrador e é quem a gere; outros só gerem se forem adicionados ou promovidos a administrador (ou supervisor, no seu departamento). Os funcionários entram por código/link de convite, pelo domínio do email, ou são adicionados à mão / por CSV (ficam activos quando entram com esse email). O ranking de pessoas só mostra colegas da mesma empresa. Administradores podem criar outras empresas e trocar no menu lateral.
- **Ranking de empresas**: geral, visível para todos (pessoais e empresas). Mostra só o nome da empresa e os totais, ordenado pela média por pessoa activa. Cada empresa pode esconder-se nas Definições (continua a vê-la só a própria equipa).

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

1 XP por 5 min de foco · tarefa concluída 8/10/15 XP (prioridade baixa/média/alta) · +5 antes do prazo · +15 se aprovada à primeira · −5 por rejeição. Rankings por pontos, horas e tarefas; por dia, semana, mês ou sempre; na empresa também por departamento.

### Celebrações e lembretes

- **Celebrações** (centro do ecrã, com a Udacha a pular): meta diária, novo nível, sequências de 3/7/14/30/50/100 dias, conquistas e 5/10/20 tarefas no dia.
- **Lembretes de inactividade**: sem cronómetro a correr durante o intervalo escolhido (Perfil → Definições), dentro do horário definido e até cumprires a meta diária. Na empresa não reclama de quem está em pausa, almoço, reunião, formação ou ausente.
  - Com a app aberta: janela com a Udacha triste e notificação.
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

## Painel de administração

`/marcos/faz` (fora dos motores de busca). Pede o email e a palavra-passe definidos em `ADMIN_PANEL_EMAIL` e `ADMIN_PANEL_PASSWORD` (as acções sensíveis voltam a pedir só a palavra-passe); depois de entrar, o browser recebe um cookie `httpOnly` assinado com `ADMIN_SESSION_SECRET` (válido 12 h; mudar qualquer uma das duas variáveis termina as sessões). Cinco tentativas erradas bloqueiam esse IP durante 15 minutos.

Menu lateral com cinco páginas (o período 7/30/90 dias aplica-se às três primeiras):

- **Visão geral**: indicadores, gráficos por dia, registos recentes e empresas mais activas
- **Utilizadores** · **Empresas**: tabelas completas (abaixo). Cada nome abre a **ficha**:
  - utilizador (`/marcos/faz/utilizadores/[id]`): dados da conta, nível/XP, foco, sequência, dias activos, gráficos por dia, foco por categoria, empresas (papel, departamento, estado), tarefas e sessões recentes; desactivar / reactivar / eliminar
  - empresa (`/marcos/faz/empresas/[id]`): dados (código, domínio, criador), funcionários com estado e números, departamentos, quem está a trabalhar agora, gráficos, tarefas
- **Ranking**: empresas (média por pessoa), contas pessoais e funcionários de cada empresa; por XP, horas ou tarefas; hoje, semana, mês ou sempre. Mostra nomes reais e marca quem está escondido do ranking público
- **Eliminados**: registo de quem foi eliminado (nome, email, tipo, empresas, datas, foco e tarefas de sempre, motivo). Os dados da pessoa já não existem; fica só este resumo, na tabela `deleted`

- Métricas: utilizadores (pessoais, empresa, por escolher, desactivados), activos hoje / 7 / 30 dias, empresas, registos, foco e tarefas no período (7, 30 ou 90 dias)
- Gráficos por dia: registos por tipo de conta, utilizadores activos, horas de foco, tarefas concluídas (cada um com vista em tabela)
- Utilizadores: pesquisa, filtros, última actividade, foco e XP; **desactivar / reactivar** (pede a palavra-passe; bloqueia também no Clerk e termina as sessões)
- **Eliminar** de vez: abre uma confirmação que pede outra vez a palavra-passe. Pode indicar um motivo. Apaga a conta (também no Clerk), o espaço pessoal e a ligação às empresas; empresa em que era a única pessoa é apagada; se era o único administrador, o funcionário mais antigo passa a administrador
- Empresas: administradores, pessoas, foco, tarefas e XP
