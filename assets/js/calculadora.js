/* calculadora.js — lógica pura de cálculo de média. Sem efeitos colaterais, testável.
   Exposto em window.Calc. */
(function (global) {
  'use strict';

  var PERIODOS = ['P1', 'P2', 'P3'];

  function num(v) {
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }

  /**
   * calcularMedia(notas, pesos)
   * @param {{P1?:number,P2?:number,P3?:number}} notas  notas lançadas (0..10); ausentes contam como 0.
   * @param {{P1:number,P2:number,P3:number}} pesos  pesos em % (soma 100).
   * @returns {number} média final (0..10, 2 casas de precisão internas).
   */
  function calcularMedia(notas, pesos) {
    notas = notas || {};
    pesos = pesos || {};
    var somaPeso = 0, soma = 0;
    PERIODOS.forEach(function (p) {
      var peso = num(pesos[p]) || 0;
      if (peso <= 0) return;
      somaPeso += peso;
      var nota = num(notas[p]);
      soma += (nota == null ? 0 : nota) * peso;
    });
    if (somaPeso <= 0) return 0;
    return soma / somaPeso;
  }

  /**
   * calcularNecessario(notasLancadas, pesos, mediaMinima)
   * Retorna quanto é preciso tirar nas etapas pendentes para atingir a média mínima.
   * @returns {{
   *   pendentes: string[],
   *   pontosGarantidos: number,   // já somados (na escala 0..10)
   *   notaNecessaria: number|null,// média necessária nas pendentes; null se não há pendentes
   *   atingivel: boolean,         // notaNecessaria <= 10
   *   jaGarantido: boolean        // já bateu a mínima independente das pendentes
   * }}
   */
  function calcularNecessario(notasLancadas, pesos, mediaMinima) {
    notasLancadas = notasLancadas || {};
    pesos = pesos || {};
    var pendentes = [];
    var pesoPendente = 0;
    var pontosGarantidos = 0; // Σ nota*peso/100 das lançadas

    PERIODOS.forEach(function (p) {
      var peso = num(pesos[p]) || 0;
      if (peso <= 0) return;
      var nota = num(notasLancadas[p]);
      if (nota == null) {
        pendentes.push(p);
        pesoPendente += peso;
      } else {
        pontosGarantidos += nota * peso / 100;
      }
    });

    var jaGarantido = pontosGarantidos >= mediaMinima - 1e-9;

    if (pendentes.length === 0) {
      return {
        pendentes: pendentes,
        pontosGarantidos: pontosGarantidos,
        notaNecessaria: null,
        atingivel: jaGarantido,
        jaGarantido: jaGarantido,
      };
    }

    // (mediaMinima - garantidos) = necessaria * (pesoPendente/100)
    var falta = mediaMinima - pontosGarantidos;
    var notaNecessaria = falta / (pesoPendente / 100);
    if (notaNecessaria < 0) notaNecessaria = 0;

    return {
      pendentes: pendentes,
      pontosGarantidos: pontosGarantidos,
      notaNecessaria: notaNecessaria,
      atingivel: notaNecessaria <= 10 + 1e-9,
      jaGarantido: jaGarantido,
    };
  }

  /** valida nota 0..10 com no máximo 1 casa decimal. Retorna {ok, valor?, erro?}. */
  function validarNota(bruto) {
    if (bruto === '' || bruto == null) return { ok: false, erro: 'Informe a nota.' };
    var s = String(bruto).replace(',', '.').trim();
    if (!/^\d+(\.\d)?$/.test(s)) {
      return { ok: false, erro: 'Use 0 a 10, no máximo 1 casa decimal.' };
    }
    var v = parseFloat(s);
    if (v < 0 || v > 10) return { ok: false, erro: 'A nota deve estar entre 0 e 10.' };
    return { ok: true, valor: v };
  }

  /** valida que pesos somam 100. Retorna {ok, soma, erro?}. */
  function validarPesos(pesos) {
    var soma = PERIODOS.reduce(function (acc, p) { return acc + (num(pesos[p]) || 0); }, 0);
    if (Math.abs(soma - 100) > 1e-9) {
      var dif = soma - 100;
      var msg = dif > 0
        ? 'Os pesos somam ' + soma + '% (sobra ' + dif + '%).'
        : 'Os pesos somam ' + soma + '% (falta ' + (-dif) + '%).';
      return { ok: false, soma: soma, erro: msg };
    }
    return { ok: true, soma: soma };
  }

  global.Calc = {
    PERIODOS: PERIODOS,
    calcularMedia: calcularMedia,
    calcularNecessario: calcularNecessario,
    validarNota: validarNota,
    validarPesos: validarPesos,
  };
})(window);
