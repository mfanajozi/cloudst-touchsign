ALTER TABLE document_fields DROP CONSTRAINT document_fields_type_check;
-- statement-breakpoint
ALTER TABLE document_fields ADD CONSTRAINT document_fields_type_check CHECK (type IN ('SIGNATURE','INITIAL','DATE','DAY','MONTH','PLACE'));
-- statement-breakpoint
ALTER TABLE signature_records ADD COLUMN signing_details jsonb;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION touchsign_commit_signature(p_id uuid,p_auth text,p_revision integer,p_evidence jsonb,p_pdf_key text,p_pdf_hash text,p_original_hash text,p_final boolean) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a agreements%ROWTYPE; s signatories%ROWTYPE; actor users%ROWTYPE; all_signed boolean;
BEGIN
 SELECT * INTO a FROM agreements WHERE id=p_id FOR UPDATE;
 SELECT * INTO actor FROM users WHERE auth_user_id=p_auth AND is_active;
 SELECT * INTO s FROM signatories WHERE agreement_id=p_id AND auth_user_id=p_auth;
 IF a.id IS NULL OR actor.id IS NULL OR s.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0403',MESSAGE='Not assigned'; END IF;
 IF a.status<>'SIGNING' OR s.has_signed THEN RAISE EXCEPTION USING ERRCODE='P0403',MESSAGE='Not open for this signature'; END IF;
 IF a.revision<>p_revision THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Document changed'; END IF;
 IF a.original_sha256 IS NOT NULL AND a.original_sha256<>p_original_hash THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Original changed'; END IF;
 IF NOT starts_with(p_pdf_key,'agreements/'||p_id||'/versions/') OR NOT starts_with(p_evidence->>'signature_key','agreements/'||p_id||'/signatures/'||s.id||'/') THEN RAISE EXCEPTION 'Invalid evidence path'; END IF;
 IF NOT EXISTS(SELECT 1 FROM document_fields WHERE agreement_id=p_id AND signatory_id=s.id AND type='SIGNATURE') THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Signature field missing'; END IF;
 IF EXISTS(SELECT 1 FROM document_fields WHERE agreement_id=p_id AND signatory_id=s.id AND type='INITIAL') AND (p_evidence->>'initials_key') IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Initials missing'; END IF;
 INSERT INTO signature_records(signatory_id,agreement_id,signature_key,initials_key,signature_sha256,initials_sha256,location_text,location_consent,signed_at,ip_address,user_agent,signing_details)
 VALUES(s.id,p_id,p_evidence->>'signature_key',p_evidence->>'initials_key',p_evidence->>'signature_sha256',p_evidence->>'initials_sha256',p_evidence->>'location_text',(p_evidence->>'location_consent')::boolean,(p_evidence->>'signed_at')::timestamptz,(p_evidence->>'ip_address')::inet,p_evidence->>'user_agent',p_evidence->'signing_details');
 UPDATE signatories SET has_signed=true,signed_at=(p_evidence->>'signed_at')::timestamptz,location_text=p_evidence->>'location_text' WHERE id=s.id;
 SELECT NOT EXISTS(SELECT 1 FROM signatories WHERE agreement_id=p_id AND NOT has_signed) INTO all_signed;
 IF all_signed<>p_final THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Signing state changed'; END IF;
 INSERT INTO audit_logs(agreement_id,actor_email,action,ip_address,metadata,created_at) VALUES(p_id,actor.email,'SIGN',(p_evidence->>'ip_address')::inet,jsonb_build_object('location_consent',(p_evidence->>'location_consent')::boolean,'revision',a.revision+1),(p_evidence->>'signed_at')::timestamptz);
 UPDATE agreements SET signed_pdf_url=p_pdf_key,signed_sha256=p_pdf_hash,original_sha256=coalesce(original_sha256,p_original_hash),revision=revision+1,status=CASE WHEN all_signed THEN 'LOCKED' ELSE 'SIGNING' END,locked_at=CASE WHEN all_signed THEN (p_evidence->>'signed_at')::timestamptz ELSE NULL END WHERE id=p_id;
 IF all_signed THEN INSERT INTO audit_logs(agreement_id,actor_email,action,created_at) VALUES(p_id,actor.email,'LOCK',(p_evidence->>'signed_at')::timestamptz); END IF;
 INSERT INTO user_activities(user_id,agreement_id,action) VALUES(actor.id,p_id,'Signed document');
 RETURN jsonb_build_object('status',CASE WHEN all_signed THEN 'LOCKED' ELSE 'SIGNING' END,'revision',a.revision+1);
END $$;
