// POST /api/upload-url
// Body: { semestre, materia, tipo, periodo?, nome, contentType }
// Cria uma sessão de upload RESUMÁVEL no Drive e devolve { sessionUrl }.
// O navegador dá PUT do arquivo direto nessa URL (bytes NÃO passam pelo Vercel).
const { driveClient, pastaRaiz, autorizado, limpar, corpoJson } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  if (!autorizado(req)) return res.status(401).json({ erro: 'Senha inválida.' });

  const b = await corpoJson(req);
  const { semestre, materia, tipo, periodo, nome, contentType } = b || {};
  if (!semestre || !materia || !tipo || !nome) return res.status(400).json({ erro: 'Faltam campos.' });
  if (tipo !== 'anotacoes' && tipo !== 'trabalhos') return res.status(400).json({ erro: 'tipo inválido.' });

  try {
    const { auth } = driveClient();
    const { token } = await auth.getAccessToken();
    if (!token) throw new Error('sem access token (refresh token inválido?)');

    const appProperties = {
      portal: 'medicina-vitoria',
      semestre: limpar(semestre),
      materia: limpar(materia),
      periodo: periodo ? limpar(periodo) : '',
      tipo: limpar(tipo),
    };
    const metadata = {
      name: nome,
      mimeType: contentType || 'application/octet-stream',
      parents: pastaRaiz() ? [pastaRaiz()] : undefined,
      appProperties,
    };

    // O Google só habilita CORS na sessão resumável se o header Origin do navegador
    // for enviado JÁ na criação da sessão. Repassamos o Origin da requisição do browser.
    const origin = req.headers.origin || (req.headers.host ? 'https://' + req.headers.host : '');
    const cabecalhos = {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType || 'application/octet-stream',
    };
    if (origin) cabecalhos['Origin'] = origin;

    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(metadata),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ erro: 'Drive recusou a sessão.', detalhe: t.slice(0, 300) });
    }
    const sessionUrl = r.headers.get('location');
    if (!sessionUrl) return res.status(502).json({ erro: 'Drive não devolveu a URL de upload.' });
    return res.status(200).json({ sessionUrl });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao iniciar upload.', detalhe: String(e && e.message || e) });
  }
};
