# Portal de Estudos da Vitória

Portal estático (HTML/CSS/JavaScript puro, **sem backend e sem build step**) que centraliza
material de estudo em HTML — resumos, listas de perguntas, simulados e painéis interativos —
organizado por **semestre → matéria → período (P1/P2/P3)**. Inclui calculadora de notas com
pesos configuráveis e histórico de avaliações persistido no navegador com backup em JSON.

## Rodar localmente

Duas formas:

1. **Abrir direto do disco (mais simples).** Dê duplo-clique em `index.html`. Funciona offline
   porque os dados são carregados via `data/conteudo.js` (variável global), sem `fetch`.
2. **Servir por HTTP (opcional).** Em qualquer servidor estático, por exemplo:
   ```bash
   npx serve site-estudos
   # ou
   python -m http.server 8080
   ```
   Servido por HTTP, o site também consegue ler `data/conteudo.json` / `config-materias.json`
   diretamente via `fetch`.

> As duas formas funcionam. O `fetch` de JSON via `file://` é bloqueado pelos navegadores por
> segurança (CORS), por isso o gerador também emite `data/conteudo.js` com os dados embutidos.

## O que o portal tem

| Página | O que faz |
|---|---|
| `index.html` | Dashboard com as matérias e a situação de notas de cada uma |
| `materia.html` | Materiais por período (P1/P2/P3) + abas **Anotações** e **Trabalhos** (anexos no Google Drive) |
| `agenda.html` | Cronograma de provas com contagem regressiva |
| `calculadora.html` | Notas por **pontos**, com cada item de avaliação configurável |
| `historico.html` | Todos os lançamentos, com edição, exclusão e backup |
| `party.html` | Modo Party: roleta de nomes pra sortear quem responde + placar |
| `ver.html` | Visualizador de material (tela cheia com botão Voltar) |

Extras: **modo noturno** (botão da lua, segue o sistema por padrão), **busca tolerante a typo/acento**
e **PWA** — dá pra instalar na tela inicial do celular e navegar offline nas páginas já visitadas.

Os anexos (upload pro Drive) só funcionam no site publicado, porque dependem das funções em `/api`.

## Estrutura

```
site-estudos/
├── index.html            # Dashboard (cards por matéria)
├── materia.html          # Página de matéria (?semestre=...&materia=...)
├── calculadora.html      # Calculadora de notas
├── historico.html        # Histórico + backup
├── assets/
│   ├── css/  variaveis.css · componentes.css · layout.css
│   └── js/   manifesto.js · calculadora.js · notas.js · componentes-ui.js · app.js
├── data/
│   ├── config-materias.json  # pesos/labels/média mínima por matéria (EDITE À MÃO)
│   ├── conteudo.json         # manifesto gerado (não editar)
│   └── conteudo.js           # mesmo manifesto + config, p/ funcionar em file:// (gerado)
├── materias/<semestre>/<materia>/<periodo>/<tipo>/*.html
└── scripts/gerar-manifesto.js
```

`<tipo>` é o nome de uma pasta que vira um grupo na página da matéria. Tipos já
reconhecidos: `resumos`, `perguntas`, `simulados`, `paineis`, `provas`, `slides`, `aulas`,
`materiais`, `documentos`. Qualquer outro nome de pasta também funciona (vira um grupo com o
próprio nome).

### Formatos de arquivo suportados

O portal não guarda só HTML — serve **qualquer arquivo** que você colocar na pasta:

| Formato | Comportamento ao clicar |
|---|---|
| `.html` | Abre como página, na mesma aba |
| `.pdf` | Abre no visualizador de PDF do navegador, na mesma aba (não baixa) |
| `.png .jpg .gif .webp .svg` | Abre a imagem no navegador |
| `.pptx .docx .xlsx` (slides/docs do professor) | O navegador baixa para abrir no Office |

O título de arquivos que não são HTML vem do **nome do arquivo** (ex.: `prova-2024-1.pdf` →
"Prova 2024 1"), então dê nomes descritivos. Depois de adicionar qualquer arquivo, rode
`node scripts/gerar-manifesto.js`.

## Adicionar material novo

1. Crie/salve o HTML de referência.
2. Coloque em `materias/<semestre>/<materia>/<periodo>/<tipo>/arquivo.html`
   (ex.: `materias/4-semestre/microbiologia-2/p2/resumos/gram-positivas.html`).
3. Rode o gerador de manifesto:
   ```bash
   node scripts/gerar-manifesto.js
   ```
4. Recarregue o site — o item já aparece na matéria. O título vem do `<title>` do HTML.

## Cadastrar matéria nova

1. Adicione a matéria em `data/config-materias.json`, dentro do semestre, com `label`,
   `pesos` (P1/P2/P3, somando 100) e `mediaMinima`.
2. Crie a pasta `materias/<semestre>/<materia>/`.
3. Rode `node scripts/gerar-manifesto.js`.

Matérias sem entrada no config ainda funcionam (o gerador usa o slug capitalizado como
fallback e avisa no console), mas cadastre para ter pesos e média corretos.

## Abrir um semestre novo

1. Crie `materias/<novo-semestre>/`.
2. Cadastre as matérias daquele semestre em `config-materias.json` (novo bloco de semestre).
3. Rode o gerador. O semestre aparece no seletor do dashboard; os anteriores continuam acessíveis.

## Calculadora

- Escolha semestre + matéria, lance P1/P2/P3 (0–10, uma casa decimal).
- Ajuste pesos e média mínima no painel recolhível (pesos precisam somar 100%).
- A média, o status (Aprovado / Em risco / Reprovado) e a nota necessária nas etapas
  pendentes aparecem ao vivo. "Salvar lançamento" grava no navegador e registra no histórico.

## Backup / restauração das notas

As notas ficam no `localStorage` do navegador (chave `notas-vitoria`).

- **Exportar:** página Histórico → "Exportar backup" → baixa `notas-vitoria-backup-AAAA-MM-DD.json`.
- **Importar (outro computador):** copie os arquivos do portal (pen drive / Git), abra o
  Histórico → "Importar backup" → selecione o JSON. A importação valida o schema e pede
  confirmação antes de sobrescrever; um arquivo inválido **não** apaga os dados atuais.

## Notas sobre este conteúdo inicial

Os três materiais já incluídos são de **P2** e foram posicionados em:

- `materias/4-semestre/microbiologia-2/p2/paineis/`
- `materias/4-semestre/biofisica/p2/paineis/`
- `materias/4-semestre/imunologia/p2/paineis/`

`biofisica` e `imunologia` foram adicionadas ao `config-materias.json` porque havia material
real delas; as demais matérias da grade do 4º semestre já estão cadastradas e aparecem no
dashboard como "sem materiais ainda" até receberem HTMLs.

## Deploy estático (opcional)

Publique a pasta `site-estudos/` em GitHub Pages, Netlify ou Vercel (deploy estático, sem
servidor). Sempre rode `node scripts/gerar-manifesto.js` antes de publicar após adicionar conteúdo.
