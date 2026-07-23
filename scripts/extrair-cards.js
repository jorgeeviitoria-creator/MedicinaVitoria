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
  var cards = [], quiz = [];
  var vistosC = {}, vistosQ = {};

  objetosDe(txt).forEach(function (o) {
    var ehQuiz = o.q != null && Array.isArray(o.opts) && typeof o.ans === 'number' && o.opts[o.ans] != null && o.opts.length >= 2;

    // ---- flashcard (Revisão) ----
    var frente = null, verso = null;
    if ((o.front != null) && (o.back != null)) {
      frente = limparTexto(o.front); verso = limparTexto(o.back);
    } else if (ehQuiz) {
      frente = limparTexto(o.q);
      verso = limparTexto(o.opts[o.ans]) + (o.exp ? ' — ' + limparTexto(o.exp) : '');
    }
    if (frente && verso && frente.length >= 4) {
      var ck = frente.toLowerCase();
      if (!vistosC[ck]) {
        vistosC[ck] = true;
        cards.push({ id: 'p_' + hash(semestre + '|' + materia + '|' + frente), semestre: semestre, materia: materia, frente: frente, verso: verso, origem: 'painel' });
      }
    }

    // ---- questão de simulado (múltipla escolha, guarda as opções) ----
    if (ehQuiz) {
      var perg = limparTexto(o.q);
      var qk = perg.toLowerCase();
      if (perg.length >= 4 && !vistosQ[qk]) {
        vistosQ[qk] = true;
        quiz.push({
          id: 'q_' + hash(semestre + '|' + materia + '|' + perg),
          semestre: semestre, materia: materia,
          pergunta: perg,
          opcoes: o.opts.map(limparTexto),
          correta: o.ans,
          explicacao: o.exp ? limparTexto(o.exp) : '',
        });
      }
    }
  });
  return { cards: cards, quiz: quiz };
}

function main() {
  var cardsPorMateria = {}, quizPorMateria = {};
  var totC = 0, totQ = 0;

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
        var r = extrairDoArquivo(p, semestre, materia);
        var k = semestre + '|' + materia;
        if (r.cards.length) { (cardsPorMateria[k] = cardsPorMateria[k] || []).push.apply(cardsPorMateria[k], r.cards); totC += r.cards.length; }
        if (r.quiz.length) { (quizPorMateria[k] = quizPorMateria[k] || []).push.apply(quizPorMateria[k], r.quiz); totQ += r.quiz.length; }
        if (r.cards.length || r.quiz.length) console.log('  ' + r.cards.length + ' cards, ' + r.quiz.length + ' questões <- ' + path.relative(RAIZ, p));
      }
    });
  }

  console.log('Extraindo dos painéis...');
  if (fs.existsSync(DIR_MATERIAS)) scanDir(DIR_MATERIAS, null, null, null);

  function escrever(nome, glob, porMateria) {
    var saida = { geradoEm: new Date().toISOString(), materias: porMateria };
    fs.writeFileSync(path.join(RAIZ, 'data', nome + '.json'), JSON.stringify(saida, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(RAIZ, 'data', nome + '.js'),
      '// Gerado por scripts/extrair-cards.js — não editar à mão.\nwindow.' + glob + ' = ' + JSON.stringify(saida) + ';\n', 'utf8');
  }
  escrever('cards', '__CARDS__', cardsPorMateria);
  escrever('simulado', '__SIMULADO__', quizPorMateria);

  console.log('[ok] ' + totC + ' cards -> data/cards.*');
  console.log('[ok] ' + totQ + ' questões de simulado -> data/simulado.*');
}

main();
