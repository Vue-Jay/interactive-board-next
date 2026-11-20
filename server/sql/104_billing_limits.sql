-- One-time launch reset; manual grants after this migration are authoritative.
UPDATE account_users SET subscription_plan='free', subscription_until=NULL,
 subscription_granted_by=NULL, subscription_updated_at=now()
 WHERE subscription_plan<>'free' OR subscription_until IS NOT NULL;
ALTER TABLE account_users ADD CONSTRAINT billing_plan_valid CHECK (subscription_plan IN ('free','pro'));
ALTER TABLE boards ADD COLUMN billing_preferred boolean NOT NULL DEFAULT false;
CREATE INDEX billing_active_boards ON boards(owner_id,billing_preferred DESC,created_at DESC,id) WHERE deleted_at IS NULL;

CREATE FUNCTION billing_unlimited(p_owner uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce((SELECT is_admin OR (subscription_plan='pro' AND subscription_until>now()) FROM account_users WHERE id=p_owner),false)
$$;
CREATE FUNCTION billing_lock(p_owner uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM account_users WHERE id=p_owner FOR NO KEY UPDATE;
END $$;
CREATE FUNCTION billing_fail(resource text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'LEKTRUS_PLAN:%',resource USING ERRCODE='PT409';
END $$;
CREATE FUNCTION billing_readonly(p_board uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce((SELECT NOT billing_unlimited(b.owner_id) AND NOT EXISTS(
   SELECT 1 FROM (SELECT id FROM boards WHERE owner_id=b.owner_id AND deleted_at IS NULL
     ORDER BY billing_preferred DESC,created_at DESC,id LIMIT 5) active WHERE active.id=b.id)
   FROM boards b WHERE b.id=p_board AND b.deleted_at IS NULL),false)
$$;
CREATE FUNCTION billing_groups(p_owner uuid) RETURNS TABLE(name text) LANGUAGE sql STABLE AS $$
 SELECT name FROM teacher_categories WHERE user_id=p_owner AND kind='group'
 UNION SELECT o.group_name FROM board_organization o JOIN boards b ON b.id=o.board_id
 WHERE b.owner_id=p_owner AND b.deleted_at IS NULL AND o.group_name<>''
$$;
CREATE FUNCTION billing_students(p_owner uuid) RETURNS TABLE(id uuid) LANGUAGE sql STABLE AS $$
 SELECT DISTINCT m.user_id FROM board_members m JOIN boards b ON b.id=m.board_id
 JOIN account_users u ON u.id=m.user_id WHERE b.owner_id=p_owner AND b.deleted_at IS NULL
 AND u.guest_board_id IS NULL AND m.user_id<>p_owner
 AND (m.participant_role='student' OR (m.participant_role IS NULL AND u.account_role='student'))
$$;
CREATE FUNCTION billing_template_bytes(manifest jsonb) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
 SELECT coalesce(sum((v->>'size')::bigint),0)::bigint FROM jsonb_array_elements(manifest) v
$$;
CREATE FUNCTION billing_storage(p_owner uuid) RETURNS bigint LANGUAGE sql STABLE AS $$
 SELECT (coalesce((SELECT sum(a.size_bytes) FROM board_assets a JOIN boards b ON b.id=a.board_id WHERE b.owner_id=p_owner),0)
 +coalesce((SELECT sum(size_bytes) FROM learning_materials WHERE owner_id=p_owner),0)
 +coalesce((SELECT sum(billing_template_bytes(assets)) FROM board_templates WHERE owner_id=p_owner),0))::bigint
$$;
CREATE FUNCTION billing_board_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL OR (TG_OP='UPDATE' AND OLD.deleted_at IS NULL) THEN RETURN NEW; END IF;
 PERFORM billing_lock(NEW.owner_id);
 IF NOT billing_unlimited(NEW.owner_id) AND (SELECT count(*) FROM boards WHERE owner_id=NEW.owner_id AND deleted_at IS NULL)>=5 THEN
  PERFORM billing_fail('boards');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_board_guard BEFORE INSERT OR UPDATE OF deleted_at ON boards FOR EACH ROW EXECUTE FUNCTION billing_board_guard();
CREATE FUNCTION billing_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF billing_readonly(NEW.board_id) AND NOT EXISTS(SELECT 1 FROM account_users WHERE id=NEW.updated_by AND is_admin) THEN
  PERFORM billing_fail('readonly');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_document_guard BEFORE INSERT OR UPDATE ON board_documents FOR EACH ROW EXECUTE FUNCTION billing_document_guard();
CREATE FUNCTION billing_storage_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner uuid; extra bigint; previous bigint:=0;
BEGIN
 IF TG_TABLE_NAME='board_assets' THEN
  SELECT owner_id INTO owner FROM boards WHERE id=NEW.board_id;
  IF TG_OP='UPDATE' THEN previous:=OLD.size_bytes; END IF;
  extra:=NEW.size_bytes;
  IF billing_readonly(NEW.board_id) THEN PERFORM billing_fail('readonly'); END IF;
 ELSIF TG_TABLE_NAME='learning_materials' THEN
  owner:=NEW.owner_id; extra:=NEW.size_bytes;
  IF TG_OP='UPDATE' THEN previous:=OLD.size_bytes; END IF;
 ELSE
  owner:=NEW.owner_id; extra:=billing_template_bytes(NEW.assets);
  IF TG_OP='UPDATE' THEN previous:=billing_template_bytes(OLD.assets); END IF;
 END IF;
 PERFORM billing_lock(owner);
 IF billing_unlimited(owner) THEN
  IF NOT EXISTS(SELECT 1 FROM account_users WHERE id=owner AND is_admin)
     AND extra>previous AND billing_storage(owner)+extra-previous>5368709120 THEN
   PERFORM billing_fail('storage_pro');
  END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='board_templates' THEN
  IF TG_OP='INSERT' AND (SELECT count(*) FROM board_templates WHERE owner_id=owner)>=3 THEN PERFORM billing_fail('templates'); END IF;
 ELSIF extra>26214400 THEN PERFORM billing_fail('file'); END IF;
 IF extra>previous AND billing_storage(owner)+extra-previous>262144000 THEN PERFORM billing_fail('storage'); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_asset_guard BEFORE INSERT OR UPDATE OF size_bytes ON board_assets FOR EACH ROW EXECUTE FUNCTION billing_storage_guard();
CREATE TRIGGER billing_material_guard BEFORE INSERT OR UPDATE OF size_bytes ON learning_materials FOR EACH ROW EXECUTE FUNCTION billing_storage_guard();
CREATE TRIGGER billing_template_guard BEFORE INSERT OR UPDATE OF assets ON board_templates FOR EACH ROW EXECUTE FUNCTION billing_storage_guard();
CREATE FUNCTION billing_group_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner uuid; group_label text;
BEGIN
 IF TG_TABLE_NAME='teacher_categories' THEN
  IF NEW.kind<>'group' THEN RETURN NEW; END IF;
  owner:=NEW.user_id; group_label:=NEW.name;
 ELSE
  SELECT owner_id INTO owner FROM boards WHERE id=NEW.board_id;
  group_label:=NEW.group_name;
 END IF;
 IF group_label='' THEN RETURN NEW; END IF;
 PERFORM billing_lock(owner);
 IF NOT billing_unlimited(owner) AND EXISTS(SELECT 1 FROM billing_groups(owner))
    AND NOT EXISTS(SELECT 1 FROM billing_groups(owner) g WHERE g.name=group_label) THEN
  PERFORM billing_fail('groups');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_category_guard BEFORE INSERT OR UPDATE ON teacher_categories FOR EACH ROW EXECUTE FUNCTION billing_group_guard();
CREATE TRIGGER billing_group_guard BEFORE INSERT OR UPDATE OF group_name ON board_organization FOR EACH ROW EXECUTE FUNCTION billing_group_guard();
CREATE FUNCTION billing_student_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner uuid;
BEGIN
 IF NOT coalesce(NEW.participant_role='student' OR (NEW.participant_role IS NULL AND EXISTS(
  SELECT 1 FROM account_users WHERE id=NEW.user_id AND account_role='student')),false) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM account_users WHERE id=NEW.user_id AND guest_board_id IS NOT NULL) THEN RETURN NEW; END IF;
 SELECT owner_id INTO owner FROM boards WHERE id=NEW.board_id;
 IF owner=NEW.user_id THEN RETURN NEW; END IF;
 PERFORM billing_lock(owner);
 IF NOT billing_unlimited(owner) AND (SELECT count(*) FROM billing_students(owner))>=5
    AND NOT EXISTS(SELECT 1 FROM billing_students(owner) s WHERE s.id=NEW.user_id) THEN
  PERFORM billing_fail('students');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_student_guard BEFORE INSERT OR UPDATE OF participant_role,role ON board_members FOR EACH ROW EXECUTE FUNCTION billing_student_guard();
