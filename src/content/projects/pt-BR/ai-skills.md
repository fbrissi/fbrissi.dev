---
title: "ai-skills"
description: "Uma biblioteca pessoal de skills e agentes para Claude Code e outras ferramentas de IA que transforma o trabalho do dia a dia, do planejamento de tickets ao code review, QA e decisão de merge, em fluxos repetíveis."
url: "https://github.com/fbrissi/ai-skills"
stack:
  - Agent Skills
  - Claude Code
  - OpenCode
  - Codex CLI
  - Rulesync
  - Bash
  - GitHub CLI
order: 3
---

O `ai-skills` é uma biblioteca pública, com licença MIT, de skills reutilizáveis para agentes de IA que programam. Cada skill é um procedimento escrito que o agente segue para uma tarefa específica, como revisar um pull request ou rodar QA no navegador, com as entradas, os passos e as verificações que dizem quando o trabalho terminou.

[Explore o repositório no GitHub](https://github.com/fbrissi/ai-skills).

## Uma fonte, várias ferramentas

As skills seguem o formato aberto [Agent Skills](https://agentskills.io) e funcionam no Claude Code, OpenCode, Codex CLI, Cursor e GitHub Copilot. O código-fonte fica em uma única pasta `.rulesync/`, e o [Rulesync](https://github.com/dyoshikawa/rulesync) gera a partir dela a pasta de cada ferramenta e o plugin do Claude Code. Uma alteração é escrita uma vez e chega a todas.

A instalação é feita pelo CLI `skills`, por projeto ou por usuário, ou pelo plugin `ai-skills` do Claude Code. As releases são versionadas, então cada projeto pode fixar a versão de que depende.

## As skills

| Grupo | Skills |
| --- | --- |
| Tickets | `ticket-plan`, `ticket-ask`, `ticket-create` |
| Pull requests | `pr-create`, `pr-fix`, `pr-checks`, `review-changes` |
| Orquestração | `dev`, `ship`, `todo` |
| Qualidade | `bdd-scenarios`, `qa-e2e`, `quality-cycle` |
| Operações | `observability-triage`, `merge-risk` |
| Diretrizes | `learn`, `skill-authoring` |
| Brasil | `inpi-trademark-watch`, `nfse-technical-note-analysis` |

Algumas delas na prática:

- **`review-changes`** revisa alterações locais, uma branch ou um pull request, dá uma nota de 1 a 5 estrelas com os apontamentos ordenados por severidade e pode publicar uma review formal com comentários inline.
- **`dev`** implementa um ticket de ponta a ponta: entende o código, faz a menor alteração completa, valida e entrega para PR ou publica.
- **`pr-fix`** lê os comentários de review e o CI quebrado, corrige o que procede e responde cada thread com a correção ou com uma discordância fundamentada.
- **`qa-e2e`** executa cenários BDD em um navegador real, em desktop e mobile, e devolve um veredito de aprovação ou de mudanças necessárias com screenshots.
- **`quality-cycle`** alterna review, QA e correções em uma branch até o revisor e o QA aprovarem, respeitando um limite de rodadas.

## Agentes construídos sobre as skills

Para o Claude Code, o repositório também traz agentes que combinam as skills. Os workers (`code-reviewer`, `qa-tester`, `developer`, `ci-investigator`) fazem uma tarefa em um contexto isolado. Os orquestradores (`milestone-delivery`, `pr-shepherd`, `incident-responder` e outros) delegam para eles, por exemplo levando as issues de uma milestone por implementação, review, QA e pull request. Os agentes que podem fazer merge só o fazem com auto-merge ativado, aprovação humana e uma nota de risco dentro do limite.

## Onde roda

O workflow reutilizável de Code Review do [`fbrissi/github-actions`](https://github.com/fbrissi/github-actions) instala a `review-changes` a partir de uma release fixada do `ai-skills`, e os pull requests deste site passam por esse workflow.

## Competências demonstradas

- **Engenharia de IA:** fluxos de agentes com entradas, passos, critérios de parada e pontos de controle humano explícitos
- **Ferramentas para desenvolvedores:** uma única fonte gerada para várias ferramentas, distribuída como plugin e por CLI
- **Entrega:** automação de review, QA e CI que se encaixa no fluxo normal de pull requests
- **Engenharia de release:** releases versionadas que os consumidores fixam
