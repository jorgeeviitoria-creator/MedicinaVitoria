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

  function semestreAtual() {
    var salvo;
    try { salvo = global.localStorage.getItem(CHAVE_SEM); } catch (e) {}
    var lista = Manifesto.listarSemestres();
    if (salvo && lista.some(function (s) { return s.slug === salvo; })) return salvo;
    return lista.length ? lista[0].slug : null;
  }
  function setSemestreAtual(slug) { try { global.localStorage.setItem(CHAVE_SEM, slug); } catch (e) {} }

  function fmtPts(n) {
    if (n == null) return '';
    var r = Math.round(n * 10) / 10;
    return (r % 1 === 0 ? String(r) : r.toFixed(1)).replace('.', ',');
  }

  /** rótulo legível de um item (procura na config da matéria, depois no catálogo). */
  var LABEL_PADRAO = (function () {
    var m = {};
    Calc.CATALOGO.forEach(function (c) { m[c.id] = c.label; });
    return m;
  })();
  function labelComp(id, itens) {
    if (itens) { for (var i = 0; i < itens.length; i++) if (itens[i].id === id) return itens[i].label; }
    return LABEL_PADRAO[id] || id;
  }

  /** config efetiva da matéria: modelo padrão + ajustes salvos no navegador. */
  function configEfetiva(sem, mat) {
    var base = Manifesto.configDaMateria(sem, mat) || {};
    var over = Notas.obterOverride(sem, mat) || {};
    var itens = (over.itens && over.itens.length) ? over.itens : Calc.preset(!!base.temPratica);
    var minima = (over.minimaPontos != null) ? Number(over.minimaPontos)
      : (base.minimaPontos != null ? Number(base.minimaPontos) : Calc.minimaPadrao(itens));
    return { itens: itens, minimaPontos: minima };
  }

  /** situação (pontos) de uma matéria a partir das notas + config. */
  function statusMateria(sem, mat) {
    var cfg = configEfetiva(sem, mat);
    var mapa = Notas.notasComoMapa(sem, mat);
    var s = Calc.calcularSituacao(mapa, cfg.itens, cfg.minimaPontos);
    return { status: s.status, texto: s.texto, sit: s, cfg: cfg };
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
        var badgeTexto = st.texto + (st.sit.lancados.length ? ' · ' + fmtPts(st.sit.ganhos) + '/' + st.sit.total : '');
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
        st.texto + (st.sit.lancados.length ? ' · ' + fmtPts(st.sit.ganhos) + '/' + st.sit.total + ' pts' : ''),
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

    // Abas extras: Anotações e Trabalhos (anexos no Google Drive). Carregam sob demanda.
    [
      { tipo: 'anotacoes', rotulo: '📝 Anotações' },
      { tipo: 'trabalhos', rotulo: '📎 Trabalhos' },
    ].forEach(function (ax) {
      var btn = UI.el('button', { class: 'aba', type: 'button', 'data-per': ax.tipo }, [ax.rotulo]);
      var painel = UI.el('div', { class: 'aba-painel', 'data-per': ax.tipo });
      painel.hidden = true;
      var carregado = false;
      abas.appendChild(btn);
      paineis.appendChild(painel);
      btn.addEventListener('click', function () {
        $all('.aba', abas).forEach(function (a) { a.classList.remove('ativo'); });
        btn.classList.add('ativo');
        $all('.aba-painel', paineis).forEach(function (pn) { pn.hidden = pn.getAttribute('data-per') !== ax.tipo; });
        if (!global.Anexos) { painel.innerHTML = '<p class="card__meta">Anexos só funcionam no site publicado.</p>'; return; }
        if (!carregado) { carregado = true; global.Anexos.renderPainel(painel, sem, mat, ax.tipo, ax.rotulo); }
      });
    });
  }

  /* ---------- Página: Calculadora ---------- */
  function initCalculadora() {
    var p = qs();
    var selSem = $('#calc-semestre'), selMat = $('#calc-materia');

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

    var itens = [];          // configuração completa (itens ativos e inativos)
    var minima = 60;
    var campos = $('#campos-notas');
    var editor = $('#editor-itens');
    var inpMinima = $('#minima-pontos');
    var totalInfo = $('#total-info');

    function salvarConfig() {
      try { Notas.salvarOverride(selSem.value, selMat.value, { itens: itens, minimaPontos: minima }); }
      catch (e) { UI.renderToast(e.message, 'erro', 6000); }
    }

    /* ----- campos de lançamento (só itens ativos) ----- */
    function renderCampos(mapa) {
      campos.innerHTML = '';
      var ativos = Calc.ativos(itens);
      if (!ativos.length) {
        campos.appendChild(UI.el('p', { class: 'card__meta', text: 'Nenhum item ativo. Abra “Configurar avaliação” e ligue os itens.' }));
        return;
      }
      var ordem = [], grupos = {};
      ativos.forEach(function (c) {
        var g = c.grupo || 'Outros';
        if (!grupos[g]) { grupos[g] = []; ordem.push(g); }
        grupos[g].push(c);
      });
      ordem.forEach(function (g) {
        var grid = UI.el('div', { class: 'notas-grid' });
        grupos[g].forEach(function (c) {
          grid.appendChild(UI.el('div', { class: 'campo' }, [
            UI.el('label', { class: 'campo__label', for: 'nota-' + c.id, text: c.label + ' (0–' + c.max + ')' }),
            UI.el('input', { class: 'input', type: 'text', inputmode: 'decimal', id: 'nota-' + c.id, placeholder: '—', 'aria-describedby': 'erro-' + c.id }),
            UI.el('span', { class: 'campo__erro', id: 'erro-' + c.id, role: 'alert' }),
          ]));
        });
        campos.append(UI.el('div', { class: 'grupo-tipo__titulo', text: g }), grid);
      });
      ativos.forEach(function (c) {
        var el = $('#nota-' + c.id);
        el.value = (mapa[c.id] != null) ? String(mapa[c.id]).replace('.', ',') : '';
        el.addEventListener('input', validarTudo);
      });
    }

    /* ----- editor: liga/desliga item e edita a pontuação ----- */
    function renderEditor() {
      editor.innerHTML = '';
      itens.forEach(function (it) {
        var chk = UI.el('input', { type: 'checkbox' });
        chk.checked = !!it.ativo;
        chk.addEventListener('change', function () { it.ativo = chk.checked; aplicar(); });

        var pts = UI.el('input', { class: 'input item-config__pts', type: 'number', min: '0', step: '0.5', value: it.max, 'aria-label': 'Pontos de ' + it.label });
        pts.addEventListener('input', function () { it.max = Number(pts.value) || 0; salvarConfig(); validarTudo(); });
        pts.addEventListener('change', function () { aplicar(); });

        var linha = UI.el('div', { class: 'item-config' + (it.ativo ? '' : ' item-config--off') }, [
          UI.el('label', { class: 'item-config__toggle' }, [chk, UI.el('span', { text: it.label })]),
          pts,
          UI.el('span', { class: 'card__meta', text: 'pts' }),
        ]);
        if (it.custom) {
          var del = UI.el('button', { class: 'btn btn--perigo btn--pequeno', type: 'button', title: 'Remover item' }, ['×']);
          del.addEventListener('click', function () {
            itens = itens.filter(function (x) { return x.id !== it.id; });
            aplicar();
          });
          linha.appendChild(del);
        }
        editor.appendChild(linha);
      });
    }

    function aplicar() {
      salvarConfig();
      renderEditor();
      renderCampos(Notas.notasComoMapa(selSem.value, selMat.value));
      validarTudo();
    }

    function lerNotasInput() {
      var mapa = {};
      Calc.ativos(itens).forEach(function (c) {
        var el = $('#nota-' + c.id);
        if (!el) return;
        var v = el.value;
        if (v !== '') { var r = Calc.validarNota(v, c.max); if (r.ok) mapa[c.id] = r.valor; }
      });
      return mapa;
    }

    function carregarMateria() {
      var sem = selSem.value, mat = selMat.value;
      if (!mat) return;
      var cfg = configEfetiva(sem, mat);
      itens = JSON.parse(JSON.stringify(cfg.itens));
      minima = cfg.minimaPontos;
      inpMinima.value = minima;
      renderEditor();
      renderCampos(Notas.notasComoMapa(sem, mat));
      validarTudo();
    }

    function validarTudo() {
      var ok = true;
      Calc.ativos(itens).forEach(function (c) {
        var campo = $('#nota-' + c.id), erroEl = $('#erro-' + c.id);
        if (!campo) return;
        var v = campo.value;
        if (v === '') { campo.classList.remove('input--erro'); erroEl.textContent = ''; return; }
        var r = Calc.validarNota(v, c.max);
        if (!r.ok) { campo.classList.add('input--erro'); erroEl.textContent = r.erro; ok = false; }
        else { campo.classList.remove('input--erro'); erroEl.textContent = ''; }
      });
      var total = Calc.totalPossivel(itens);
      totalInfo.textContent = 'Total possível: ' + total + ' pontos · aprovar com ' + fmtPts(minima)
        + ' (' + (total ? Math.round((minima / total) * 100) : 0) + '%)';
      totalInfo.className = 'pesos-soma ' + (minima <= total ? 'pesos-soma--ok' : 'pesos-soma--erro');
      atualizarResultado(ok);
      $('#btn-salvar').disabled = !ok;
      return ok;
    }

    function atualizarResultado(ok) {
      var box = $('#resultado');
      if (!ok) { box.innerHTML = '<p class="card__meta">Corrija os campos destacados para ver a situação.</p>'; return; }
      var s = Calc.calcularSituacao(lerNotasInput(), itens, minima);
      var b = UI.renderBadge(s.status);
      box.innerHTML = '';
      box.append(
        UI.el('div', { class: 'resultado__media', text: fmtPts(s.ganhos) + ' / ' + s.total }),
        UI.el('span', { class: 'badge badge--' + s.status }, [
          UI.el('span', { class: 'badge__icone', 'aria-hidden': 'true', text: b.icone }), s.texto,
        ]),
        UI.el('p', { class: 'card__meta', style: 'margin-top:8px;',
          text: Math.round(s.percentual) + '% · precisa de ' + fmtPts(minima) + ' pontos pra aprovar' })
      );
      if (s.pendentes.length && !s.jaGarantido) {
        var msg = s.atingivel
          ? 'Faltam ' + fmtPts(s.faltam) + ' pontos; ainda dá pra somar ' + fmtPts(s.possivelRestante) + ' nos itens não lançados.'
          : 'Mesmo gabaritando o que falta (' + fmtPts(s.possivelRestante) + '), não dá pra chegar a ' + fmtPts(minima) + '.';
        box.append(UI.el('p', { class: 'card__meta', style: 'margin-top:4px;', text: msg }));
      } else if (s.pendentes.length && s.jaGarantido) {
        box.append(UI.el('p', { class: 'card__meta', style: 'margin-top:4px;', text: 'Aprovação já garantida mesmo com itens pendentes.' }));
      }
    }

    /* ----- modelos prontos, mínima e item personalizado ----- */
    $('#preset-sem').addEventListener('click', function () {
      itens = Calc.preset(false); minima = Calc.minimaPadrao(itens); inpMinima.value = minima;
      aplicar(); UI.renderToast('Modelo sem prática aplicado (100 pontos).', 'sucesso');
    });
    $('#preset-com').addEventListener('click', function () {
      itens = Calc.preset(true); minima = Calc.minimaPadrao(itens); inpMinima.value = minima;
      aplicar(); UI.renderToast('Modelo com prática aplicado (110 pontos).', 'sucesso');
    });
    $('#btn-minima-60').addEventListener('click', function () {
      minima = Calc.minimaPadrao(itens); inpMinima.value = minima; salvarConfig(); validarTudo();
    });
    inpMinima.addEventListener('input', function () {
      var v = parseFloat(String(inpMinima.value).replace(',', '.'));
      if (!isNaN(v)) { minima = v; salvarConfig(); }
      validarTudo();
    });
    $('#btn-add-item').addEventListener('click', function () {
      var nome = ($('#novo-item-nome').value || '').trim();
      var pts = parseFloat(String($('#novo-item-pts').value).replace(',', '.'));
      if (!nome) { UI.renderToast('Dê um nome ao item.', 'erro'); return; }
      if (isNaN(pts) || pts <= 0) { UI.renderToast('Informe a pontuação do item.', 'erro'); return; }
      itens.push(Calc.novoItem(nome, pts));
      $('#novo-item-nome').value = ''; $('#novo-item-pts').value = '';
      aplicar(); UI.renderToast('Item “' + nome + '” adicionado.', 'sucesso');
    });

    $('#btn-salvar').addEventListener('click', function () {
      if (!validarTudo()) return;
      var sem = selSem.value, mat = selMat.value;
      var mapa = lerNotasInput();
      try {
        Calc.ativos(itens).forEach(function (c) { if (mapa[c.id] != null) Notas.salvarNota(sem, mat, c.id, mapa[c.id]); });
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
      // itens de nota (P1, P1 prática, Bitácoras, …) — cobre com e sem prática
      selPer.innerHTML = '<option value="">Todos os itens</option>';
      var vistos = {};
      Calc.componentes(true).concat(Calc.componentes(false)).forEach(function (c) {
        if (vistos[c.id]) return;
        vistos[c.id] = true;
        selPer.appendChild(UI.el('option', { value: c.id }, [c.label]));
      });
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

    /** pontuação máxima do item, conforme a config da matéria. */
    function maxDe(l) {
      var comps = configEfetiva(l.semestre, l.materia).itens;
      for (var i = 0; i < comps.length; i++) if (comps[i].id === l.periodo) return comps[i].max;
      return null;
    }

    /** rótulo do item já considerando itens personalizados da matéria. */
    function rotulo(l) { return labelComp(l.periodo, configEfetiva(l.semestre, l.materia).itens); }

    function render() {
      var linhas = Notas.listarAvaliacoes(filtros());
      corpo.innerHTML = '';
      if (!linhas.length) {
        corpo.appendChild(UI.renderVazio('🗃️', 'Nenhum lançamento',
          'Lance notas na <a href="calculadora.html">calculadora</a> para vê-las aqui.'));
        return;
      }
      var colunas = ['Semestre', 'Matéria', 'Item', 'Pontos', 'Lançamento', 'Última edição', 'Ações'];
      var rows = linhas.map(function (l) {
        var acoes = UI.el('div', { style: 'display:flex;gap:6px;' }, [
          UI.el('button', { class: 'btn btn--secundario btn--pequeno', onclick: function () { editar(l); } }, ['Editar']),
          UI.el('button', { class: 'btn btn--perigo btn--pequeno', onclick: function () { excluir(l); } }, ['Excluir']),
        ]);
        return [
          Manifesto.labelSemestre(l.semestre),
          Manifesto.labelMateria(l.semestre, l.materia),
          rotulo(l),
          fmtPts(l.nota) + (maxDe(l) ? ' / ' + maxDe(l) : ''),
          fmtData(l.dataLancamento),
          l.dataEdicao ? fmtData(l.dataEdicao) : '—',
          acoes,
        ];
      });
      corpo.appendChild(UI.renderTabela(colunas, rows));
    }

    function editar(l) {
      var max = maxDe(l) || 100;
      var atualTxt = String(l.nota).replace('.', ',');
      var novo = global.prompt('Novos pontos — ' + Manifesto.labelMateria(l.semestre, l.materia) + ' · ' + rotulo(l) + ' (0 a ' + max + '):', atualTxt);
      if (novo == null) return;
      var r = Calc.validarNota(novo, max);
      if (!r.ok) { UI.renderToast(r.erro, 'erro'); return; }
      UI.renderModal({
        titulo: 'Confirmar edição',
        texto: 'Alterar ' + rotulo(l) + ' de ' + fmtPts(l.nota) + ' para ' + fmtPts(r.valor) + ' pontos? Isso gera uma nova entrada no histórico.',
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
        texto: 'Excluir ' + fmtPts(l.nota) + ' pontos de ' + Manifesto.labelMateria(l.semestre, l.materia) + ' · ' + rotulo(l) + '? A ação fica registrada no histórico.',
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
    var tituloEl = $('#ver-titulo');
    if (tituloEl) tituloEl.textContent = item.titulo;
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
