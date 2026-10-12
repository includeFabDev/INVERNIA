import test from 'node:test';
import assert from 'node:assert/strict';

import { saveDeviceState } from './deviceStates.js';
import { StatePersistenceError } from './experimentalDeviceStateWrites.js';
import { executeAction, toggleDevice } from './executeAction.js';

function createSupabase(initialState, { conflictOnce = false, failRpc = false } = {}) {
  const row = {
    chat_id: '123456789',
    state: structuredClone(initialState),
    last_action: 'init',
    updated_at: '2026-10-12T00:00:00.000Z',
    revision: 0
  };
  let forceConflict = conflictOnce;
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return { data: structuredClone(row), error: null };
    }
  };
  return {
    row,
    from() {
      return query;
    },
    async rpc(_name, args) {
      if (failRpc) return { data: null, error: { code: 'XX000' } };
      if (forceConflict) {
        forceConflict = false;
        row.state = { ...row.state, aire: true };
        row.revision += 1;
        return { data: [{ result: 'conflict' }], error: null };
      }
      if (args.p_expected_revision !== row.revision) {
        return { data: [{ result: 'conflict' }], error: null };
      }
      row.state = structuredClone(args.p_next_state);
      row.last_action = args.p_last_action;
      row.revision += 1;
      return {
        data: [{
          result: 'updated',
          revision: row.revision,
          state: structuredClone(row.state),
          last_action: row.last_action
        }],
        error: null
      };
    }
  };
}

test('CAS service reapplies an intent after conflict and preserves unrelated state', async () => {
  const previousMode = process.env.DEVICE_STATE_WRITE_MODE;
  process.env.DEVICE_STATE_WRITE_MODE = 'cas';
  const supabase = createSupabase(
    { luz: false, aire: false, virtualInstantMs: 1_767_225_600_123.625 },
    { conflictOnce: true }
  );

  try {
    const saved = await saveDeviceState(
      supabase,
      '123456789',
      (state) => ({ state: { ...state, luz: true } }),
      'light_on'
    );

    assert.equal(saved.revision, 2);
    assert.equal(saved.state.luz, true);
    assert.equal(saved.state.aire, true);
    assert.equal(saved.state.virtualInstantMs, 1_767_225_600_123.625);
    assert.equal(saved.last_action, 'light_on');
  } finally {
    if (previousMode === undefined) delete process.env.DEVICE_STATE_WRITE_MODE;
    else process.env.DEVICE_STATE_WRITE_MODE = previousMode;
  }
});

test('CAS service reports Supabase failures and remains disabled unless explicitly enabled', async () => {
  const previousMode = process.env.DEVICE_STATE_WRITE_MODE;
  delete process.env.DEVICE_STATE_WRITE_MODE;
  const supabase = createSupabase({ luz: false });

  try {
    await assert.rejects(
      saveDeviceState(supabase, '123456789', (state) => ({ state: { ...state, luz: true } })),
      StatePersistenceError
    );

    process.env.DEVICE_STATE_WRITE_MODE = 'cas';
    await assert.rejects(
      saveDeviceState(
        createSupabase({ luz: false }, { failRpc: true }),
        '123456789',
        (state) => ({ state: { ...state, luz: true } })
      ),
      StatePersistenceError
    );
  } finally {
    if (previousMode === undefined) delete process.env.DEVICE_STATE_WRITE_MODE;
    else process.env.DEVICE_STATE_WRITE_MODE = previousMode;
  }
});

test('device actions preserve a concurrent update and retain shared irrigation behavior', async () => {
  const previousMode = process.env.DEVICE_STATE_WRITE_MODE;
  process.env.DEVICE_STATE_WRITE_MODE = 'cas';
  const supabase = createSupabase(
    { luz: false, aire: false, riego: false, humedad_pct: 60 },
    { conflictOnce: true }
  );

  try {
    const saved = await executeAction(
      supabase,
      { action: 'turn_on', device: 'riego' },
      '123456789'
    );
    assert.equal(saved.applied, true);
    assert.equal(saved.state.luz, false);
    assert.equal(saved.state.aire, true);
    assert.equal(saved.state.riego, true);
    assert.equal(saved.state.humedad_pct, 66);
  } finally {
    if (previousMode === undefined) delete process.env.DEVICE_STATE_WRITE_MODE;
    else process.env.DEVICE_STATE_WRITE_MODE = previousMode;
  }
});

test('toggle actions derive their value from the state read for the successful CAS', async () => {
  const previousMode = process.env.DEVICE_STATE_WRITE_MODE;
  process.env.DEVICE_STATE_WRITE_MODE = 'cas';
  const supabase = createSupabase({ luz: false });

  try {
    const first = await toggleDevice(supabase, 'luz', '123456789');
    const second = await toggleDevice(supabase, 'luz', '123456789');
    assert.equal(first.state.luz, true);
    assert.equal(second.state.luz, false);
    assert.equal(supabase.row.revision, 2);
  } finally {
    if (previousMode === undefined) delete process.env.DEVICE_STATE_WRITE_MODE;
    else process.env.DEVICE_STATE_WRITE_MODE = previousMode;
  }
});
