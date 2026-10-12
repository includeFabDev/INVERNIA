-- NO EJECUTADO — REQUIERE VERIFICACIÓN DEL ESQUEMA Y AUTORIZACIÓN.
--
-- Conditional migration draft for the experimental
-- supabaseDeviceStateRepository.js adapter.
--
-- Confirmed schema reported by the project owner:
--   chat_id BIGINT NOT NULL PRIMARY KEY
--   state JSONB NOT NULL DEFAULT '{}'::jsonb
--   last_action TEXT NOT NULL DEFAULT 'init'::text
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
--   revision does not yet exist.
--
-- The preflight confirms the named trigger is enabled for UPDATE. The RPC
-- also writes updated_at = now(), so timestamp maintenance does not depend on
-- that trigger's body. The trigger function's definition must still be
-- inspected in development to ensure it does not overwrite the assigned time.
--
-- Before applying, still verify in the target Supabase project:
--   1. The reported schema still matches the target environment.
--   2. There are no existing policies/triggers/grants that conflict with this
--      SECURITY INVOKER function or the explicit service_role grant below.
--   3. All existing writers are coordinated before requiring revision CAS.
--
-- SECURITY INVOKER is intentional: the calling backend role must have the
-- required table privileges and satisfy RLS. Do not change to SECURITY
-- DEFINER to bypass policies without an explicit security review.

DO $preflight$
DECLARE
  chat_id_type text;
  chat_id_nullable text;
  state_type text;
  state_nullable text;
  last_action_type text;
  last_action_nullable text;
  updated_at_type text;
  updated_at_nullable text;
  existing_revision_type text;
  chat_id_attnum smallint;
  has_single_column_unique_key boolean;
  has_enabled_update_trigger boolean;
BEGIN
  IF to_regclass('public.device_states') IS NULL THEN
    RAISE EXCEPTION 'Required table public.device_states does not exist';
  END IF;

  SELECT column_info.udt_name, column_info.is_nullable
    INTO chat_id_type, chat_id_nullable
    FROM information_schema.columns AS column_info
   WHERE column_info.table_schema = 'public'
     AND column_info.table_name = 'device_states'
     AND column_info.column_name = 'chat_id';
  IF chat_id_type IS DISTINCT FROM 'int8' OR chat_id_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Expected device_states.chat_id BIGINT NOT NULL, found type % nullable %',
      chat_id_type, chat_id_nullable;
  END IF;

  SELECT column_info.udt_name, column_info.is_nullable
    INTO state_type, state_nullable
    FROM information_schema.columns AS column_info
   WHERE column_info.table_schema = 'public'
     AND column_info.table_name = 'device_states'
     AND column_info.column_name = 'state';
  IF state_type IS DISTINCT FROM 'jsonb' OR state_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Expected device_states.state JSONB NOT NULL, found type % nullable %',
      state_type, state_nullable;
  END IF;

  SELECT column_info.udt_name, column_info.is_nullable
    INTO last_action_type, last_action_nullable
    FROM information_schema.columns AS column_info
   WHERE column_info.table_schema = 'public'
     AND column_info.table_name = 'device_states'
     AND column_info.column_name = 'last_action';
  IF last_action_type IS DISTINCT FROM 'text' OR last_action_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Expected device_states.last_action TEXT NOT NULL, found type % nullable %',
      last_action_type, last_action_nullable;
  END IF;

  SELECT column_info.udt_name, column_info.is_nullable
    INTO updated_at_type, updated_at_nullable
    FROM information_schema.columns AS column_info
   WHERE column_info.table_schema = 'public'
     AND column_info.table_name = 'device_states'
     AND column_info.column_name = 'updated_at';
  IF updated_at_type IS DISTINCT FROM 'timestamptz' OR updated_at_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Expected device_states.updated_at TIMESTAMPTZ NOT NULL, found type % nullable %',
      updated_at_type, updated_at_nullable;
  END IF;

  SELECT attribute.attnum
    INTO chat_id_attnum
    FROM pg_attribute AS attribute
   WHERE attribute.attrelid = 'public.device_states'::regclass
     AND attribute.attname = 'chat_id'
     AND NOT attribute.attisdropped;

  SELECT EXISTS (
    SELECT 1
      FROM pg_constraint AS constraint_info
     WHERE constraint_info.conrelid = 'public.device_states'::regclass
       AND constraint_info.contype = 'p'
       AND constraint_info.conkey = ARRAY[chat_id_attnum]::smallint[]
  )
    INTO has_single_column_unique_key;
  IF NOT has_single_column_unique_key THEN
    RAISE EXCEPTION 'device_states.chat_id must have the confirmed single-column PRIMARY KEY';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM pg_trigger AS trigger_info
     WHERE trigger_info.tgrelid = 'public.device_states'::regclass
       AND trigger_info.tgname = 'device_states_set_updated_at'
       AND NOT trigger_info.tgisinternal
       AND trigger_info.tgenabled IN ('O', 'A')
       AND (trigger_info.tgtype & 16::smallint) = 16::smallint
  )
    INTO has_enabled_update_trigger;
  IF NOT has_enabled_update_trigger THEN
    RAISE EXCEPTION 'Expected enabled UPDATE trigger device_states_set_updated_at';
  END IF;

  IF to_regrole('service_role') IS NULL
      OR to_regrole('anon') IS NULL
      OR to_regrole('authenticated') IS NULL THEN
    RAISE EXCEPTION 'Expected Supabase roles service_role, anon, and authenticated';
  END IF;

  SELECT column_info.udt_name
    INTO existing_revision_type
    FROM information_schema.columns AS column_info
   WHERE column_info.table_schema = 'public'
     AND column_info.table_name = 'device_states'
     AND column_info.column_name = 'revision';
  IF existing_revision_type IS NOT NULL AND existing_revision_type <> 'int8' THEN
    RAISE EXCEPTION 'Existing device_states.revision must be bigint, found %', existing_revision_type;
  END IF;
