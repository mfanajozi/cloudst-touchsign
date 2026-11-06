import {neon} from '@neondatabase/serverless';
const supplied=process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL;
if(!supplied)throw new Error('DATABASE_URL is required for the database integration check.');
const sql=neon(supplied);
try{
 await sql.query(`DO $$
 DECLARE actor uuid; signer uuid; agreement uuid; revision integer; auth text; details jsonb; result jsonb;
 BEGIN
  BEGIN
   auth:='signing-details-qa-'||gen_random_uuid();
   INSERT INTO users(auth_user_id,email,role) VALUES(auth,auth||'@example.test','ADMIN') RETURNING id INTO actor;
   INSERT INTO agreements(uploader_id,title,original_pdf_url) VALUES(actor,'Disposable mapped details check','private/test.pdf') RETURNING id INTO agreement;
   INSERT INTO signatories(agreement_id,auth_user_id,email,full_name,phone_number,id_number)
   VALUES(agreement,auth,auth||'@example.test','Disposable QA','+27821234567','QA-ONLY') RETURNING id INTO signer;
   SELECT a.revision INTO revision FROM agreements a WHERE a.id=agreement;
   SELECT touchsign_save_fields(agreement,actor,revision,jsonb_build_array(
    jsonb_build_object('signatory_id',signer,'page_number',1,'type','SIGNATURE','x_coord',0.1,'y_coord',0.2,'width',0.3,'height',0.06),
    jsonb_build_object('signatory_id',signer,'page_number',1,'type','DAY','x_coord',0.1,'y_coord',0.6,'width',0.07,'height',0.03),
    jsonb_build_object('signatory_id',signer,'page_number',1,'type','MONTH','x_coord',0.3,'y_coord',0.6,'width',0.18,'height',0.03),
    jsonb_build_object('signatory_id',signer,'page_number',1,'type','PLACE','x_coord',0.6,'y_coord',0.6,'width',0.3,'height',0.03)
   )) INTO revision;
   SELECT touchsign_publish(agreement,actor,revision) INTO revision;
   details:=jsonb_build_object('day',7,'month',11,'year',2026,'place','Pretoria');
   SELECT touchsign_commit_signature(agreement,auth,revision,jsonb_build_object(
    'signature_key','agreements/'||agreement||'/signatures/'||signer||'/qa.png',
    'signature_sha256',repeat('a',64),'location_text','Pretoria','location_consent',false,
    'signed_at',now(),'ip_address','192.0.2.1','user_agent','Disposable QA','signing_details',details
   ),'agreements/'||agreement||'/versions/qa.pdf',repeat('b',64),repeat('c',64),true) INTO result;
   IF result->>'status'<>'LOCKED' OR NOT EXISTS(SELECT 1 FROM signature_records WHERE signatory_id=signer AND signing_details=details) THEN
    RAISE EXCEPTION 'FAIL: declared signing details were not persisted';
   END IF;
   RAISE SQLSTATE 'ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
 END $$;`);
 console.log('PASS: new mapped fields publish, sign, persist declared details, and lock. All fixtures rolled back.');
}catch(error){
 console.error('Database signing check failed:',error.code||error.name,error.code==='P0409'?error.message:'');
 process.exitCode=1;
}
