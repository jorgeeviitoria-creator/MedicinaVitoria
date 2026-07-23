#!/usr/bin/env node
/**
 * extrair-cards.js — puxa flashcards e questões de quiz dos painéis HTML e
 * gera data/cards.json + data/cards.js (agrupado por semestre/matéria).
 *
 * Lida com os 3 formatos vistos nos painéis:
 *   - flashcards: {front:"...", back:"..."}          (aspas ou não nas chaves)
 *   - quiz:       {q:"...", opts:[...], ans:N, exp:"..."}
 *   - imuno monta quizData via .push(); por isso varremos TODOS os objetos {...}
 *     do arquivo e classificamos pela forma, em vez de depender do array.
 *
 * Uso: node scripts/extrair-cards.js
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const DIR_MATERIAS = path.join(RAIZ, 'materias');

/* id estável a partir do texto (djb2) — progresso SM-2 fica preso ao id, não à ordem. */
function hash(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* captura o objeto {...} balanceado começando em `ini` (respeita strings). null se não fechar. */
function capturarObjeto(txt, ini) {
  var prof = 0, i = ini, aspas = null, esc = false;
  for (; i < txt.length; i++) {
    var c = txt[i];
    if (aspas) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { aspas = c; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return txt.slice(ini, i + 1); }
  }
  return null;
}

function objetosDe(txt) {
  var out = [];
  for (var i = 0; i < txt.length; i++) {
    if (txt[i] !== '{') continue;
    var bruto = capturarObjeto(txt, i);
    if (!bruto) continue;
    if (bruto.length > 4000) { continue; } // objetos gigantes não são card
    var obj = null;
    try { obj = (new Function('return (' + bruto + ')'))(); } catch (_) { obj = null; }
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) out.push(obj);
    i += bruto.length - 1; // pula o objeto já lido (evita reprocessar aninhados)
  }
  return out;
}

function limparTexto(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extrairDoArquivo(arquivo, semestre, materia) {
  var txt = fs.readFileSync(arquivo, 'utf8');
  var cards = [];
  var vistos = {};

  objetosDe(txt).forEach(function (o) {
    var frente = null, verso = null;
    if ((o.front != null) && (o.back != null)) {
      frente = limparTexto(o.front); verso = limparTexto(o.back);
    } else if (o.q != null && Array.isArray(o.opts) && typeof o.ans === 'number' && o.opts[o.ans] != null) {
      frente = limparTexto(o.q);
      verso = limparTexto(o.opts[o.ans]) + (o.exp ? ' — ' + limparTexto(o.exp) : '');
    }
    if (!frente || !verso || frente.length < 4) return;
    var chave = frente.toLowerCase();
    if (vistos[chave]) return;
    vistos[chave] = true;
    cards.push({
      id: 'p_' + hash(semestre + '|' + materia + '|' + frente),
      semestre: semestre, materia: materia,
      frente: frente, verso: verso, origem: 'painel',
    });
  });
  return cards;
}

function main() {
  var porMateria = {};
  var totais = 0;

  function scanDir(dir, semestre, materia, periodo) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      var p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!semestre) scanDir(p, e.name, null, null);
        else if (!materia) scanDir(p, semestre, e.name, null);
        else if (!periodo) scanDir(p, semestre, materia, e.name);
        else if (e.name.toLowerCase() === 'paineis') scanDir(p, semestre, materia, periodo + '/paineis');
        else scanDir(p, semestre, materia, periodo);
      } else if (/paineis$/.test(periodo || '') && /\.html?$/i.test(e.name)) {
        var cards = extrairDoArquivo(p, semestre, materia);
        if (cards.length) {
          var k = semestre + '|' + materia;
          (porMateria[k] = porMateria[k] || []).push.apply(porMateria[k], cards);
          totais += cards.length;
          console.log('  ' + cards.length + ' cards <- ' + path.relative(RAIZ, p));
        }
      }
    });
  }

  console.log('Extraindo cards dos painéis...');
  if (fs.existsSync(DIR_MATERIAS)) scanDir(DIR_MATERIAS, null, null, null);

  var saida = { geradoEm: new Date().toISOString(), materias: {} };
  Object.keys(porMateria).forEach(function (k) { saida.materias[k] = porMateria[k]; });

  fs.writeFileSync(path.join(RAIZ, 'data', 'cards.json'), JSON.stringify(saida, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(RAIZ, 'data', 'cards.js'),
    '// Gerado por scripts/extrair-cards.js — não editar à mão.\nwindow.__CARDS__ = ' + JSON.stringify(saida) + ';\n', 'utf8');

  console.log('[ok] ' + totais + ' cards de ' + Object.keys(porMateria).length + ' matéria(s) -> data/cards.json e data/cards.js');
}

main();
