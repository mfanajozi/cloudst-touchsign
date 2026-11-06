export class SigningInputError extends Error {}
export const MAX_PDF_BYTES=4*1024*1024;
export const captionHeight=field=>field.type==='SIGNATURE'?0.05:0;
export function validateFields(fields,signerIds,pageCount){
 if(!Array.isArray(fields)||fields.length>1000)throw new SigningInputError('Use at most 1,000 fields.');
 const known=new Set(signerIds);
 return fields.map((f,index)=>{
  if(!f||!known.has(f.signatory_id)||!['SIGNATURE','INITIAL','DATE','DAY','MONTH','PLACE'].includes(f.type)||!Number.isInteger(f.page_number)||f.page_number<1||f.page_number>pageCount)throw new SigningInputError('A field has an invalid signer, type or page.');
  for(const key of ['x_coord','y_coord','width','height'])if(typeof f[key]!=='number'||!Number.isFinite(f[key]))throw new SigningInputError('Field coordinates must be finite numbers.');
  if(f.width<({SIGNATURE:0.24,INITIAL:0.07,DATE:0.16,DAY:0.05,MONTH:0.12,PLACE:0.16}[f.type])||f.height<0.015||f.x_coord<0.025||f.y_coord<0.025||f.x_coord+f.width>0.975||f.y_coord+f.height+captionHeight(f)>0.965)throw new SigningInputError('Keep fields and signature captions inside the page margins.');
  for(let i=0;i<index;i++){
   const b=fields[i];if(b.page_number!==f.page_number)continue;
   if(f.x_coord<b.x_coord+b.width&&f.x_coord+f.width>b.x_coord&&f.y_coord<b.y_coord+b.height+captionHeight(b)&&f.y_coord+f.height+captionHeight(f)>b.y_coord)throw new SigningInputError('Fields overlap. Leave room below each signature for its date and location.');
  }
  return {signatory_id:f.signatory_id,page_number:f.page_number,type:f.type,x_coord:f.x_coord,y_coord:f.y_coord,width:f.width,height:f.height};
 });
}
export function validateSigningLayout(fields,signers,pageCount){
 const valid=validateFields(fields,signers.map(s=>s.id),pageCount);
 if(!signers.length||signers.length>10||signers.some(s=>!s.auth_user_id||!valid.some(f=>f.signatory_id===s.id&&f.type==='SIGNATURE')))throw new SigningInputError('Every participant needs a login and at least one signature field.');
 return valid;
}
export function pngBytes(value,required=true){
 if(!value&&!required)return null;
 if(typeof value!=='string'||value.length>220000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw new SigningInputError('Draw and confirm a PNG signature or initials.');
 const binary=atob(value.slice('data:image/png;base64,'.length));
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 if(bytes.length<33||bytes.length>160000||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v))throw new SigningInputError('Invalid PNG drawing.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const w=view.getUint32(16),h=view.getUint32(20);
 if(w<20||h<20||w>1600||h>600)throw new SigningInputError('Drawing dimensions are not supported.');
 return bytes;
}
export function locationEvidence(location){
 if(location?.consent===true&&location.status==='PROVIDED'&&typeof location.latitude==='number'&&typeof location.longitude==='number'&&Number.isFinite(location.latitude)&&Number.isFinite(location.longitude)&&Math.abs(location.latitude)<=90&&Math.abs(location.longitude)<=180)return {text:`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,consent:true};
 return {text:'Location not provided',consent:false};
}
export function pdfRectangle(field,pageWidth,pageHeight){return {x:field.x_coord*pageWidth,y:(1-field.y_coord-field.height)*pageHeight,width:field.width*pageWidth,height:field.height*pageHeight};}
