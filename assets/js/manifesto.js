/* manifesto.js — carrega e filtra o manifesto de conteúdo + config de matérias.
   Funciona tanto abrindo do disco (file://, via data/conteudo.js) quanto servido por HTTP (fetch).
   Exposto em window.Manifesto. */
(function (global) {
  'use strict';

  var _manifesto = null;
  var _config = null;

  function normalizar(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, ''); // remove acentos
  }

  function base() {
    // caminho relativo à raiz do site (páginas ficam na raiz).
    return '';
  }

  /** carrega manifesto: prioriza global (file://), cai para fetch do JSON. */
  function carregarManifesto() {
    if (_manifesto) return Promise.resolve(_manifesto);
    if (global.__CONTEUDO__) {
      _manifesto = global.__CONTEUDO__;
      _config = global.__CONFIG_MATERIAS__ || null;
      return Promise.resolve(_manifesto);
    }
    return fetch(base() + 'data/conteudo.json')
      .then(function (r) {
        if (!r.ok) throw new Error('conteudo.json não encontrado (HTTP ' + r.status + ')');
        return r.json();
      })
      .then(function (json) {
        _manifesto = json;
        return _manifesto;
      });
  }

  /** carrega config de matérias (pesos, labels, mediaMinima). */
  function carregarConfig() {
    if (_config) return Promise.resolve(_config);
    if (global.__CONFIG_MATERIAS__) { _config = global.__CONFIG_MATERIAS__; return Promise.resolve(_config); }
    return fetch(base() + 'data/config-materias.json')
      .then(function (r) {
        if (!r.ok) throw new Error('config-materias.json não encontrado (HTTP ' + r.status + ')');
        return r.json();
      })
      .then(function (json) { _config = json; return _config; });
  }

  function listarSemestres() {
    // combina semestres do manifesto com os do config (config pode ter semestre sem material ainda).
    var mapa = {};
    if (_manifesto) (_manifesto.semestres || []).forEach(function (s) { mapa[s.slug] = s.label; });
    if (_config) Object.keys(_config).forEach(function (slug) { mapa[slug] = _config[slug].label || mapa[slug] || slug; });
    return Object.keys(mapa).sort().map(function (slug) { return { slug: slug, label: mapa[slug] }; });
  }

  /** lista matérias de um semestre a partir do config (fonte da grade), enriquecidas com contagem do manifesto. */
  function listarMaterias(semestreSlug) {
    var out = [];
    var cfgSem = _config && _config[semestreSlug];
    if (cfgSem && cfgSem.materias) {
      Object.keys(cfgSem.materias).forEach(function (slug) {
        out.push({ slug: slug, label: cfgSem.materias[slug].label || slug, semestre: semestreSlug });
      });
    }
    // inclui matérias do manifesto que não estejam no config (fallback)
    if (_manifesto) (_manifesto.materias || []).forEach(function (m) {
      if (m.semestre !== semestreSlug) return;
      if (!out.some(function (x) { return x.slug === m.slug; })) out.push(m);
    });
    return out;
  }

  function itensDe(semestreSlug, materiaSlug) {
    if (!_manifesto) return [];
    return (_manifesto.itens || []).filter(function (i) {
      return i.semestre === semestreSlug && i.materia === materiaSlug;
    });
  }

  /** listarPorMateria: itens agrupados por período -> tipo. */
  function listarPorMateria(semestreSlug, materiaSlug) {
    var itens = itensDe(semestreSlug, materiaSlug);
    var grupos = { P1: {}, P2: {}, P3: {} };
    itens.forEach(function (i) {
      var per = grupos[i.periodo] || (grupos[i.periodo] = {});
      (per[i.tipo] || (per[i.tipo] = [])).push(i);
    });
    return { itens: itens, grupos: grupos, total: itens.length };
  }

  function contagemPorTipo(semestreSlug, materiaSlug) {
    var itens = itensDe(semestreSlug, materiaSlug);
    var c = {};
    itens.forEach(function (i) { c[i.tipo] = (c[i.tipo] || 0) + 1; });
    return { total: itens.length, porTipo: c };
  }

  /** buscar por título (case-insensitive, ignora acento). Sem semestreSlug busca todos. */
  function buscar(termo, semestreSlug) {
    if (!_manifesto || !termo) return [];
    var t = normalizar(termo).trim();
    if (!t) return [];
    return (_manifesto.itens || []).filter(function (i) {
      if (semestreSlug && i.semestre !== semestreSlug) return false;
      return normalizar(i.titulo).indexOf(t) !== -1 || normalizar(i.materia).indexOf(t) !== -1;
    });
  }

  function itemPorId(id) {
    if (!_manifesto) return null;
    return (_manifesto.itens || []).find(function (i) { return i.id === id; }) || null;
  }

  function configDaMateria(semestreSlug, materiaSlug) {
    var cfgSem = _config && _config[semestreSlug];
    var m = cfgSem && cfgSem.materias && cfgSem.materias[materiaSlug];
    return m || null;
  }

  function labelMateria(semestreSlug, materiaSlug) {
    var m = configDaMateria(semestreSlug, materiaSlug);
    if (m && m.label) return m.label;
    if (_manifesto) {
      var mm = (_manifesto.materias || []).find(function (x) { return x.semestre === semestreSlug && x.slug === materiaSlug; });
      if (mm) return mm.label;
    }
    return materiaSlug;
  }

  function labelSemestre(semestreSlug) {
    var cfgSem = _config && _config[semestreSlug];
    if (cfgSem && cfgSem.label) return cfgSem.label;
    if (_manifesto) {
      var s = (_manifesto.semestres || []).find(function (x) { return x.slug === semestreSlug; });
      if (s) return s.label;
    }
    return semestreSlug;
  }

  global.Manifesto = {
    carregarManifesto: carregarManifesto,
    carregarConfig: carregarConfig,
    listarSemestres: listarSemestres,
    listarMaterias: listarMaterias,
    listarPorMateria: listarPorMateria,
    contagemPorTipo: contagemPorTipo,
    buscar: buscar,
    itemPorId: itemPorId,
    configDaMateria: configDaMateria,
    labelMateria: labelMateria,
    labelSemestre: labelSemestre,
  };
})(window);
