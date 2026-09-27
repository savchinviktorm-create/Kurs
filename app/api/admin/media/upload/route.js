import crypto from 'crypto';
import { requireAdmin, auditAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';
import { COURSE_IMPORT_MAX_BYTES } from '@/lib/env';
import { convertOfficeToPdf, isOfficeDocument } from '@/lib/document-converter';

export const runtime='nodejs';
const extFor=(name='file')=>{const m=name.match(/(\.[a-z0-9]{1,8})$/i);return m?m[1].toLowerCase():''};

export async function POST(request){
  try{
    const{admin}=await requireAdmin(request,'editor');
    const fd=await request.formData();
    const file=fd.get('file');
    if(!file||typeof file==='string')throw new Error('FILE_REQUIRED');
    if(file.size>COURSE_IMPORT_MAX_BYTES)throw new Error('FILE_TOO_LARGE_FOR_DIRECT_UPLOAD_USE_EXTERNAL_PROVIDER');
    const sb=getSupabaseAdmin();
    let mediaType=String(fd.get('media_type')||'file');
    const originalKey=`uploads/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${extFor(file.name)}`;
    const originalBytes=Buffer.from(await file.arrayBuffer());
    const{error:upError}=await sb.storage.from('course-media').upload(originalKey,originalBytes,{contentType:file.type||'application/octet-stream',upsert:false});
    if(upError)throw upError;

    let sourceLocator=originalKey;
    let mimeType=file.type||null;
    let sizeBytes=file.size;
    const metadata={ original_name:file.name };

    if(isOfficeDocument(file.name)){
      const pdfBytes=await convertOfficeToPdf(file);
      if(pdfBytes){
        const pdfKey=`converted/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.pdf`;
        const{error:pdfError}=await sb.storage.from('course-media').upload(pdfKey,pdfBytes,{contentType:'application/pdf',upsert:false});
        if(pdfError)throw pdfError;
        sourceLocator=pdfKey; mediaType='pdf'; mimeType='application/pdf'; sizeBytes=pdfBytes.length;
        metadata.original_path=originalKey; metadata.converted_from=file.name; metadata.converted_to='pdf';
      } else {
        metadata.inline_preview_unavailable=true;
        metadata.converter_required=true;
      }
    }

    const{data,error}=await sb.from('media_assets').insert({
      provider_key:'supabase',media_type:mediaType,title:String(fd.get('title')||file.name),source_locator:sourceLocator,
      mime_type:mimeType,size_bytes:sizeBytes,protection_level:String(fd.get('protection_level')||'enhanced'),
      watermark_enabled:String(fd.get('watermark_enabled')||'true')!=='false',metadata,status:'ready'
    }).select('*').single();
    if(error)throw error;
    await auditAdmin(admin.telegram_id,'media.upload','media_asset',data.id,{name:file.name,size:file.size,converted:Boolean(metadata.converted_to)});
    return Response.json({ok:true,media:data,warning:metadata.converter_required?'Office-файл збережено, але для inline-перегляду налаштуйте DOCUMENT_CONVERTER_URL.':null});
  }catch(e){return jsonError(e,400)}
}
