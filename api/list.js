// POST /api/list
// Body: { semestre, materia, tipo, periodo? }
// Lista os anexos daquela matéria/tipo (arquivos criados pelo app, via appProperties).
const { driveClient, pastaRaiz, autorizado, limpar, corpoJson, linkVisualizacao } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  if (!autorizado(req)) return res.status(401).json({ erro: 'Senha inválida.' });

  const b = await corpoJson(req);
  const { semestre, materia, tipo, periodo } = b || {};
  if (!semestre || !materia || !tipo) return res.status(400).json({ erro: 'Faltam campos.' });

  const cond = [
    "trashed = false",
    "appProperties has { key='portal' and value='medicina-vitoria' }",
    "appProperties has { key='semestre' and value='" + limpar(semestre) + "' }",
    "appProperties has { key='materia' and value='" + limpar(materia) + "' }",
    "appProperties has { key='tipo' and value='" + limpar(tipo) + "' }",
  ];
  if (pastaRaiz()) cond.push("'" + pastaRaiz() + "' in parents");
  if (periodo) cond.push("appProperties has { key='periodo' and value='" + limpar(periodo) + "' }");

  try {
    const { drive } = driveClient();
    const out = await drive.files.list({
      q: cond.join(' and '),
      fields: 'files(id,name,size,mimeType,createdTime,webContentLink,thumbnailLink)',
      orderBy: 'createdTime desc',
      pageSize: 200,
      spaces: 'drive',
    });
    const itens = (out.data.files || []).map((d) => ({
      id: d.id,
      nome: d.name,
      tamanho: d.size ? Number(d.size) : null,
      mimeType: d.mimeType,
      dataModificacao: d.createdTime,
      preview: linkVisualizacao(d.id, d.mimeType),
      download: d.webContentLink || null,
      thumbnail: d.thumbnailLink || null,
    }));
    return res.status(200).json({ itens });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao listar.', detalhe: String(e && e.message || e) });
  }
};
