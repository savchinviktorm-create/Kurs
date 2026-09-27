const OFFICE_EXT = /\.(doc|docx|ppt|pptx|xls|xlsx|odt|ods|odp)$/i;

export function isOfficeDocument(name = '') {
  return OFFICE_EXT.test(String(name));
}

// Optional external converter contract:
// POST multipart/form-data: file=<binary>, output=pdf
// Authorization: Bearer DOCUMENT_CONVERTER_TOKEN (when configured)
// Accepted response: raw application/pdf OR JSON { url: "https://...pdf" }.
export async function convertOfficeToPdf(file) {
  const endpoint = process.env.DOCUMENT_CONVERTER_URL;
  if (!endpoint) return null;
  const fd = new FormData();
  fd.append('file', file, file.name || 'document');
  fd.append('output', 'pdf');
  const headers = {};
  if (process.env.DOCUMENT_CONVERTER_TOKEN) headers.authorization = `Bearer ${process.env.DOCUMENT_CONVERTER_TOKEN}`;
  const res = await fetch(endpoint, { method: 'POST', headers, body: fd });
  if (!res.ok) throw new Error(`DOCUMENT_CONVERTER_HTTP_${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/pdf')) return Buffer.from(await res.arrayBuffer());
  const json = await res.json().catch(() => null);
  if (!json?.url) throw new Error('DOCUMENT_CONVERTER_INVALID_RESPONSE');
  const pdfRes = await fetch(json.url);
  if (!pdfRes.ok) throw new Error(`DOCUMENT_CONVERTER_PDF_HTTP_${pdfRes.status}`);
  return Buffer.from(await pdfRes.arrayBuffer());
}
