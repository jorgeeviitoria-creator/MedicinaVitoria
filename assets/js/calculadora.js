/* calculadora.js — sistema de notas por PONTOS, totalmente configurável.
   Cada item de avaliação pode ser ligado/desligado e ter a pontuação editada.
   Exposto em window.Calc.

   Modelo sem prática (100): P1 20 · P2 20 · P3 40 · escrito 5 · apresentado 5 · Linea 5 · assistência 2 · bitácoras 3
   Modelo com prática (110): P1 20 +5 · P2 20 +5 · P3 30 +10 · (mesmos extras)
*/
(function (global) {
  'use strict';

  /** Catálogo padrão. `ativoPadrao` define o que já vem ligado. */
  var CATALOGO = [
    { id: 'P1', label: 'P1', max: 20, ativoPadrao: true, grupo: 'Provas' },
    { id: 'P1_PRAT', label: 'P1 prática', max: 5, ativoPadrao: false, grupo: 'Provas' },
    { id: 'P2', label: 'P2', max: 20, ativoPadrao: true, grupo: 'Provas' },
    { id: 'P2_PRAT', label: 'P2 prática', max: 5, ativoPadrao: false, grupo: 'Provas' },
    { id: 'P3', label: 'P3', max: 40, ativoPadrao: true, grupo: 'Provas' },
    { id: 'P3_PRAT', label: 'P3 prática', max: 10, ativoPadrao: false, grupo: 'Provas' },
    { id: 'TRAB_ESCRITO', label: 'Trabalho escrito', max: 5, ativoPadrao: true, grupo: 'Outros' },
    { id: 'TRAB_APRESENTADO', label: 'Trabalho apresentado', max: 5, ativoPadrao: true, grupo: 'Outros' },
    { id: 'LINEA', label: 'Linea / Trivia', max: 5, ativoPadrao: true, grupo: 'Outros' },
    { id: 'ASSISTENCIA', label: 'Assistência', max: 2, ativoPadrao: true, grupo: 'Outros' },
    { id: 'BITACORAS', label: 'Bitácoras', max: 3, ativoPadrao: true, grupo: 'Outros' },
  ];

  /** Itens de um dos dois modelos prontos. */
  function preset(temPratica) {
    return CATALOGO.map(function (c) {
      var it = { id: c.id, label: c.label, max: c.max, ativo: c.ativoPadrao, grupo: c.grupo };
      if (temPratica) {
        if (/_PRAT$/.test(c.id)) it.ativo = true;
        if (c.id === 'P3') it.max = 30;
      }
      return it;
    });
  }

  /** Só os itens que contam (ligados e com pontuação > 0). */
  function ativos(itens) {
    return (itens || []).filter(function (i) { return i.ativo && Number(i.max) > 0; });
  }

  function totalPossivel(itens) {
    return ativos(itens).reduce(function (a, c) { return a + Number(c.max); }, 0);
  }

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /** Cria um item personalizado com id único. */
  function novoItem(label, max) {
    var base = String(label || 'Item').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'ITEM';
    return { id: 'X_' + base + '_' + Date.now().toString(36), label: label || 'Item', max: Number(max) || 0, ativo: true, grupo: 'Outros', custom: true };
  }

  /**
   * calcularSituacao(notas, itens, minimaPontos) — considera só os itens ativos.
   * @returns {{ganhos,total,lancados,pendentes,possivelRestante,maximoPossivel,
   *            faltam,jaGarantido,atingivel,percentual,status,texto}}
   */
  function calcularSituacao(notas, itens, minimaPontos) {
    notas = notas || {};
    var comps = ativos(itens);
    var ganhos = 0, possivelRestante = 0;
    var lancados = [], pendentes = [];
    comps.forEach(function (c) {
      var v = num(notas[c.id]);
      if (v == null) { pendentes.push(c.id); possivelRestante += Number(c.max); }
      else { lancados.push(c.id); ganhos += v; }
    });
    var total = totalPossivel(comps);
    var maximoPossivel = ganhos + possivelRestante;
    var faltam = Math.max(0, minimaPontos - ganhos);
    var jaGarantido = ganhos >= minimaPontos - 1e-9;
    var atingivel = maximoPossivel >= minimaPontos - 1e-9;

    var status = 'neutro', texto = 'Sem notas ainda';
    if (lancados.length) {
      if (pendentes.length === 0) {
        status = jaGarantido ? 'sucesso' : 'erro';
        texto = jaGarantido ? 'Aprovado' : 'Reprovado';
      } else if (jaGarantido) { status = 'sucesso'; texto = 'Aprovando'; }
      else if (!atingivel) { status = 'erro'; texto = 'Reprovado'; }
      else { status = 'alerta'; texto = 'Em risco'; }
    }
    return {
      ganhos: ganhos, total: total, lancados: lancados, pendentes: pendentes,
      possivelRestante: possivelRestante, maximoPossivel: maximoPossivel,
      faltam: faltam, jaGarantido: jaGarantido, atingivel: atingivel,
      percentual: total > 0 ? (ganhos / total) * 100 : 0,
      status: status, texto: texto,
    };
  }

  /** valida pontos de um item: 0..max, no máximo 1 casa decimal. */
  function validarNota(bruto, max) {
    if (bruto === '' || bruto == null) return { ok: false, erro: 'Vazio.' };
    var s = String(bruto).replace(',', '.').trim();
    if (!/^\d+(\.\d)?$/.test(s)) return { ok: false, erro: 'Use 0 a ' + max + ', até 1 casa decimal.' };
    var v = parseFloat(s);
    if (v < 0 || v > max) return { ok: false, erro: 'Máximo ' + max + ' pontos.' };
    return { ok: true, valor: v };
  }

  /** mínima padrão: 60% do total possível. */
  function minimaPadrao(itens) {
    return Math.round(totalPossivel(itens) * 0.6 * 10) / 10;
  }

  global.Calc = {
    CATALOGO: CATALOGO,
    preset: preset,
    ativos: ativos,
    novoItem: novoItem,
    totalPossivel: totalPossivel,
    calcularSituacao: calcularSituacao,
    validarNota: validarNota,
    minimaPadrao: minimaPadrao,
  };
})(window);
