import test from 'node:test';
import assert from 'node:assert/strict';

import { StatePersistenceError } from './experimentalDeviceStateWrites.js';
import { createSupabaseDeviceStateRepository } from './supabaseDeviceStateRepository.js';

function createQueryClient({ data, error } = {}) {
  const calls = [];
  const query = {
    select(columns) {
      calls.push(['select', columns]);
      return this;
    },
    eq(column, value) {
      calls.push(['eq', column, value]);
      return this;
    },
    async maybeSingle() {
      calls.push(['maybeSingle']);
      return { data, error };
    },
    async single() {
      calls.push(['single']);
      return { data, error };
    },
    insert(payload) {
      calls.push(['insert', payload]);
      return this;
    }
  };
  const client = {
    calls,
    from(table) {
      calls.push(['from', table]);
      return query;
    },
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      return this.rpcResponse;
    },
    rpcResponse: null
  };
  return client;
}

test('reads a versioned row using only the injected Supabase client', async () => {
  const state = { riego: false, horaVirtual: '18:45' };
  const client = createQueryClient({
    data: {
      chat_id: 123456789,
      state,
      last_action: 'init',
      updated_at: '2026-10-12T00:00:00.000Z',
      revision: 4
    }
  });
  const repository = createSupabaseDeviceStateRepository(client);

  const snapshot = await repository.read(123456789);

  assert.deepEqual(snapshot, {
    chatId: '123456789',
    state,
    lastAction: 'init',
    updatedAt: '2026-10-12T00:00:00.000Z',
    revision: 4
  });
  assert.deepEqual(client.calls, [
    ['from', 'device_states'],
    ['select', 'chat_id, state, last_action, updated_at, revision'],
    ['eq', 'chat_id', '123456789'],
    ['maybeSingle']
  ]);
});

test('creates a missing row with insert-only semantics and revision zero', async () => {
  const createdRow = {
    chat_id: '7',
    state: { luz: false },
    last_action: 'init',
    updated_at: '2026-10-12T00:00:00.000Z',
    revision: 0
  };
  const client = createQueryClient({ data: createdRow });
  const repository = createSupabaseDeviceStateRepository(client);

  const result = await repository.createIfAbsent('7', createdRow.state);

  assert.equal(result.status, 'created');
  assert.deepEqual(result.snapshot, {
    chatId: '7',
    state: { luz: false },
    lastAction: 'init',
    updatedAt: '2026-10-12T00:00:00.000Z',
    revision: 0
  });
  assert.deepEqual(client.calls, [
    ['from', 'device_states'],
    ['insert', {
      chat_id: '7',
      state: { luz: false },
      last_action: 'init',
      revision: 0
    }],
    ['select', 'chat_id, state, last_action, updated_at, revision'],
    ['single']
  ]);
});

test('treats only a duplicate-key insert as a creation race', async () => {
  const duplicateClient = createQueryClient({
    data: null,
    error: { code: '23505', message: 'duplicate key' }
  });
  const repository = createSupabaseDeviceStateRepository(duplicateClient);
  assert.deepEqual(await repository.createIfAbsent(7, {}), { status: 'conflict' });

  const failureClient = createQueryClient({
    data: null,
    error: { code: '42501', message: 'permission denied' }
  });
  await assert.rejects(
    createSupabaseDeviceStateRepository(failureClient).createIfAbsent(7, {}),
    (error) => error instanceof StatePersistenceError && error.cause?.code === '42501'
  );
});

test('fails explicitly when a row is missing, incompatible, or Supabase reports an error', async () => {
  const missingClient = createQueryClient({ data: null });
  const missingRepository = createSupabaseDeviceStateRepository(missingClient);
  await assert.rejects(missingRepository.read(5), StatePersistenceError);

  const oldSchemaClient = createQueryClient({
    data: {
      chat_id: 5,
      state: { riego: false },
      last_action: 'init'
    }
  });
  await assert.rejects(
    createSupabaseDeviceStateRepository(oldSchemaClient).read(5),
    StatePersistenceError
  );

  const errorClient = createQueryClient({
    error: { code: 'XX000', message: 'simulated database error' }
  });
  await assert.rejects(
    createSupabaseDeviceStateRepository(errorClient).read(5),
    (error) => error instanceof StatePersistenceError
      && error.cause?.code === 'XX000'
  );
});

