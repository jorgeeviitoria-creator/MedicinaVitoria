/* revisao.js — flashcards com repetição espaçada (SM-2).
   Baralho próprio, guardado no navegador. Exposto em window.Revisao.
   O agendador é uma função pura (agendar) pra ser testável. */
(function (global) {
  'use strict';

  var UI = global.UI, Manifesto = global.Manifesto;
  var CHAVE = 'revisao-vitoria';

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

  function ler() {
    try { var j = JSON.parse(global.localStorage.getItem(CHAVE) || '{}'); return Array.isArray(j.cards) ? j : { cards: [] }; }
    catch (_) { return { cards: [] }; }
  }
  function gravar(dados) {
    try { global.localStorage.setItem(CHAVE, JSON.stringify(dados)); }
    catch (e) { throw new Error('Não foi possível salvar no navegador.'); }
  }

  /**
   * agendar(card, qualidade) — SM-2. qualidade: 1 (errei), 3 (difícil), 4 (bom), 5 (fácil).
   * Função pura: recebe o card e devolve os novos campos de agendamento.
   */
  function agendar(card, qualidade, hoje) {
    hoje = hoje || hojeISO();
    var ease = card.ease || 2.5;
    var reps = card.repeticoes || 0;
    var intervalo;

    if (qualidade < 3) {
      reps = 0;
      intervalo = 1; // recai; volta a aparecer amanhã
    } else {
      if (reps === 0) intervalo = 1;
      else if (reps === 1) intervalo = 6;
      else intervalo = Math.round((card.intervalo || 1) * ease);
      reps += 1;
    }
    // ajuste do fator de facilidade (mín. 1.3)
    ease = ease + (0.1 - (5 - qualidade) * (0.08 + (5 - qualidade) * 0.02));
    if (ease < 1.3) ease = 1.3;
    ease = Math.round(ease * 1000) / 1000;

    return {
      ease: ease,
      repeticoes: reps,
      intervalo: intervalo,
      proximaRevisao: somarDias(hoje, intervalo),
      ultimaRevisao: hoje,
    };
  }

  function listar() { return ler().cards; }

  function adicionar(materia, semestre, frente, verso) {
    var dados = ler();
    var card = {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      semestre: semestre || '', materia: materia || '',
      frente: frente, verso: verso,
      ease: 2.5, repeticoes: 0, intervalo: 0,
      proximaRevisao: hojeISO(), // novo card já entra como devido hoje
      criadoEm: hojeISO(), ultimaRevisao: null,
    };
    dados.cards.push(card);
    gravar(dados);
    return card;
  }

  function excluir(id) {
    var dados = ler();
    dados.cards = dados.cards.filter(function (c) { return c.id !== id; });
    gravar(dados);
  }

  function revisar(id, qualidade) {
    var dados = ler();
    var card = dados.cards.find(function (c) { return c.id === id; });
    if (!card) return null;
    var nova = agendar(card, qualidade);
    Object.keys(nova).forEach(function (k) { card[k] = nova[k]; });
    gravar(dados);
    return card;
  }

  function devidos() {
    var h = hojeISO();
    return ler().cards.filter(function (c) { return (c.proximaRevisao || h) <= h; });
  }

  function estatisticas() {
    var todos = ler().cards, h = hojeISO();
    var devidosN = todos.filter(function (c) { return (c.proximaRevisao || h) <= h; }).length;
    var novos = todos.filter(function (c) { return !c.ultimaRevisao; }).length;
    return { total: todos.length, devidos: devidosN, novos: novos };
  }

  global.Revisao = {
    agendar: agendar, // pura, p/ testes
    listar: listar, adicionar: adicionar, excluir: excluir,
    revisar: revisar, devidos: devidos, estatisticas: estatisticas,
    hojeISO: hojeISO,
  };
})(window);
