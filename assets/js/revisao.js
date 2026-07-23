/* revisao.js — flashcards com repetição espaçada (SM-2).
   Conteúdo vem de 2 fontes: cards extraídos dos painéis (data/cards.js, só leitura)
   e cards criados pela Vitória. O PROGRESSO (SM-2) fica separado, por id do card,
   então regenerar os cards dos painéis não apaga a revisão.
   Exposto em window.Revisao. O agendador (agendar) é função pura, testável. */
(function (global) {
  'use strict';

  var CHAVE_PROG = 'revisao-progresso-vitoria';
  var CHAVE_USER = 'revisao-cards-vitoria';

  function hojeISO() {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function somarDias(iso, n) {
    var p = String(iso).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function lerJSON(chave, padrao) {
    try { var j = JSON.parse(global.localStorage.getItem(chave)); return j == null ? padrao : j; }
    catch (_) { return padrao; }
  }
  function gravarJSON(chave, v) {
    try { global.localStorage.setItem(chave, JSON.stringify(v)); }
    catch (e) { throw new Error('Não foi possível salvar no navegador.'); }
  }

  /* ---------- conteúdo ---------- */
  var _extraidos = null;
  function cardsExtraidos() {
    if (_extraidos) return _extraidos;
    _extraidos = [];
    var fonte = global.__CARDS__;
    if (fonte && fonte.materias) {
      Object.keys(fonte.materias).forEach(function (k) {
        (fonte.materias[k] || []).forEach(function (c) { _extraidos.push(c); });
      });
    }
    return _extraidos;
  }
  function cardsUsuario() { return lerJSON(CHAVE_USER, []); }

  function todos(filtro) {
    filtro = filtro || {};
    var lista = cardsExtraidos().concat(cardsUsuario());
    if (filtro.semestre) lista = lista.filter(function (c) { return c.semestre === filtro.semestre; });
    if (filtro.materia) lista = lista.filter(function (c) { return c.materia === filtro.materia; });
    return lista;
  }

  /** matérias que têm cards, agrupadas por semestre. */
  function materiasComCards() {
    var mapa = {};
    todos().forEach(function (c) {
      (mapa[c.semestre] = mapa[c.semestre] || {})[c.materia] = true;
    });
    return mapa;
  }

  /* ---------- progresso ---------- */
  function progresso() { return lerJSON(CHAVE_PROG, {}); }
  function comProgresso(c) {
    var p = progresso()[c.id] || {};
    return {
      id: c.id, semestre: c.semestre, materia: c.materia, frente: c.frente, verso: c.verso, origem: c.origem,
      ease: p.ease || 2.5, repeticoes: p.repeticoes || 0, intervalo: p.intervalo || 0,
      proximaRevisao: p.proximaRevisao || hojeISO(), ultimaRevisao: p.ultimaRevisao || null,
    };
  }

  /**
   * agendar(card, qualidade, hoje) — SM-2. qualidade: 1 (errei), 3 (difícil), 4 (bom), 5 (fácil).
   * Pura: recebe {ease,repeticoes,intervalo} e devolve os novos campos.
   */
  function agendar(card, qualidade, hoje) {
    hoje = hoje || hojeISO();
    var ease = card.ease || 2.5, reps = card.repeticoes || 0, intervalo;
    if (qualidade < 3) { reps = 0; intervalo = 1; }
    else {
      if (reps === 0) intervalo = 1;
      else if (reps === 1) intervalo = 6;
      else intervalo = Math.round((card.intervalo || 1) * ease);
      reps += 1;
    }
    ease = ease + (0.1 - (5 - qualidade) * (0.08 + (5 - qualidade) * 0.02));
    if (ease < 1.3) ease = 1.3;
    ease = Math.round(ease * 1000) / 1000;
    return { ease: ease, repeticoes: reps, intervalo: intervalo, proximaRevisao: somarDias(hoje, intervalo), ultimaRevisao: hoje };
  }

  function revisar(id, qualidade) {
    var store = progresso();
    store[id] = agendar(store[id] || {}, qualidade);
    gravarJSON(CHAVE_PROG, store);
    return store[id];
  }

  function devidos(filtro) {
    var h = hojeISO();
    return todos(filtro).map(comProgresso).filter(function (c) { return c.proximaRevisao <= h; });
  }

  function estatisticas(filtro) {
    var h = hojeISO();
    var lista = todos(filtro).map(comProgresso);
    return {
      total: lista.length,
      devidos: lista.filter(function (c) { return c.proximaRevisao <= h; }).length,
      novos: lista.filter(function (c) { return !c.ultimaRevisao; }).length,
    };
  }

  /* ---------- cards do usuário ---------- */
  function adicionar(semestre, materia, frente, verso) {
    var lista = cardsUsuario();
    var card = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      semestre: semestre || '', materia: materia || '', frente: frente, verso: verso, origem: 'usuario',
    };
    lista.push(card);
    gravarJSON(CHAVE_USER, lista);
    return card;
  }
  function excluir(id) {
    if (String(id).indexOf('u_') !== 0) return false; // só cards do usuário
    gravarJSON(CHAVE_USER, cardsUsuario().filter(function (c) { return c.id !== id; }));
    // limpa o progresso órfão
    var store = progresso(); delete store[id]; gravarJSON(CHAVE_PROG, store);
    return true;
  }

  global.Revisao = {
    agendar: agendar,           // pura, p/ testes
    todos: todos, devidos: devidos, estatisticas: estatisticas,
    materiasComCards: materiasComCards, comProgresso: comProgresso,
    revisar: revisar, adicionar: adicionar, excluir: excluir,
    hojeISO: hojeISO,
  };
})(window);
