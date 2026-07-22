/* app.js — bootstrap de cada página, busca global, filtros, status de matéria.
   Depende de: Manifesto, Notas, Calc, UI (carregados antes). */
(function (global) {
  'use strict';

  var UI = global.UI, Manifesto = global.Manifesto, Notas = global.Notas, Calc = global.Calc;
  var CHAVE_SEM = 'semestre-atual-vitoria';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function qs() {
    var o = {}; var q = location.search.replace(/^\?/, '');
    q.split('&').forEach(function (p) { if (!p) return; var kv = p.split('='); o[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    return o;
  }
  function fmtData(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtNota(n) { return (Math.round(n * 100) / 100).toFixed(1).replace('.', ','); }

  function semestreAtual() {
    var salvo;
    try { salvo = global.localStorage.getItem(CHAVE_SEM); } catch (e) {}
    var lista = Manifesto.listarSemestres();
    if (salvo && lista.some(function (s) { return s.slug === salvo; })) return salvo;
    return lista.length ? lista[0].slug : null;
  }
  function setSemestreAtual(slug) { try { global.localStorage.setItem(CHAVE_SEM, slug); } catch (e) {} }

  /** status/média de uma matéria a partir de notas + config. */
  function statusMateria(sem, mat) {
    var cfg = Manifesto.configDaMateria(sem, mat) || { pesos: { P1: 30, P2: 30, P3: 40 }, mediaMinima: 6 };
    var mapa = Notas.notasComoMapa(sem, mat);
    var qtd = Object.keys(mapa).length;
    if (qtd === 0) return { status: 'neutro', texto: 'Sem notas ainda', media: null, cfg: cfg };
    var necess = Calc.calcularNecessario(mapa, cfg.pesos, cfg.mediaMinima);
    if (necess.pendentes.length === 0) {
      var media = Calc.calcularMedia(mapa, cfg.pesos);
      if (media >= cfg.mediaMinima - 1e-9) return { status: 'sucesso', texto: 'Aprovado', media: media, cfg: cfg };
      return { status: 'erro', texto: 'Reprovado', media: media, cfg: cfg };
    }
    // parcial
    var mediaParcial = Calc.calcularMedia(mapa, cfg.pesos);
    if (necess.jaGarantido) return { status: 'sucesso', texto: 'Aprovando', media: mediaParcial, cfg: cfg };
    if (!necess.atingivel) return { status: 'erro', texto: 'Reprovado', media: mediaParcial, cfg: cfg };
    return { status: 'alerta', texto: 'Em risco', media: mediaParcial, cfg: cfg };
  }

  /* ---------- Header: busca global + nav ativa ---------- */
  function initHeader() {
    var pagina = document.body.getAttribute('data-pagina');
    $all('.header__nav a').forEach(function (a) {
      if (a.getAttribute('data-pagina') === pagina) a.classList.add('ativo');
    });

    var input = $('#busca-global');
    var dropdown = $('#busca-dropdown');
    if (!input || !dropdown) return;

    function fechar() { dropdown.hidden = true; dropdown.innerHTML = ''; }
    function abrir(resultados, termo) {
      dropdown.innerHTML = '';
      if (!resultados.length) {
        dropdown.appendChild(UI.el('div', { class: 'busca-vazio', text: 'Nenhum material encontrado para “' + termo + '”.' }));
        dropdown.hidden = false;
        return;
      }
      resultados.slice(0, 30).forEach(function (i) {
        var link = UI.el('a', { class: 'busca-item', href: 'ver.html?item=' + encodeURIComponent(i.id) }, [
          UI.el('div', { class: 'busca-item__titulo', text: i.titulo }),
          UI.el('div', { class: 'busca-item__meta', text: Manifesto.labelMateria(i.semestre, i.materia) + ' · ' + i.periodo + ' · ' + i.tipo }),
        ]);
        dropdown.appendChild(link);
      });
      dropdown.hidden = false;
    }

    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      var termo = input.value.trim();
      t = setTimeout(function () {
        if (termo.length < 2) return fechar();
        abrir(Manifesto.buscar(termo), termo);
      }, 120);
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && e.target !== input) fechar();
    });
  }

  /* ---------- Seletor de semestre reutilizável ---------- */
  function preencherSeletorSemestre(sel, onChange) {
    if (!sel) return;
    var lista = Manifesto.listarSemestres();
    sel.innerHTML = '';
    lista.forEach(function (s) {
      sel.appendChild(UI.el('option', { value: s.slug }, [s.label]));
    });
    sel.value = semestreAtual();
    sel.addEventListener('change', function () {
      setSemestreAtual(sel.value);
      if (onChange) onChange(sel.value);
    });
  }

  /* ---------- Página: Dashboard ---------- */
  function initDashboard() {
    var grid = $('#grid-materias');
    var seletor = $('#seletor-semestre');

    function render(sem) {
      var materias = Manifesto.listarMaterias(sem);
      grid.innerHTML = '';
      var manifestoVazio = !materias.length;
      if (manifestoVazio) {
        grid.appendChild(UI.renderVazio('📭', 'Nenhuma matéria cadastrada',
          'Cadastre matérias em <code>data/config-materias.json</code> e rode <code>node scripts/gerar-manifesto.js</code>.'));
        return;
      }
      materias.forEach(function (m) {
        var st = statusMateria(sem, m.slug);
        var cont = Manifesto.contagemPorTipo(sem, m.slug);
        var partes = Object.keys(cont.porTipo).map(function (tp) { return cont.porTipo[tp] + ' ' + tp + (cont.porTipo[tp] > 1 ? 's' : ''); });
        var contagemTexto = cont.total ? partes.join(' · ') : 'Sem materiais ainda';
        var badgeTexto = st.texto + (st.media != null ? ' · ' + fmtNota(st.media) : '');
        grid.appendChild(UI.renderCard({
          semestre: sem, slug: m.slug, label: m.label,
          badgeStatus: st.status, badgeTexto: badgeTexto,
          contagem: contagemTexto,
          href: 'materia.html?semestre=' + encodeURIComponent(sem) + '&materia=' + encodeURIComponent(m.slug),
        }));
      });
    }

    preencherSeletorSemestre(seletor, render);
    var sem = semestreAtual();
    if (!sem) {
      grid.appendChild(UI.renderVazio('📭', 'Sem conteúdo',
        'O manifesto está vazio. Rode <code>node scripts/gerar-manifesto.js</code> e recarregue.'));
      return;
    }
    render(sem);
  }

  /* ---------- Página: Matéria ---------- */
  function initMateria() {
    var p = qs();
    var sem = p.semestre, mat = p.materia;
    var raiz = $('#materia-conteudo');
    if (!sem || !mat || !Manifesto.configDaMateria(sem, mat) && !Manifesto.listarMaterias(sem).some(function (x) { return x.slug === mat; })) {
      raiz.innerHTML = '';
      raiz.appendChild(UI.renderVazio('🔍', 'Matéria não encontrada',
        'O endereço aponta para uma matéria que não existe. <a href="index.html">Voltar ao dashboard</a>.'));
      return;
    }
    var labelMat = Manifesto.labelMateria(sem, mat);
    var labelSem = Manifesto.labelSemestre(sem);
    document.title = labelMat + ' — Portal de Estudos';

    $('#breadcrumb').innerHTML = '';
    $('#breadcrumb').append(
      UI.el('a', { href: 'index.html' }, ['Dashboard']),
      UI.el('span', { text: '›' }),
      UI.el('a', { href: 'index.html' }, [labelSem]),
      UI.el('span', { text: '›' }),
      UI.el('span', { text: labelMat })
    );

    var st = statusMateria(sem, mat);
    $('#materia-titulo').textContent = labelMat;
    var sub = $('#materia-sub');
    sub.innerHTML = '';
    var badge = UI.renderCard ? null : null;
    var b = UI.renderBadge(st.status);
    sub.append(
      UI.el('span', { class: 'badge badge--' + st.status }, [
        UI.el('span', { class: 'badge__icone', 'aria-hidden': 'true', text: b.icone }),
        st.texto + (st.media != null ? ' · média ' + fmtNota(st.media) : ''),
      ]),
      UI.el('a', { class: 'btn btn--secundario btn--pequeno', style: 'margin-left:12px;',
        href: 'calculadora.html?semestre=' + encodeURIComponent(sem) + '&materia=' + encodeURIComponent(mat) }, ['Abrir calculadora'])
    );

    var dados = Manifesto.listarPorMateria(sem, mat);
    var periodos = ['P1', 'P2', 'P3'];
    var abas = $('#abas'), paineis = $('#paineis');
    abas.innerHTML = ''; paineis.innerHTML = '';

    periodos.forEach(function (per, idx) {
      var grupos = dados.grupos[per] || {};
      var qtd = Object.keys(grupos).reduce(function (a, tp) { return a + grupos[tp].length; }, 0);
      var btn = UI.el('button', { class: 'aba' + (idx === 0 ? ' ativo' : ''), type: 'button', 'data-per': per }, [per + ' (' + qtd + ')']);
      abas.appendChild(btn);

      var painel = UI.el('div', { class: 'aba-painel', 'data-per': per });
      if (idx !== 0) painel.hidden = true;

      if (qtd === 0) {
        painel.appendChild(UI.renderVazio('🗂️', 'Nada em ' + per + ' ainda',
          'Adicione HTMLs em <code>materias/' + sem + '/' + mat + '/' + per.toLowerCase() + '/&lt;tipo&gt;/</code> e rode o gerador.'));
      } else {
        Object.keys(grupos).sort().forEach(function (tp) {
          var grupo = UI.el('div', { class: 'grupo-tipo' }, [
            UI.el('div', { class: 'grupo-tipo__titulo', text: tp + ' (' + grupos[tp].length + ')' }),
          ]);
          grupos[tp].forEach(function (item) { grupo.appendChild(UI.renderItemCard(item)); });
          painel.appendChild(grupo);
        });
      }
      paineis.appendChild(painel);

      btn.addEventListener('click', function () {
        $all('.aba', abas).forEach(function (a) { a.classList.remove('ativo'); });
        btn.classList.add('ativo');
        $all('.aba-painel', paineis).forEach(function (pn) { pn.hidden = pn.getAttribute('data-per') !== per; });
      });
    });
  }

  /* ---------- Página: Calculadora ---------- */
  function initCalculadora() {
    var p = qs();
    var selSem = $('#calc-semestre'), selMat = $('#calc-materia');
    var periodos = ['P1', 'P2', 'P3'];

    function preencherMaterias(sem) {
      var mats = Manifesto.listarMaterias(sem);
      selMat.innerHTML = '';
      mats.forEach(function (m) { selMat.appendChild(UI.el('option', { value: m.slug }, [m.label])); });
    }

    preencherSeletorSemestre(selSem, function (sem) { preencherMaterias(sem); carregarMateria(); });
    preencherMaterias(semestreAtual());
    if (p.semestre && Manifesto.listarSemestres().some(function (s) { return s.slug === p.semestre; })) {
      selSem.value = p.semestre; setSemestreAtual(p.semestre); preencherMaterias(p.semestre);
    }
    if (p.materia) selMat.value = p.materia;

    selMat.addEventListener('change', carregarMateria);

    function inputsNota() { return periodos.map(function (per) { return $('#nota-' + per); }); }
    function inputsPeso() { return periodos.map(function (per) { return $('#peso-' + per); }); }

    function lerNotasInput() {
      var mapa = {};
      periodos.forEach(function (per) {
        var v = $('#nota-' + per).value;
        if (v !== '') { var r = Calc.validarNota(v); if (r.ok) mapa[per] = r.valor; }
      });
      return mapa;
    }
    function lerPesosInput() {
      var pesos = {};
      periodos.forEach(function (per) { pesos[per] = parseFloat($('#peso-' + per).value) || 0; });
      return pesos;
    }

    function carregarMateria() {
      var sem = selSem.value, mat = selMat.value;
      if (!mat) return;
      var cfg = Manifesto.configDaMateria(sem, mat) || { pesos: { P1: 30, P2: 30, P3: 40 }, mediaMinima: 6 };
      var mapa = Notas.notasComoMapa(sem, mat);
      periodos.forEach(function (per) {
        $('#nota-' + per).value = (mapa[per] != null) ? String(mapa[per]).replace('.', ',') : '';
        $('#peso-' + per).value = cfg.pesos[per];
      });
      $('#media-minima').value = cfg.mediaMinima;
      validarTudo();
    }

    function validarTudo() {
      // valida notas inline
      var notasOk = true;
      periodos.forEach(function (per) {
        var campo = $('#nota-' + per), erroEl = $('#erro-nota-' + per), v = campo.value;
        if (v === '') { campo.classList.remove('input--erro'); erroEl.textContent = ''; return; }
        var r = Calc.validarNota(v);
        if (!r.ok) { campo.classList.add('input--erro'); erroEl.textContent = r.erro; notasOk = false; }
        else { campo.classList.remove('input--erro'); erroEl.textContent = ''; }
      });
      // valida pesos
      var pesos = lerPesosInput();
      var vp = Calc.validarPesos(pesos);
      var somaEl = $('#pesos-soma');
      somaEl.textContent = vp.ok ? 'Soma: 100% ✓' : vp.erro;
      somaEl.className = 'pesos-soma ' + (vp.ok ? 'pesos-soma--ok' : 'pesos-soma--erro');

      atualizarResultado(notasOk, vp.ok, pesos);
      $('#btn-salvar').disabled = !(notasOk && vp.ok);
      return notasOk && vp.ok;
    }

    function atualizarResultado(notasOk, pesosOk, pesos) {
      var box = $('#resultado');
      if (!notasOk || !pesosOk) { box.innerHTML = '<p class="card__meta">Corrija os campos destacados para ver a média.</p>'; return; }
      var mapa = lerNotasInput();
      var mediaMin = parseFloat(String($('#media-minima').value).replace(',', '.')) || 6;
      var media = Calc.calcularMedia(mapa, pesos);
      var necess = Calc.calcularNecessario(mapa, pesos, mediaMin);
      var qtd = Object.keys(mapa).length;

      var status = 'neutro', texto = 'Sem notas';
      if (qtd > 0) {
        if (necess.pendentes.length === 0) {
          status = media >= mediaMin - 1e-9 ? 'sucesso' : 'erro';
          texto = status === 'sucesso' ? 'Aprovado' : 'Reprovado';
        } else if (necess.jaGarantido) { status = 'sucesso'; texto = 'Aprovando'; }
        else if (!necess.atingivel) { status = 'erro'; texto = 'Impossível atingir a mínima'; }
        else { status = 'alerta'; texto = 'Em risco'; }
      }
      var b = UI.renderBadge(status);
      box.innerHTML = '';
      box.append(
        UI.el('div', { class: 'resultado__media', text: fmtNota(media) }),
        UI.el('span', { class: 'badge badge--' + status }, [
          UI.el('span', { class: 'badge__icone', 'aria-hidden': 'true', text: b.icone }), texto,
        ])
      );
      if (necess.pendentes.length && necess.notaNecessaria != null && !necess.jaGarantido) {
        var msg = necess.atingivel
          ? 'Precisa de ' + fmtNota(necess.notaNecessaria) + ' (média) nas etapas pendentes: ' + necess.pendentes.join(', ') + '.'
          : 'Nem tirando 10 nas etapas pendentes (' + necess.pendentes.join(', ') + ') dá para atingir ' + fmtNota(mediaMin) + '.';
        box.append(UI.el('p', { class: 'card__meta', style: 'margin-top:8px;', text: msg }));
      } else if (necess.pendentes.length && necess.jaGarantido) {
        box.append(UI.el('p', { class: 'card__meta', style: 'margin-top:8px;', text: 'Média mínima já garantida mesmo com etapas pendentes.' }));
      }
    }

    inputsNota().forEach(function (i) { i.addEventListener('input', validarTudo); });
    inputsPeso().forEach(function (i) { i.addEventListener('input', validarTudo); });
    $('#media-minima').addEventListener('input', validarTudo);

    $('#btn-salvar').addEventListener('click', function () {
      if (!validarTudo()) return;
      var sem = selSem.value, mat = selMat.value;
      var mapa = lerNotasInput();
      try {
        periodos.forEach(function (per) { if (mapa[per] != null) Notas.salvarNota(sem, mat, per, mapa[per]); });
        UI.renderToast('Lançamento salvo com sucesso.', 'sucesso');
      } catch (e) {
        UI.renderToast(e.message || 'Erro ao salvar.', 'erro', 6000);
      }
    });

    carregarMateria();
  }

  /* ---------- Página: Histórico ---------- */
  function initHistorico() {
    var selSem = $('#hist-semestre'), selMat = $('#hist-materia'), selPer = $('#hist-periodo');
    var corpo = $('#hist-tabela');

    function preencherFiltros() {
      selSem.innerHTML = '<option value="">Todos os semestres</option>';
      Manifesto.listarSemestres().forEach(function (s) { selSem.appendChild(UI.el('option', { value: s.slug }, [s.label])); });
      atualizarMaterias();
    }
    function atualizarMaterias() {
      selMat.innerHTML = '<option value="">Todas as matérias</option>';
      var sems = selSem.value ? [selSem.value] : Manifesto.listarSemestres().map(function (s) { return s.slug; });
      sems.forEach(function (sem) {
        Manifesto.listarMaterias(sem).forEach(function (m) {
          selMat.appendChild(UI.el('option', { value: m.slug, 'data-sem': sem }, [m.label + (selSem.value ? '' : ' (' + Manifesto.labelSemestre(sem) + ')')]));
        });
      });
    }

    function filtros() {
      return { semestre: selSem.value || null, materia: selMat.value || null, periodo: selPer.value || null };
    }

    function render() {
      var linhas = Notas.listarAvaliacoes(filtros());
      corpo.innerHTML = '';
      if (!linhas.length) {
        corpo.appendChild(UI.renderVazio('🗃️', 'Nenhum lançamento',
          'Lance notas na <a href="calculadora.html">calculadora</a> para vê-las aqui.'));
        return;
      }
      var colunas = ['Semestre', 'Matéria', 'Período', 'Nota', 'Lançamento', 'Última edição', 'Ações'];
      var rows = linhas.map(function (l) {
        var acoes = UI.el('div', { style: 'display:flex;gap:6px;' }, [
          UI.el('button', { class: 'btn btn--secundario btn--pequeno', onclick: function () { editar(l); } }, ['Editar']),
          UI.el('button', { class: 'btn btn--perigo btn--pequeno', onclick: function () { excluir(l); } }, ['Excluir']),
        ]);
        return [
          Manifesto.labelSemestre(l.semestre),
          Manifesto.labelMateria(l.semestre, l.materia),
          l.periodo,
          fmtNota(l.nota),
          fmtData(l.dataLancamento),
          l.dataEdicao ? fmtData(l.dataEdicao) : '—',
          acoes,
        ];
      });
      corpo.appendChild(UI.renderTabela(colunas, rows));
    }

    function editar(l) {
      var atualTxt = String(l.nota).replace('.', ',');
      var novo = global.prompt('Nova nota para ' + Manifesto.labelMateria(l.semestre, l.materia) + ' ' + l.periodo + ' (0 a 10):', atualTxt);
      if (novo == null) return;
      var r = Calc.validarNota(novo);
      if (!r.ok) { UI.renderToast(r.erro, 'erro'); return; }
      UI.renderModal({
        titulo: 'Confirmar edição',
        texto: 'Alterar ' + l.periodo + ' de ' + fmtNota(l.nota) + ' para ' + fmtNota(r.valor) + '? Isso gera uma nova entrada no histórico.',
        confirmar: 'Salvar',
      }).then(function (ok) {
        if (!ok) return;
        try { Notas.editarNota(l.semestre, l.materia, l.periodo, r.valor); UI.renderToast('Nota atualizada.', 'sucesso'); render(); }
        catch (e) { UI.renderToast(e.message, 'erro', 6000); }
      });
    }

    function excluir(l) {
      UI.renderModal({
        titulo: 'Excluir lançamento',
        texto: 'Excluir a nota ' + fmtNota(l.nota) + ' de ' + Manifesto.labelMateria(l.semestre, l.materia) + ' ' + l.periodo + '? A ação fica registrada no histórico.',
        confirmar: 'Excluir', perigo: true,
      }).then(function (ok) {
        if (!ok) return;
        try { Notas.excluirNota(l.semestre, l.materia, l.periodo); UI.renderToast('Lançamento excluído.', 'sucesso'); render(); }
        catch (e) { UI.renderToast(e.message, 'erro', 6000); }
      });
    }

    selSem.addEventListener('change', function () { atualizarMaterias(); render(); });
    selMat.addEventListener('change', render);
    selPer.addEventListener('change', render);

    $('#btn-exportar').addEventListener('click', function () {
      Notas.exportarBackup(); UI.renderToast('Backup exportado.', 'sucesso');
    });
    var inputImport = $('#input-importar');
    $('#btn-importar').addEventListener('click', function () { inputImport.click(); });
    inputImport.addEventListener('change', function () {
      var arq = inputImport.files[0];
      if (!arq) return;
      UI.renderModal({
        titulo: 'Importar backup',
        texto: 'Importar “' + arq.name + '” vai SOBRESCREVER as notas atuais deste navegador. Continuar?',
        confirmar: 'Importar', perigo: true,
      }).then(function (ok) {
        if (!ok) { inputImport.value = ''; return; }
        Notas.importarBackup(arq)
          .then(function () { UI.renderToast('Backup importado com sucesso.', 'sucesso'); render(); })
          .catch(function (e) { UI.renderToast(e.message || 'Falha ao importar.', 'erro', 7000); })
          .then(function () { inputImport.value = ''; });
      });
    });

    preencherFiltros();
    render();
  }

  /* ---------- Página: Visualizador de material ---------- */
  function initVer() {
    var p = qs();
    var frame = $('#ver-frame');
    var voltar = $('#ver-voltar');
    var item = p.item ? Manifesto.itemPorId(p.item) : null;

    if (!item) {
      if (frame) frame.style.display = 'none';
      voltar.setAttribute('href', 'index.html');
      var box = $('#ver-conteudo');
      box.className = 'container ver-erro';
      box.appendChild(UI.renderVazio('🔍', 'Material não encontrado',
        'Este material não existe no manifesto. <a href="index.html">Voltar ao dashboard</a>.'));
      return;
    }

    document.title = item.titulo + ' — Portal de Estudos';
    frame.src = item.arquivo;
    // "Voltar" leva pra página da matéria (destino determinístico, funciona até se
    // o material foi aberto direto pelo link, sem histórico).
    voltar.setAttribute('href',
      'materia.html?semestre=' + encodeURIComponent(item.semestre) +
      '&materia=' + encodeURIComponent(item.materia));
    voltar.setAttribute('title', 'Voltar para ' + Manifesto.labelMateria(item.semestre, item.materia));
  }

  /* ---------- Bootstrap ---------- */
  function boot() {
    Promise.all([Manifesto.carregarManifesto().catch(function () { return null; }), Manifesto.carregarConfig().catch(function () { return null; })])
      .then(function () {
        initHeader();
        var pagina = document.body.getAttribute('data-pagina');
        try {
          if (pagina === 'dashboard') initDashboard();
          else if (pagina === 'materia') initMateria();
          else if (pagina === 'calculadora') initCalculadora();
          else if (pagina === 'historico') initHistorico();
          else if (pagina === 'ver') initVer();
        } catch (e) {
          console.error('[app] erro ao iniciar página', pagina, e);
        }
      })
      .catch(function (e) {
        console.error('[app] falha ao carregar dados', e);
        var main = document.querySelector('main') || document.body;
        var aviso = UI.renderVazio('⚠️', 'Não foi possível carregar o conteúdo',
          'Rode <code>node scripts/gerar-manifesto.js</code> para gerar <code>data/conteudo.js</code>, ou sirva o site por HTTP (ex. <code>npx serve</code>).');
        main.appendChild(aviso);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
