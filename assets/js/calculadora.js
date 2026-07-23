/* calculadora.js — sistema de notas por PONTOS. Funções puras, testáveis.
   Exposto em window.Calc.

   Sem prática (total 100):  P1 20 · P2 20 · P3 40 · escrito 5 · apresentado 5 · linea 5 · assistência 2 · bitácoras 3
   Com prática (total 110):  P1 20 +5 · P2 20 +5 · P3 30 +10 · escrito 5 · apresentado 5 · linea 5 · assistência 2 · bitácoras 3
*/
(function (global) {
  'use strict';

  var EXTRAS = [
    { id: 'TRAB_ESCRITO', label: 'Trabalho escrito', max: 5 },
    { id: 'TRAB_APRESENTADO', label: 'Trabalho apresentado', max: 5 },
    { id: 'LINEA', label: 'Linea / Trivia', max: 5 },
    { id: 'ASSISTENCIA', label: 'Assistência', max: 2 },
    { id: 'BITACORAS', label: 'Bitácoras', max: 3 },
  ];

  /** Lista de componentes da matéria, conforme tenha ou não prática. */
  function componentes(temPratica) {
    var provas = temPratica
      ? [
          { id: 'P1', label: 'P1', max: 20, grupo: 'Provas' },
          { id: 'P1_PRAT', label: 'P1 prática', max: 5, grupo: 'Provas' },
          { id: 'P2', label: 'P2', max: 20, grupo: 'Provas' },
          { id: 'P2_PRAT', label: 'P2 prática', max: 5, grupo: 'Provas' },
          { id: 'P3', label: 'P3', max: 30, grupo: 'Provas' },
          { id: 'P3_PRAT', label: 'P3 prática', max: 10, grupo: 'Provas' },
        ]
      : [
          { id: 'P1', label: 'P1', max: 20, grupo: 'Provas' },
          { id: 'P2', label: 'P2', max: 20, grupo: 'Provas' },
          { id: 'P3', label: 'P3', max: 40, grupo: 'Provas' },
        ];
    return provas.concat(EXTRAS.map(function (e) {
      return { id: e.id, label: e.label, max: e.max, grupo: 'Outros' };
    }));
  }

  function totalPossivel(comps) {
    return comps.reduce(function (a, c) { return a + c.max; }, 0);
  }

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /**
   * calcularSituacao(notas, comps, minimaPontos)
   * @param {Object} notas mapa { COMPONENTE_ID: pontos }
   * @returns {{
   *   ganhos:number, total:number, lancados:string[], pendentes:string[],
   *   possivelRestante:number, maximoPossivel:number, faltam:number,
   *   jaGarantido:boolean, atingivel:boolean, percentual:number,
   *   status:'sucesso'|'alerta'|'erro'|'neutro', texto:string
   * }}
   */
  function calcularSituacao(notas, comps, minimaPontos) {
    notas = notas || {};
    var ganhos = 0, possivelRestante = 0;
    var lancados = [], pendentes = [];
    comps.forEach(function (c) {
      var v = num(notas[c.id]);
      if (v == null) { pendentes.push(c.id); possivelRestante += c.max; }
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

  /** valida pontos de um componente: 0..max, no máximo 1 casa decimal. */
  function validarNota(bruto, max) {
    if (bruto === '' || bruto == null) return { ok: false, erro: 'Vazio.' };
    var s = String(bruto).replace(',', '.').trim();
    if (!/^\d+(\.\d)?$/.test(s)) return { ok: false, erro: 'Use 0 a ' + max + ', até 1 casa decimal.' };
    var v = parseFloat(s);
    if (v < 0 || v > max) return { ok: false, erro: 'Máximo ' + max + ' pontos.' };
    return { ok: true, valor: v };
  }

  /** mínima padrão: 60% do total possível. */
  function minimaPadrao(comps) {
    return Math.round(totalPossivel(comps) * 0.6 * 10) / 10;
  }

  global.Calc = {
    EXTRAS: EXTRAS,
    componentes: componentes,
    totalPossivel: totalPossivel,
    calcularSituacao: calcularSituacao,
    validarNota: validarNota,
    minimaPadrao: minimaPadrao,
  };
})(window);