END;
$preflight$;

ALTER TABLE public.device_states
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;

UPDATE public.device_states
   SET revision = 0
 WHERE revision IS NULL;

ALTER TABLE public.device_states
  ALTER COLUMN revision SET DEFAULT 0,
  ALTER COLUMN revision SET NOT NULL;

DO $revision_check$
DECLARE
  revision_type text;
  revision_nullable text;
BEGIN
  SELECT column_info.udt_name, column_info.is_nullable
    INTO revision_type, revision_nullable
    FROM information_schema.columns AS column_info
   WHERE column_info.table_schema = 'public'
     AND column_info.table_name = 'device_states'
     AND column_info.column_name = 'revision';
  IF revision_type IS DISTINCT FROM 'int8' THEN
    RAISE EXCEPTION 'device_states.revision must be bigint, found %', revision_type;
  END IF;
  IF revision_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'device_states.revision must be NOT NULL';
  END IF;
END;
$revision_check$;

CREATE OR REPLACE FUNCTION public.update_device_state_if_revision(
  p_chat_id bigint,
  p_expected_revision bigint,
  p_next_state jsonb,
  p_last_action text DEFAULT NULL
)
RETURNS TABLE (
  result text,
  revision bigint,
  state jsonb,
  last_action text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_revision bigint;
  v_state jsonb;
  v_last_action text;
BEGIN
  IF p_chat_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'chat_id and a non-negative expected revision are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_next_state IS NULL OR jsonb_typeof(p_next_state) <> 'object' THEN
    RAISE EXCEPTION 'next state must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.device_states AS device_state
     SET state = p_next_state,
         last_action = COALESCE(p_last_action, device_state.last_action),
         updated_at = now(),
         revision = device_state.revision + 1
   WHERE device_state.chat_id = p_chat_id
     AND device_state.revision = p_expected_revision
  RETURNING device_state.revision,
            device_state.state,
            device_state.last_action
       INTO v_revision, v_state, v_last_action;

  IF FOUND THEN
    RETURN QUERY SELECT
      'updated'::text, v_revision, v_state, v_last_action;
    RETURN;
  END IF;

  SELECT device_state.revision,
         device_state.state,
         device_state.last_action
    INTO v_revision, v_state, v_last_action
    FROM public.device_states AS device_state
   WHERE device_state.chat_id = p_chat_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'not_found'::text, NULL::bigint, NULL::jsonb, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    'conflict'::text, v_revision, v_state, v_last_action;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_device_state_if_revision(bigint, bigint, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_device_state_if_revision(bigint, bigint, jsonb, text)
  TO service_role;

-- Review effective function/table privileges before deployment. SECURITY
-- INVOKER requires the active backend role to be authorized by both GRANTs and
-- RLS. Confirm that the backend service key maps to service_role and that this
-- role exists in the target project before applying the grant above.
--
-- This function does not create absent rows or initialize virtualInstantMs.
-- It explicitly assigns updated_at = now() and the preflight checks that the
-- confirmed named trigger is enabled for UPDATE. Inspect the trigger function
-- definition in development to ensure it does not overwrite updated_at with a
-- stale or non-current value.
--
-- Adding revision with DEFAULT 0 and NOT NULL preserves existing state rows;
-- existing state, chat_id, last_action, and updated_at values are not rewritten.
-- The null cleanup is defensive for an unexpectedly pre-existing nullable
-- revision column and sets only NULL revision values to 0.
--
-- PostgreSQL's UPDATE row lock plus the revision predicate makes comparison
-- and increment atomic. A conflict must cause a fresh read and intent replay.
