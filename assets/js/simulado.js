/* simulado.js — prova de múltipla escolha com questões dos painéis.
   Fonte: data/simulado.js (window.__SIMULADO__). */
(function (global) {
  'use strict';
  var UI = global.UI, Manifesto = global.Manifesto;
  function $(id) { return document.getElementById(id); }

  var filtro = { semestre: '', materia: '' };
  var exame = null;

  function todas() {
    var out = [], fonte = global.__SIMULADO__;
    if (fonte && fonte.materias) Object.keys(fonte.materias).forEach(function (k) {
      (fonte.materias[k] || []).forEach(function (q) { out.push(q); });
    });
    return out;
  }
  function materiasComQuiz() {
    var mapa = {};
    todas().forEach(function (q) { (mapa[q.semestre] = mapa[q.semestre] || {})[q.materia] = true; });
    return mapa;
  }
  function filtradas() {
    return todas().filter(function (q) {
      if (filtro.semestre && q.semestre !== filtro.semestre) return false;
      if (filtro.materia && q.materia !== filtro.materia) return false;
      return true;
    });
  }
  function embaralhar(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function labelMat(s, m) { try { return Manifesto.labelMateria(s, m); } catch (_) { return m; } }

  /* ---------- filtros / setup ---------- */
  function preencherFiltros() {
    var mapa = materiasComQuiz();
    var selS = $('sim-f-semestre');
    selS.innerHTML = '<option value="">Todos os semestres</option>';
    Object.keys(mapa).sort().forEach(function (s) { selS.appendChild(UI.el('option', { value: s }, [Manifesto.labelSemestre(s)])); });
    atualizarMaterias();
  }
  function atualizarMaterias() {
    var mapa = materiasComQuiz();
    var selM = $('sim-f-materia');
    selM.innerHTML = '<option value="">Todas as matérias</option>';
    var sems = filtro.semestre ? [filtro.semestre] : Object.keys(mapa);
    sems.forEach(function (s) {
      Object.keys(mapa[s] || {}).sort().forEach(function (m) {
        selM.appendChild(UI.el('option', { value: s + '|' + m }, [labelMat(s, m) + (filtro.semestre ? '' : ' (' + Manifesto.labelSemestre(s) + ')')]));
      });
    });
    atualizarContagem();
  }
  function atualizarContagem() {
    $('sim-disponiveis').textContent = filtradas().length + ' questões disponíveis neste filtro.';
  }

  /* ---------- exame ---------- */
  function iniciar() {
    var pool = filtradas();
    if (!pool.length) { UI.renderToast('Sem questões neste filtro.', 'alerta'); return; }
    var n = parseInt($('sim-qtd').value, 10) || pool.length;
    exame = { questoes: embaralhar(pool).slice(0, Math.min(n, pool.length)), idx: 0, respostas: [], acertos: 0 };
    $('sim-config').hidden = true;
    $('sim-resultado').hidden = true;
    $('sim-jogo').hidden = false;
    mostrarQuestao();
  }

  function mostrarQuestao() {
    var q = exame.questoes[exame.idx];
    $('sim-progresso').textContent = 'Questão ' + (exame.idx + 1) + ' de ' + exame.questoes.length;
    $('sim-placar').textContent = exame.acertos + ' acerto' + (exame.acertos === 1 ? '' : 's');
    $('sim-materia').textContent = labelMat(q.semestre, q.materia);
    $('sim-pergunta').textContent = q.pergunta;
    var box = $('sim-opcoes'); box.innerHTML = '';
    q.opcoes.forEach(function (op, i) {
      var b = UI.el('button', { class: 'sim-opcao', type: 'button' }, [
        UI.el('span', { class: 'sim-opcao__letra', text: String.fromCharCode(65 + i) }),
        UI.el('span', { text: op }),
      ]);
      b.addEventListener('click', function () { responder(i); });
      box.appendChild(b);
    });
    $('sim-explicacao').hidden = true;
    $('sim-explicacao').textContent = '';
    $('sim-proxima').hidden = true;
  }

  function responder(escolha) {
    var q = exame.questoes[exame.idx];
    var botoes = $('sim-opcoes').querySelectorAll('.sim-opcao');
    if (botoes[0].disabled) return; // já respondeu
    var certo = escolha === q.correta;
    if (certo) exame.acertos += 1;
    exame.respostas.push({ q: q, escolha: escolha, certo: certo });
    botoes.forEach(function (b, i) {
      b.disabled = true;
      if (i === q.correta) b.classList.add('sim-opcao--correta');
      else if (i === escolha) b.classList.add('sim-opcao--errada');
    });
    $('sim-placar').textContent = exame.acertos + ' acerto' + (exame.acertos === 1 ? '' : 's');
    if (q.explicacao) {
      var e = $('sim-explicacao');
      e.textContent = (certo ? '✓ ' : '✕ ') + q.explicacao;
      e.className = 'sim-explicacao ' + (certo ? 'sim-explicacao--ok' : 'sim-explicacao--erro');
      e.hidden = false;
    }
    var ultima = exame.idx === exame.questoes.length - 1;
    $('sim-proxima').textContent = ultima ? 'Ver resultado' : 'Próxima →';
    $('sim-proxima').hidden = false;
  }

  function proxima() {
    if (exame.idx === exame.questoes.length - 1) return resultado();
    exame.idx += 1;
    mostrarQuestao();
  }

  function resultado() {
    $('sim-jogo').hidden = true;
    $('sim-resultado').hidden = false;
    var n = exame.questoes.length, ac = exame.acertos, pct = Math.round((ac / n) * 100);
    var status = pct >= 60 ? 'sucesso' : (pct >= 40 ? 'alerta' : 'erro');
    var b = UI.renderBadge(status);
    var head = $('sim-resultado-head'); head.innerHTML = '';
    head.append(
      UI.el('div', { class: 'resultado__media', text: ac + ' / ' + n }),
      UI.el('span', { class: 'badge badge--' + status }, [
        UI.el('span', { class: 'badge__icone', 'aria-hidden': 'true', text: b.icone }), pct + '% de acerto',
      ])
    );
    var erradas = exame.respostas.filter(function (r) { return !r.certo; });
    var lista = $('sim-erradas'); lista.innerHTML = '';
    if (!erradas.length) {
      lista.appendChild(UI.el('p', { class: 'card__meta', text: 'Gabaritou! Nenhum erro. 🎉' }));
    } else {
      lista.appendChild(UI.el('h2', { class: 'card__titulo', text: 'Revisar os erros (' + erradas.length + ')' }));
      erradas.forEach(function (r) {
        lista.appendChild(UI.el('div', { class: 'sim-erro-item' }, [
          UI.el('strong', { text: r.q.pergunta }),
          UI.el('span', { class: 'sim-erro-item__sua', text: 'Você: ' + r.q.opcoes[r.escolha] }),
          UI.el('span', { class: 'sim-erro-item__certa', text: 'Correta: ' + r.q.opcoes[r.q.correta] }),
        ]));
      });
    }
  }

  function init() {
    Promise.all([
      Manifesto.carregarManifesto().catch(function () { return null; }),
      Manifesto.carregarConfig().catch(function () { return null; }),
    ]).then(function () { preencherFiltros(); });

    $('sim-f-semestre').addEventListener('change', function () { filtro.semestre = this.value; filtro.materia = ''; atualizarMaterias(); });
    $('sim-f-materia').addEventListener('change', function () {
      if (this.value) { var p = this.value.split('|'); filtro.semestre = p[0]; filtro.materia = p[1]; } else filtro.materia = '';
      atualizarContagem();
    });
    $('sim-iniciar').addEventListener('click', iniciar);
    $('sim-proxima').addEventListener('click', proxima);
    $('sim-refazer').addEventListener('click', function () { $('sim-resultado').hidden = true; $('sim-config').hidden = false; });
    $('sim-encerrar').addEventListener('click', function () { $('sim-jogo').hidden = true; $('sim-config').hidden = false; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
