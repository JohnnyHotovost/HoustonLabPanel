-- One-time cleanup of the QA fixtures created on the initially empty workspace.
-- Refuses to run if the original test household or fixture-only preconditions differ.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM households WHERE id=1 AND name='QA Household 2026-10-07')
     OR EXISTS (SELECT 1 FROM users WHERE email != 'qa.owner.20261007@example.com' AND left(email,8) != 'test_qa_')
     OR EXISTS (SELECT 1 FROM entities WHERE left(name,8) != 'TEST_QA_')
     OR EXISTS (SELECT 1 FROM locations WHERE left(name,8) != 'TEST_QA_')
     OR EXISTS (SELECT 1 FROM tasks WHERE left(title,8) != 'TEST_QA_')
     OR EXISTS (SELECT 1 FROM documents WHERE left(title,8) != 'TEST_QA_')
     OR EXISTS (SELECT 1 FROM maintenance_definitions WHERE left(title,8) != 'TEST_QA_')
     OR EXISTS (SELECT 1 FROM service_events WHERE left(title,8) != 'TEST_QA_')
  THEN RAISE EXCEPTION 'Refusing cleanup: non-QA records or changed household detected';
  END IF;
END $$;
CREATE TEMP TABLE qa_users ON COMMIT DROP AS SELECT id FROM users WHERE email='qa.owner.20261007@example.com' OR left(email,8)='test_qa_';
CREATE TEMP TABLE qa_entities ON COMMIT DROP AS SELECT id FROM entities WHERE left(name,8)='TEST_QA_';
CREATE TEMP TABLE qa_locations ON COMMIT DROP AS SELECT id FROM locations WHERE left(name,8)='TEST_QA_';
CREATE TEMP TABLE qa_docs ON COMMIT DROP AS SELECT id,blob_id FROM documents WHERE left(title,8)='TEST_QA_';
CREATE TEMP TABLE qa_services ON COMMIT DROP AS SELECT id FROM service_events WHERE left(title,8)='TEST_QA_';
CREATE TEMP TABLE qa_maint ON COMMIT DROP AS SELECT id FROM maintenance_definitions WHERE left(title,8)='TEST_QA_';
CREATE TEMP TABLE qa_tasks ON COMMIT DROP AS SELECT id FROM tasks WHERE left(title,8)='TEST_QA_';
CREATE TEMP TABLE qa_expenses ON COMMIT DROP AS SELECT id FROM expenses WHERE left(category,8)='TEST_QA_' OR entity_id IN (SELECT id FROM qa_entities) OR service_event_id IN (SELECT id FROM qa_services);
DELETE FROM document_links WHERE document_id IN (SELECT id FROM qa_docs);
DELETE FROM maintenance_records WHERE definition_id IN (SELECT id FROM qa_maint);
DELETE FROM stock_movements WHERE entity_id IN (SELECT id FROM qa_entities);
DELETE FROM expenses WHERE id IN (SELECT id FROM qa_expenses);
DELETE FROM tasks WHERE id IN (SELECT id FROM qa_tasks);
DELETE FROM service_events WHERE id IN (SELECT id FROM qa_services);
DELETE FROM maintenance_definitions WHERE id IN (SELECT id FROM qa_maint);
DELETE FROM components WHERE entity_id IN (SELECT id FROM qa_entities);
DELETE FROM mileage_records WHERE entity_id IN (SELECT id FROM qa_entities);
DELETE FROM documents WHERE id IN (SELECT id FROM qa_docs);
DELETE FROM file_blobs WHERE id IN (SELECT blob_id FROM qa_docs) AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.blob_id=file_blobs.id);
DELETE FROM vehicle_profiles WHERE entity_id IN (SELECT id FROM qa_entities);
DELETE FROM asset_profiles WHERE entity_id IN (SELECT id FROM qa_entities);
DELETE FROM inventory_profiles WHERE entity_id IN (SELECT id FROM qa_entities);
DELETE FROM entity_relationships WHERE source_id IN (SELECT id FROM qa_entities) OR target_id IN (SELECT id FROM qa_entities);
DELETE FROM entities WHERE id IN (SELECT id FROM qa_entities);
-- Delete recursive locations leaf-first, respecting the RESTRICT foreign key.
DO $$
BEGIN
  WHILE EXISTS (SELECT 1 FROM locations WHERE id IN (SELECT id FROM qa_locations)) LOOP
    DELETE FROM locations l WHERE l.id IN (SELECT id FROM qa_locations) AND NOT EXISTS (SELECT 1 FROM locations child WHERE child.parent_id=l.id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Location cleanup blocked by a non-QA child'; END IF;
  END LOOP;
END $$;
DELETE FROM sessions WHERE user_id IN (SELECT id FROM qa_users);
DELETE FROM activity WHERE actor_id IN (SELECT id FROM qa_users);
DELETE FROM users WHERE id IN (SELECT id FROM qa_users);
DELETE FROM auth_attempts;
DELETE FROM households WHERE id=1 AND name='QA Household 2026-10-07' AND NOT EXISTS (SELECT 1 FROM users);
COMMIT;