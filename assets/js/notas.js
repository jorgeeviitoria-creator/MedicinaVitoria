/* notas.js — CRUD de notas no localStorage + histórico + export/import backup.
   Exposto em window.Notas. */
(function (global) {
  'use strict';

  var CHAVE = 'notas-vitoria';
  var CHAVE_CFG = 'config-materias-vitoria';
  var VERSAO = 2;

  function agora() { return new Date().toISOString(); }

  function estruturaVazia() { return { versao: VERSAO, semestres: {} }; }

  /** lê e faz parse do store; retorna estrutura vazia se ausente/corrompido. */
  function ler() {
    var raw;
    try { raw = global.localStorage.getItem(CHAVE); }
    catch (e) { console.error('[notas] localStorage indisponível:', e); return estruturaVazia(); }
    if (!raw) return estruturaVazia();
    try {
      var dados = JSON.parse(raw);
      return migrar(dados);
    } catch (e) {
      console.error('[notas] store corrompido, ignorando:', e);
      return estruturaVazia();
    }
  }

  /** grava o store; lança erro se localStorage cheio/bloqueado (chamador deve tratar). */
  function gravar(dados) {
    try {
      global.localStorage.setItem(CHAVE, JSON.stringify(dados));
    } catch (e) {
      var cheio = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
      var msg = cheio
        ? 'Armazenamento local cheio — o lançamento não foi salvo. Exporte um backup e libere espaço.'
        : 'Não foi possível salvar no navegador (armazenamento bloqueado, ex. modo anônimo restrito). O lançamento não foi salvo.';
      var err = new Error(msg);
      err.causa = e;
      throw err;
    }
  }

  /** migração de esquema por versão (nunca falha silenciosamente). */
  function migrar(dados) {
    if (!dados || typeof dados !== 'object') return estruturaVazia();
    var v = dados.versao || 0;
    // v0 -> v1: garante container semestres.
    if (v < 1) {
      dados = { versao: 1, semestres: dados.semestres || {} };
    }
    // v1 -> v2: notas deixam de ser 0–10 (com peso) e passam a ser PONTOS.
    // Converte proporcionalmente as antigas P1/P2/P3 (P1,P2 valem 20; P3 vale 40).
    if ((dados.versao || 1) < 2) {
      var escala = { P1: 2, P2: 2, P3: 4 };
      Object.keys(dados.semestres || {}).forEach(function (sem) {
        var mats = dados.semestres[sem] || {};
        Object.keys(mats).forEach(function (mat) {
          var av = (mats[mat] && mats[mat].avaliacoes) || {};
          Object.keys(av).forEach(function (k) {
            if (escala[k] && av[k] && typeof av[k].nota === 'number' && av[k].nota <= 10) {
              av[k].nota = Math.round(av[k].nota * escala[k] * 10) / 10;
            }
          });
        });
      });
    }
    dados.versao = VERSAO;
    if (!dados.semestres) dados.semestres = {};
    return dados;
  }

  function garantirMateria(dados, sem, mat) {
    if (!dados.semestres[sem]) dados.semestres[sem] = {};
    if (!dados.semestres[sem][mat]) dados.semestres[sem][mat] = { avaliacoes: {}, historico: [] };
    var m = dados.semestres[sem][mat];
    if (!m.avaliacoes) m.avaliacoes = {};
    if (!m.historico) m.historico = [];
    return m;
  }

  /** obterNotas -> { avaliacoes, historico }. */
  function obterNotas(sem, mat) {
    var dados = ler();
    var m = dados.semestres[sem] && dados.semestres[sem][mat];
    return m ? { avaliacoes: m.avaliacoes || {}, historico: m.historico || [] }
             : { avaliacoes: {}, historico: [] };
  }

  /** mapa {P1:nota,...} só com as notas lançadas. */
  function notasComoMapa(sem, mat) {
    var av = obterNotas(sem, mat).avaliacoes;
    var out = {};
    Object.keys(av).forEach(function (p) { if (av[p] && typeof av[p].nota === 'number') out[p] = av[p].nota; });
    return out;
  }

  function salvarNota(sem, mat, periodo, valor) {
    var dados = ler();
    var m = garantirMateria(dados, sem, mat);
    var t = agora();
    var existente = m.avaliacoes[periodo];
    if (existente && typeof existente.nota === 'number') {
      // já existe -> tratar como edição (mantém histórico correto)
      return editarNotaInterno(dados, m, sem, mat, periodo, valor, existente.nota, t);
    }
    m.avaliacoes[periodo] = { nota: valor, dataLancamento: t, dataEdicao: null };
    m.historico.push({ acao: 'lancamento', periodo: periodo, nota: valor, data: t });
    gravar(dados);
    return m.avaliacoes[periodo];
  }

  function editarNotaInterno(dados, m, sem, mat, periodo, novoValor, notaAnterior, t) {
    m.avaliacoes[periodo] = {
      nota: novoValor,
      dataLancamento: (m.avaliacoes[periodo] && m.avaliacoes[periodo].dataLancamento) || t,
      dataEdicao: t,
    };
    m.historico.push({ acao: 'edicao', periodo: periodo, notaAnterior: notaAnterior, notaNova: novoValor, data: t });
    gravar(dados);
    return m.avaliacoes[periodo];
  }

  function editarNota(sem, mat, periodo, novoValor) {
    var dados = ler();
    var m = garantirMateria(dados, sem, mat);
    var atual = m.avaliacoes[periodo];
    if (!atual || typeof atual.nota !== 'number') {
      // não havia nota -> lançamento
      return salvarNota(sem, mat, periodo, novoValor);
    }
    return editarNotaInterno(dados, m, sem, mat, periodo, novoValor, atual.nota, agora());
  }

  function excluirNota(sem, mat, periodo) {
    var dados = ler();
    var m = dados.semestres[sem] && dados.semestres[sem][mat];
    if (!m || !m.avaliacoes || !m.avaliacoes[periodo]) return false;
    var notaAnterior = m.avaliacoes[periodo].nota;
    delete m.avaliacoes[periodo];
    m.historico.push({ acao: 'exclusao', periodo: periodo, notaAnterior: notaAnterior, data: agora() });
    gravar(dados);
    return true;
  }

  /** obterHistorico(filtros?) -> lista achatada e ordenada (desc por data).
      filtros: { semestre, materia, periodo } (todos opcionais). */
  function obterHistorico(filtros) {
    filtros = filtros || {};
    var dados = ler();
    var linhas = [];
    Object.keys(dados.semestres).forEach(function (sem) {
      if (filtros.semestre && filtros.semestre !== sem) return;
      var mats = dados.semestres[sem];
      Object.keys(mats).forEach(function (mat) {
        if (filtros.materia && filtros.materia !== mat) return;
        (mats[mat].historico || []).forEach(function (h) {
          if (filtros.periodo && filtros.periodo !== h.periodo) return;
          linhas.push({
            semestre: sem, materia: mat,
            periodo: h.periodo, acao: h.acao,
            nota: (h.nota != null ? h.nota : h.notaNova),
            notaAnterior: h.notaAnterior != null ? h.notaAnterior : null,
            data: h.data,
          });
        });
      });
    });
    linhas.sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
    return linhas;
  }

  /** avaliações atuais achatadas para a tabela do histórico (estado corrente, não o log). */
  function listarAvaliacoes(filtros) {
    filtros = filtros || {};
    var dados = ler();
    var linhas = [];
    Object.keys(dados.semestres).forEach(function (sem) {
      if (filtros.semestre && filtros.semestre !== sem) return;
      var mats = dados.semestres[sem];
      Object.keys(mats).forEach(function (mat) {
        if (filtros.materia && filtros.materia !== mat) return;
        var av = mats[mat].avaliacoes || {};
        Object.keys(av).forEach(function (per) {
          if (filtros.periodo && filtros.periodo !== per) return;
          linhas.push({
            semestre: sem, materia: mat, periodo: per,
            nota: av[per].nota,
            dataLancamento: av[per].dataLancamento,
            dataEdicao: av[per].dataEdicao,
          });
        });
      });
    });
    linhas.sort(function (a, b) {
      return (b.dataEdicao || b.dataLancamento || '').localeCompare(a.dataEdicao || a.dataLancamento || '');
    });
    return linhas;
  }

  /** exportarBackup: baixa notas-vitoria-backup-AAAA-MM-DD.json com todos os semestres. */
  function exportarBackup() {
    var dados = ler();
    var texto = JSON.stringify(dados, null, 2);
    var blob = new Blob([texto], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var data = new Date().toISOString().slice(0, 10);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'notas-vitoria-backup-' + data + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return true;
  }

  function validarSchema(obj) {
    if (!obj || typeof obj !== 'object') return 'Arquivo não é um JSON de backup válido.';
    if (typeof obj.versao !== 'number') return 'Backup sem campo "versao" — arquivo incompatível.';
    if (obj.versao > VERSAO) return 'Backup de versão mais nova (' + obj.versao + ') que este portal (' + VERSAO + ').';
    if (obj.semestres && typeof obj.semestres !== 'object') return 'Campo "semestres" inválido no backup.';
    return null; // ok
  }

  /** importarBackup(arquivo File) -> Promise. Valida schema antes de sobrescrever;
      nunca apaga dados atuais se o arquivo for inválido. */
  function importarBackup(arquivo) {
    return new Promise(function (resolve, reject) {
      if (!arquivo) return reject(new Error('Nenhum arquivo selecionado.'));
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Falha ao ler o arquivo.')); };
      reader.onload = function () {
        var obj;
        try { obj = JSON.parse(reader.result); }
        catch (e) { return reject(new Error('JSON malformado — o backup não foi importado e seus dados atuais estão intactos.')); }
        var erro = validarSchema(obj);
        if (erro) return reject(new Error(erro + ' Seus dados atuais estão intactos.'));
        var migrado = migrar(obj);
        try { gravar(migrado); }
        catch (e) { return reject(e); }
        resolve(migrado);
      };
      reader.readAsText(arquivo);
    });
  }

  /* ---------- Configuração por matéria (temPratica / minimaPontos) ----------
     Fica no navegador e sobrepõe o padrão de data/config-materias.json,
     pra dar pra ajustar sem editar o JSON. */
  function lerOverrides() {
    try { return JSON.parse(global.localStorage.getItem(CHAVE_CFG) || '{}'); } catch (_) { return {}; }
  }
  function obterOverride(sem, mat) {
    var o = lerOverrides();
    return (o[sem] && o[sem][mat]) || {};
  }
  function salvarOverride(sem, mat, obj) {
    var o = lerOverrides();
    if (!o[sem]) o[sem] = {};
    var atual = o[sem][mat] || {};
    Object.keys(obj).forEach(function (k) { atual[k] = obj[k]; });
    o[sem][mat] = atual;
    try { global.localStorage.setItem(CHAVE_CFG, JSON.stringify(o)); }
    catch (e) { throw new Error('Não foi possível salvar a configuração da matéria.'); }
    return atual;
  }

  global.Notas = {
    CHAVE: CHAVE, VERSAO: VERSAO,
    obterOverride: obterOverride,
    salvarOverride: salvarOverride,
    obterNotas: obterNotas,
    notasComoMapa: notasComoMapa,
    salvarNota: salvarNota,
    editarNota: editarNota,
    excluirNota: excluirNota,
    obterHistorico: obterHistorico,
    listarAvaliacoes: listarAvaliacoes,
    exportarBackup: exportarBackup,
    importarBackup: importarBackup,
  };
})(window);
