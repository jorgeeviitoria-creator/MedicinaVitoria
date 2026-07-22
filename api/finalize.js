// POST /api/finalize
// Body: { fileId }
// Chamado depois que o navegador termina o upload. Torna o arquivo acessível por link
// (role reader / anyone) e devolve os metadados + link de visualização/stream.
const { driveClient, autorizado, corpoJson, linkVisualizacao } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  if (!autorizado(req)) return res.status(401).json({ erro: 'Senha inválida.' });

  const b = await corpoJson(req);
  const fileId = b && b.fileId;
  if (!fileId || typeof fileId !== 'string') return res.status(400).json({ erro: 'fileId inválido.' });

  try {
    const { drive } = driveClient();
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    const f = await drive.files.get({
      fileId,
      fields: 'id,name,size,mimeType,createdTime,webViewLink,webContentLink,thumbnailLink,appProperties',
    });
    const d = f.data;
    return res.status(200).json({
      item: {
        id: d.id,
        nome: d.name,
        tamanho: d.size ? Number(d.size) : null,
        mimeType: d.mimeType,
        dataModificacao: d.createdTime,
        preview: linkVisualizacao(d.id, d.mimeType),
        download: d.webContentLink || null,
        thumbnail: d.thumbnailLink || null,
      },
    });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao finalizar.', detalhe: String(e && e.message || e) });
  }
};
