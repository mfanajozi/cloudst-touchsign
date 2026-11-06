import {PDFDocument,PDFName,PDFSignature,StandardFonts,rgb} from 'pdf-lib';
import {MAX_PDF_BYTES,pdfRectangle,SigningInputError} from './validation.mjs';
export async function inspectPdf(bytes){
 if(bytes.length>MAX_PDF_BYTES)throw new SigningInputError('PDF must be no larger than 4 MB.');
 let pdf;try{pdf=await PDFDocument.load(bytes,{updateMetadata:false});}catch{throw new SigningInputError('Use an unencrypted, valid PDF.');}
 if(pdf.getForm().getFields().some(field=>field instanceof PDFSignature))throw new SigningInputError('Upload an unsigned agreement without existing digital signature fields.');
 if(pdf.isEncrypted||pdf.getPageCount()<1||pdf.getPageCount()>100)throw new SigningInputError('Use an unencrypted PDF of 1–100 pages.');
 const sizes=pdf.getPages().map(page=>{const {width,height}=page.getSize();
  if(page.getRotation().angle%360!==0||!((Math.abs(width-595.28)<4&&Math.abs(height-841.89)<4)||(Math.abs(width-841.89)<4&&Math.abs(height-595.28)<4)))throw new SigningInputError('Export the agreement as A4 pages without page rotation before mapping signatures.');
  return {width,height};
 });
 return {pageCount:sizes.length,sizes};
}
const printable=text=>String(text??'').normalize('NFKD').replace(/\p{Diacritic}/gu,'').replace(/[^\x20-\x7E]/g,'?');
function wrapped(text,font,size,width){
 const words=printable(text).split(/\s+/);const lines=[];let line='';
 for(const word of words){
  if(font.widthOfTextAtSize(word,size)>width){if(line){lines.push(line);line='';}let part='';for(const char of word){if(font.widthOfTextAtSize(part+char,size)>width){lines.push(part);part='';}part+=char;}line=part;continue;}
  if(line&&font.widthOfTextAtSize(line+' '+word,size)>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);return lines;
}
/** @param {{original:Uint8Array,fields:Array<any>,evidence:Array<any>,certificate?:any,watermark?:boolean}} options */
export async function renderAgreementPdf({original,fields,evidence,certificate=null,watermark=true}){
 const pdf=await PDFDocument.load(original,{updateMetadata:false});const font=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);const pages=pdf.getPages();
 if(certificate){try{const form=pdf.getForm();if(form.getFields().length)form.flatten();pdf.catalog.delete(PDFName.of('AcroForm'));}catch{throw new SigningInputError('Export the source as a flat PDF before finalizing it.');}}
 for(const record of evidence){
  const signature=await pdf.embedPng(record.signature);const initials=record.initials?await pdf.embedPng(record.initials):null;
  for(const field of fields.filter(f=>f.signatory_id===record.signatoryId)){
   const page=pages[field.page_number-1];if(!page)throw new SigningInputError('Mapped page is missing.');
   const box=pdfRectangle(field,page.getWidth(),page.getHeight());
   if(field.type==='DATE')page.drawText(new Date(record.signedAt).toISOString().slice(0,10),{x:box.x,y:box.y+Math.max(0,(box.height-9)/2),size:9,font});
   else{
    const image=field.type==='INITIAL'?initials:signature;if(!image)throw new SigningInputError('Required initials are missing.');
    const size=image.scaleToFit(box.width,box.height);page.drawImage(image,{x:box.x+(box.width-size.width)/2,y:box.y+(box.height-size.height)/2,width:size.width,height:size.height});
    if(field.type==='SIGNATURE'){
     const label=`Signed at ${record.locationText} on ${new Date(record.signedAt).toISOString().replace('T',' ').slice(0,19)} UTC`;
     const lines=wrapped(label,font,9,box.width);if(lines.length>3)throw new SigningInputError('Make the signature field wider to fit its date and location.');
     lines.forEach((line,i)=>page.drawText(line,{x:box.x,y:box.y-11-i*11,size:9,font,color:rgb(.25,.25,.25)}));
    }
   }
  }
 }
 if(watermark)for(const page of pages)page.drawText('Powered by CloudST TouchSign',{x:40,y:16,size:8,font,color:rgb(.5,.5,.5)});
 if(certificate){
  let page,y;let sequence=0;
  const next=()=>{page=pdf.addPage([595.28,841.89]);sequence++;y=790;page.drawText('CLOUDST TOUCHSIGN',{x:40,y,size:10,font:bold,color:rgb(.46,.35,.16)});y-=30;page.drawText(sequence===1?'Certificate of Completion':'Completion record - continued',{x:40,y,size:19,font:bold});y-=30;page.drawText(`Record ${sequence} | Agreement ${certificate.id}`,{x:40,y:22,size:8,font});};
  const text=(value,{size=9,heading=false}={})=>{for(const line of wrapped(value,heading?bold:font,size,515)){if(y<62)next();page.drawText(line,{x:40,y,size,font:heading?bold:font});y-=size+5;}};
  next();text(certificate.title,{size:12,heading:true});text(`Finalized: ${certificate.finalizedAt} | Revision: ${certificate.revision}`);text(`Reason: ${certificate.reason}`);text(`Original SHA-256: ${certificate.originalHash}`);text('This record documents the platform signing workflow. The canonical completed file is frozen in TouchSign; downloaded copies may be edited outside the platform.');y-=12;
  text('PARTICIPANTS',{heading:true});
  for(const signer of certificate.signers){const record=evidence.find(r=>r.signatoryId===signer.id);text(`${signer.full_name} | ${signer.email} | ${record?'SIGNED':'NOT SIGNED'}`,{heading:true});if(record){text(`UTC: ${record.signedAt} | IP: ${record.ipAddress||'Unavailable'}`);text(`Location consent: ${record.locationConsent?'Provided':'Not provided'} | ${record.locationText}`);text(`Signature SHA-256: ${record.signatureHash}`);}y-=8;}
  text('DOCUMENT AUDIT SNAPSHOT',{heading:true});text(`Events available at finalization snapshot ${certificate.finalizedAt}. Later views/downloads remain in the platform audit record.`);
  for(const event of certificate.audit)text(`${new Date(event.created_at).toISOString()} | ${event.actor_email||'System'} | ${event.action} | IP: ${event.ip_address||'Unavailable'}`);
 }
 const bytes=await pdf.save();if(bytes.length>MAX_PDF_BYTES)throw new SigningInputError('The completed PDF exceeds 4 MB. Use a smaller original agreement.');return bytes;
}
