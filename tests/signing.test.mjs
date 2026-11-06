import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {PDFDocument,PDFName,PDFArray,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {fixturePdf,fixturePng,pngDataUrl} from './helpers/pdf-fixtures.mjs';
import {validateFields,validateSigningLayout,pngBytes,locationEvidence,pdfRectangle} from '../src/lib/signing/validation.mjs';
import {signingDetails,signingDefaults} from '../src/lib/signing/details.mjs';
import {inspectPdf,renderAgreementPdf} from '../src/lib/signing/pdf.mjs';
const field={id:'field-1',signatory_id:'s1',page_number:1,type:'SIGNATURE',x_coord:.1,y_coord:.32,width:.3,height:.06};
const signers=[{id:'s1',auth_user_id:'a1',full_name:'Test Signer One',email:'one@example.test'},{id:'s2',auth_user_id:'a2',full_name:'Test Signer Two',email:'two@example.test'}];
const fields=[field,{...field,id:'field-2',signatory_id:'s2',x_coord:.55},{...field,id:'i1',type:'INITIAL',x_coord:.85,y_coord:.91,width:.1,height:.025},{...field,id:'i2',type:'INITIAL',page_number:2,x_coord:.85,y_coord:.91,width:.1,height:.025}];
const original=await fixturePdf();const png=fixturePng();
const evidence=[{signatoryId:'s1',signature:png,initials:png,signedAt:'2026-11-06T18:00:00.000Z',locationText:'Location not provided',locationConsent:false,ipAddress:null,signatureHash:'a'.repeat(64)},{signatoryId:'s2',signature:png,initials:null,signedAt:'2026-11-06T18:01:00.000Z',locationText:'-25.1234, 28.1234',locationConsent:true,ipAddress:'192.0.2.20',signatureHash:'b'.repeat(64)}];
function textContent(pdf){let output='';for(const page of pdf.getPages()){const contents=page.node.lookup(PDFName.of('Contents'));const streams=contents instanceof PDFArray?Array.from({length:contents.size()},(_,i)=>pdf.context.lookup(contents.get(i))):[contents];for(const stream of streams){if(!(stream instanceof PDFRawStream))continue;const commands=Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');for(const match of commands.matchAll(/<([a-f0-9]+)>\s*Tj/gi))output+=Buffer.from(match[1],'hex').toString('latin1')+'\n';}}return output;}
test('normalised geometry converts to PDF bottom-left coordinates accurately',()=>{const box=pdfRectangle(field,595.28,841.89);assert.ok(Math.abs(box.x-59.528)<.001);assert.ok(Math.abs(box.y-(1-.32-.06)*841.89)<.001);});
test('mapping rejects unknown signers, invalid page, nonfinite numbers and out-of-bounds captions',()=>{
 for(const invalid of [{...field,signatory_id:'other'},{...field,page_number:3},{...field,x_coord:NaN},{...field,y_coord:.9}])assert.throws(()=>validateFields([invalid],['s1'],2));
});
test('mapping includes caption exclusion area and rejects overlapping assignments',()=>{assert.throws(()=>validateFields([field,{...field,id:'overlap',y_coord:.4}],['s1'],2),/overlap/);assert.equal(validateFields(fields,['s1','s2'],2).length,4);});
test('publishing requires every account to have a signature field',()=>{assert.throws(()=>validateSigningLayout([field],signers,2),/Every participant/);assert.equal(validateSigningLayout(fields,signers,2).length,4);});
test('signature payload accepts only bounded PNG drawings',()=>{assert.deepEqual(pngBytes(pngDataUrl()),new Uint8Array(png));assert.throws(()=>pngBytes('data:image/svg+xml,<svg/>'));assert.throws(()=>pngBytes('data:image/png;base64,'+Buffer.alloc(40).toString('base64')));const oversized=Buffer.from(png);oversized.writeUInt32BE(10000,16);assert.throws(()=>pngBytes('data:image/png;base64,'+oversized.toString('base64')));});
test('location denial ignores coordinates; permitted coordinates are bounded and rounded',()=>{
 assert.deepEqual(locationEvidence({consent:false,latitude:-25,longitude:28,status:'PROVIDED'}),{text:'Location not provided',consent:false});assert.deepEqual(locationEvidence({consent:true,status:'PROVIDED',latitude:-25.123456,longitude:28.123456}),{text:'-25.1235, 28.1235',consent:true});assert.equal(locationEvidence({consent:true,status:'PROVIDED',latitude:91,longitude:28}).consent,false);
});
test('PDF inspection accepts A4 and rejects malformed, Letter and rotated pages',async()=>{
 assert.equal((await inspectPdf(original)).pageCount,2);await assert.rejects(inspectPdf(Buffer.from('%PDF-invalid')));
 const letter=await PDFDocument.create();letter.addPage([612,792]);await assert.rejects(inspectPdf(await letter.save()),/A4/);
 const rotated=await PDFDocument.load(original);const {degrees}=await import('pdf-lib');rotated.getPage(0).setRotation(degrees(90));await assert.rejects(inspectPdf(await rotated.save()),/rotation/);
});
test('missing required initials cannot silently produce a signed PDF',async()=>{await assert.rejects(renderAgreementPdf({original,fields,evidence:[{...evidence[0],initials:null}]}),/initials/);});
test('PDF stamping preserves original pages and uses 9-point location/date captions',async()=>{
 const bytes=await renderAgreementPdf({original,fields,evidence});const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2);const text=textContent(pdf);assert.match(text,/Location not provided/);assert.match(text,/-25.1234/);assert.match(text,/Powered by CloudST TouchSign/);
 const contents=pdf.getPage(0).node.lookup(PDFName.of('Contents'));let commands='';for(let i=0;i<contents.size();i++)commands+=Buffer.from(decodePDFRawStream(pdf.context.lookup(contents.get(i))).decode()).toString('latin1');assert.match(commands,/ 9 Tf/);
});
test('certificate pagination retains every audit event and clearly marks unsigned participants',async()=>{
 const audit=Array.from({length:150},(_,i)=>({actor_email:'test-account-'+i+'@example.test',action:i===149?'LAST_EVENT_PRESENT':'VIEW',ip_address:'192.0.2.20',created_at:'2026-11-06T18:01:00.000Z'}));
 const bytes=await renderAgreementPdf({original,fields,evidence:[evidence[0]],certificate:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'CloudST completion layout QA',revision:5,finalizedAt:'2026-11-06T18:02:00.000Z',reason:'Finalized early; unsigned participants remain listed',originalHash:'c'.repeat(64),signers,audit}});
 const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>4);const text=textContent(pdf);assert.match(text,/Certificate of Completion/);assert.match(text,/NOT SIGNED/);assert.match(text,/LAST_EVENT_PRESENT/);assert.equal(pdf.catalog.has(PDFName.of('AcroForm')),false);assert.equal(pdf.getForm().getFields().length,0);
 if(process.env.WRITE_PDF_QA==='1'){await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/qa-completed.pdf',bytes);console.log('Wrote local PDF layout fixture (ignored by Git).');}
});
test('completed PDFs flatten original interactive form controls before adding marks',async()=>{
 const source=await PDFDocument.load(original);const control=source.getForm().createTextField('qa-name');control.setText('Test form value');control.addToPage(source.getPage(0),{x:40,y:680,width:220,height:20});
 const bytes=await renderAgreementPdf({original:await source.save(),fields,evidence,certificate:{id:'qa',title:'Form flatten check',revision:1,finalizedAt:'2026-11-06T18:02:00Z',reason:'All signed',originalHash:'c'.repeat(64),signers,audit:[]}});assert.equal((await PDFDocument.load(bytes)).getForm().getFields().length,0);
});

test('declared signing date validates calendar dates and uses South African current year',()=>{
 const now=new Date('2026-11-07T12:00:00Z');
 assert.deepEqual(signingDetails({day:7,month:11,place:'  Pretoria  '},now),{day:7,month:11,year:2026,place:'Pretoria'});
 for(const input of [{day:31,month:4,place:'Pretoria'},{day:29,month:2,place:'Pretoria'},{day:0,month:11,place:'Pretoria'},{day:7,month:13,place:'Pretoria'},{day:7,month:11,place:'x'},{day:7,month:11,place:'x'.repeat(41)}])assert.throws(()=>signingDetails(input,now));
 assert.equal(signingDetails({day:29,month:2,place:'Cape Town'},new Date('2028-02-01T12:00:00Z')).day,29);
 assert.equal(signingDefaults(new Date('2026-12-31T23:30:00Z')).year,2027);
});
test('mapped day, month and place print independently, with other signer evidence retained',async()=>{
 const details=signingDetails({day:7,month:11,place:'Pretoria'},new Date('2026-11-07T12:00:00Z'));
 const extra=['DAY','MONTH','PLACE'].map((type,i)=>({...field,id:'details-'+i,type,x_coord:.1+i*.28,y_coord:.65,width:.25,height:.03}));
 validateFields([...fields,...extra],['s1','s2'],2);
 const records=[{...evidence[0],signingDetails:details,locationText:details.place},evidence[1]];
 const bytes=await renderAgreementPdf({original,fields:[...fields,...extra],evidence:records});
 const text=textContent(await PDFDocument.load(bytes));
 assert.match(text,/07/);assert.match(text,/November/);assert.match(text,/Pretoria/);assert.match(text,/Submitted/);assert.match(text,/-25.1234/);
 await assert.rejects(renderAgreementPdf({original,fields:[...fields,...extra],evidence}),/place are missing/);
 if(process.env.WRITE_PDF_QA==='1'){await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/qa-signing-details.pdf',bytes);}
});
