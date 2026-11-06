'use client';
import {useState} from 'react';
export default function DocumentPreview({id,title}:{id:string;title:string}){
 const [visible,setVisible]=useState(true);const [failed,setFailed]=useState(false);
 const url=`/api/documents/${id}/preview`;
 return <section className="workspace-panel pdf-preview" aria-label="Document preview"><div className="preview-heading"><h2>Document preview</h2><button type="button" className="outline-button" aria-expanded={visible} aria-controls="pdf-preview-frame" onClick={()=>setVisible(!visible)}>{visible?'Hide preview':'Show preview'}</button></div><p className="field-hint">Review the PDF here before adding signers. Your browser provides page navigation and zoom. <a href={url} target="_blank" rel="noopener noreferrer">Open full preview ↗</a></p>{visible&&(failed?<p className="field-hint" role="alert">The embedded preview could not load. Use Open full preview or Download PDF to review the agreement.</p>:<iframe id="pdf-preview-frame" title={`PDF preview: ${title}`} className="pdf-frame" src={`${url}#toolbar=1&navpanes=0&view=FitH`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>)}<p className="field-hint">If your device does not display embedded PDFs, use Open full preview. Access is verified for every preview request.</p></section>;
}
