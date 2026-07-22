#!/usr/bin/env node
/**
 * gerar-manifesto.js
 * Varre materias/<semestre>/<materia>/<periodo>/<tipo>/*.html e monta data/conteudo.json.
 * Idempotente: pode rodar quantas vezes quiser sem duplicar/corromper dados.
 *
 * Uso: node scripts/gerar-manifesto.js
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const DIR_MATERIAS = path.join(RAIZ, 'materias');
const DIR_DATA = path.join(RAIZ, 'data');
const CONFIG_PATH = path.join(DIR_DATA, 'config-materias.json');
const SAIDA_JSON = path.join(DIR_DATA, 'conteudo.json');
const SAIDA_JS = path.join(DIR_DATA, 'conteudo.js');

// Mapeia nome de pasta de tipo -> rótulo singular usado no manifesto.
const TIPOS = {
  resumos: 'resumo',
  perguntas: 'perguntas',
  simulados: 'simulado',
  paineis: 'painel',
  painéis: 'painel',
  provas: 'prova',
  slides: 'slide',
  aulas: 'aula',
  materiais: 'material',
  pdfs: 'pdf',
  documentos: 'documento',
};

// Extensões indexadas. PDF e imagens abrem inline no navegador; office (ppt/doc/xls) baixam.
const EXT_INDEXADAS = /\.(html?|pdf|pptx?|docx?|xlsx?|png|jpe?g|gif|webp|svg)$/i;

// Formato normalizado a partir da extensão (usado pela UI p/ ícone).
function formatoDe(nomeArquivo) {
  var m = nomeArquivo.match(/\.([a-z0-9]+)$/i);
  if (!m) return 'arquivo';
  var e = m[1].toLowerCase();
  if (e === 'htm') return 'html';
  if (e === 'jpeg') return 'jpg';
  return e;
}

function lerConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.warn('[aviso] data/config-materias.json não encontrado. Rótulos usarão fallback.');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('[erro] config-materias.json inválido:', e.message);
    return {};
  }
}

function capitalizarSlug(slug) {
  return slug
    .split('-')
    .map((p) => (p.length ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
}

function extrairTitulo(caminhoHtml, nomeArquivo) {
  try {
    const html = fs.readFileSync(caminhoHtml, 'utf8');
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m && m[1].trim()) {
      return m[1].replace(/\s+/g, ' ').trim();
    }
  } catch (_) { /* ignora, usa fallback */ }
  return capitalizarSlug(nomeArquivo.replace(/\.html?$/i, ''));
}

function listarDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
}

function main() {
  const config = lerConfig();

  const semestres = [];
  const materias = [];
  const itens = [];

  if (!fs.existsSync(DIR_MATERIAS)) {
    console.error('[erro] pasta materias/ não existe. Nada a gerar.');
  }

  for (const entSem of listarDir(DIR_MATERIAS)) {
    if (!entSem.isDirectory()) continue;
    const semestreSlug = entSem.name;
    const cfgSem = config[semestreSlug] || {};
    const semestreLabel = cfgSem.label || capitalizarSlug(semestreSlug);
    semestres.push({ slug: semestreSlug, label: semestreLabel });

    const dirSem = path.join(DIR_MATERIAS, semestreSlug);
    for (const entMat of listarDir(dirSem)) {
      if (!entMat.isDirectory()) continue;
      const materiaSlug = entMat.name;
      const cfgMat = (cfgSem.materias && cfgSem.materias[materiaSlug]) || null;
      let materiaLabel;
      if (cfgMat && cfgMat.label) {
        materiaLabel = cfgMat.label;
      } else {
        materiaLabel = capitalizarSlug(materiaSlug);
        console.warn(
          `[aviso] matéria "${materiaSlug}" (${semestreSlug}) sem entrada em config-materias.json. ` +
          `Usando fallback "${materiaLabel}". Cadastre-a para pesos/média corretos.`
        );
      }
      materias.push({ slug: materiaSlug, label: materiaLabel, semestre: semestreSlug });

      const dirMat = path.join(dirSem, materiaSlug);
      for (const entPer of listarDir(dirMat)) {
        if (!entPer.isDirectory()) continue;
        const periodo = entPer.name.toUpperCase(); // p1 -> P1
        const dirPer = path.join(dirMat, entPer.name);
        for (const entTipo of listarDir(dirPer)) {
          if (!entTipo.isDirectory()) continue;
          const tipoPasta = entTipo.name.toLowerCase();
          const tipo = TIPOS[tipoPasta] || tipoPasta;
          const dirTipo = path.join(dirPer, entTipo.name);
          for (const entArq of listarDir(dirTipo)) {
            if (!entArq.isFile()) continue;
            if (!EXT_INDEXADAS.test(entArq.name)) continue;
            const caminhoAbs = path.join(dirTipo, entArq.name);
            const rel = path
              .relative(RAIZ, caminhoAbs)
              .split(path.sep)
              .join('/');
            const formato = formatoDe(entArq.name);
            const baseNome = entArq.name.replace(/\.[a-z0-9]+$/i, '');
            const id = [semestreSlug, materiaSlug, periodo, tipoPasta, baseNome].join('_');
            const stat = fs.statSync(caminhoAbs);
            // <title> só faz sentido em HTML; nos demais o título vem do nome do arquivo.
            const titulo = formato === 'html'
              ? extrairTitulo(caminhoAbs, entArq.name)
              : capitalizarSlug(baseNome);
            itens.push({
              id,
              semestre: semestreSlug,
              materia: materiaSlug,
              periodo,
              tipo,
              formato,
              titulo,
              arquivo: rel,
              dataModificacao: stat.mtime.toISOString().slice(0, 10),
            });
          }
        }
      }
    }
  }

  // ordena de forma estável (determinístico -> idempotente)
  semestres.sort((a, b) => a.slug.localeCompare(b.slug));
  materias.sort((a, b) => (a.semestre + a.slug).localeCompare(b.semestre + b.slug));
  itens.sort((a, b) => a.id.localeCompare(b.id));

  const manifesto = {
    geradoEm: new Date().toISOString(),
    semestres,
    materias,
    itens,
  };

  if (!fs.existsSync(DIR_DATA)) fs.mkdirSync(DIR_DATA, { recursive: true });
  fs.writeFileSync(SAIDA_JSON, JSON.stringify(manifesto, null, 2) + '\n', 'utf8');

  // versão .js para funcionar abrindo o site direto do disco (file://), sem servidor.
  // Embute também o config-materias para que pesos/labels funcionem em file://.
  const js =
    '// Gerado automaticamente por scripts/gerar-manifesto.js — não editar à mão.\n' +
    'window.__CONTEUDO__ = ' + JSON.stringify(manifesto) + ';\n' +
    'window.__CONFIG_MATERIAS__ = ' + JSON.stringify(config) + ';\n';
  fs.writeFileSync(SAIDA_JS, js, 'utf8');

  console.log(
    `[ok] manifesto gerado: ${semestres.length} semestre(s), ${materias.length} matéria(s), ${itens.length} item(ns).`
  );
  console.log(`      -> ${path.relative(RAIZ, SAIDA_JSON)}`);
  console.log(`      -> ${path.relative(RAIZ, SAIDA_JS)}`);
}

main();