test('maps a successful RPC update to the experimental repository contract', async () => {
  const client = createQueryClient();
  client.rpcResponse = {
    data: [{
      result: 'updated',
      revision: 8,
      state: { riego: true, virtualInstantMs: 1_767_225_600_123.625 },
      last_action: 'irrigation_on'
    }],
    error: null
  };
  const repository = createSupabaseDeviceStateRepository(client);
  const nextState = { riego: true, virtualInstantMs: 1_767_225_600_123.625 };

  const result = await repository.compareAndSwap({
    chatId: '123456789',
    expectedRevision: 7,
    nextState,
    lastAction: 'irrigation_on'
  });

  assert.deepEqual(result, {
    status: 'updated',
    snapshot: {
      chatId: '123456789',
      revision: 8,
      state: nextState,
      lastAction: 'irrigation_on',
      updatedAt: null
    }
  });
  assert.deepEqual(client.calls, [[
    'rpc',
    'update_device_state_if_revision',
    {
      p_chat_id: '123456789',
      p_expected_revision: 7,
      p_next_state: nextState,
      p_last_action: 'irrigation_on'
    }
  ]]);
});

test('maps conflicts and missing rows without treating either as success', async () => {
  const client = createQueryClient();
  const repository = createSupabaseDeviceStateRepository(client);

  client.rpcResponse = { data: [{ result: 'conflict' }], error: null };
  assert.deepEqual(await repository.compareAndSwap({
    chatId: 7,
    expectedRevision: 0,
    nextState: { luz: true }
  }), { status: 'conflict' });

  client.rpcResponse = { data: [{ result: 'not_found' }], error: null };
  assert.deepEqual(await repository.compareAndSwap({
    chatId: 7,
    expectedRevision: 0,
    nextState: { luz: true }
  }), { status: 'not_found' });
});

test('preserves PostgreSQL BIGINT chatId precision by accepting exact decimal strings', async () => {
  const exactChatId = '9223372036854775807';
  const client = createQueryClient({
    data: {
      chat_id: Number(exactChatId),
      state: { riego: false },
      last_action: 'init',
      revision: 2
    }
  });
  client.rpcResponse = {
    data: [{
      result: 'updated',
      revision: 3,
      state: { riego: true },
      last_action: 'irrigation_on'
    }],
    error: null
  };
  const repository = createSupabaseDeviceStateRepository(client);

  const read = await repository.read(exactChatId);
  assert.equal(read.chatId, exactChatId);
  assert.equal(client.calls[2][2], exactChatId);

  const write = await repository.compareAndSwap({
    chatId: exactChatId,
    expectedRevision: 2,
    nextState: { riego: true },
    lastAction: 'irrigation_on'
  });
  assert.equal(write.snapshot.chatId, exactChatId);
  assert.equal(client.calls.at(-1)[2].p_chat_id, exactChatId);
});

test('rejects unsafe numeric BIGINT IDs before making Supabase calls', async () => {
  const client = createQueryClient();
  const repository = createSupabaseDeviceStateRepository(client);

  await assert.rejects(repository.read(Number.MAX_SAFE_INTEGER + 1), TypeError);
  await assert.rejects(repository.compareAndSwap({
    chatId: Number.MAX_SAFE_INTEGER + 1,
    expectedRevision: 0,
    nextState: { luz: true }
  }), TypeError);
  await assert.rejects(repository.read('9223372036854775808'), RangeError);
  assert.equal(client.calls.length, 0);
});

test('propagates RPC failures and rejects malformed success responses', async () => {
  const client = createQueryClient();
  const repository = createSupabaseDeviceStateRepository(client);

  client.rpcResponse = {
    data: null,
    error: { code: '42501', message: 'permission denied' }
  };
  await assert.rejects(
    repository.compareAndSwap({
      chatId: 7,
      expectedRevision: 0,
      nextState: { luz: true }
    }),
    (error) => error instanceof StatePersistenceError
      && error.cause?.code === '42501'
  );

  client.rpcResponse = { data: [{ result: 'unexpected' }], error: null };
  await assert.rejects(
    repository.compareAndSwap({
      chatId: 7,
      expectedRevision: 0,
      nextState: { luz: true }
    }),
    StatePersistenceError
  );
});

test('validates CAS inputs before calling Supabase', async () => {
  const client = createQueryClient();
  const repository = createSupabaseDeviceStateRepository(client);

  await assert.rejects(repository.compareAndSwap({
    chatId: 7,
    expectedRevision: -1,
    nextState: { luz: true }
  }), TypeError);
  await assert.rejects(repository.compareAndSwap({
    chatId: 7,
    expectedRevision: 0,
    nextState: []
  }), TypeError);
  assert.equal(client.calls.length, 0);
});
