import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDeviceStateIntent,
  StatePersistenceError,
  StateWriteConflictError
} from './experimentalDeviceStateWrites.js';

class FakeVersionedStateRepository {
  constructor(chatId, state, revision = 0, lastAction = 'init') {
    this.snapshot = { chatId, state: structuredClone(state), revision, lastAction };
    this.readCount = 0;
    this.compareAndSwapCount = 0;
    this.failReads = 0;
    this.failWrites = 0;
    this.forceConflicts = 0;
  }

  async read(chatId) {
    this.readCount += 1;
    if (this.failReads > 0) {
      this.failReads -= 1;
      throw new Error('simulated read failure');
    }
    assert.equal(String(chatId), String(this.snapshot.chatId));
    return structuredClone(this.snapshot);
  }

  async compareAndSwap({ chatId, expectedRevision, nextState, lastAction }) {
    this.compareAndSwapCount += 1;
    if (this.failWrites > 0) {
      this.failWrites -= 1;
      throw new Error('simulated write failure');
    }
    if (this.forceConflicts > 0) {
      this.forceConflicts -= 1;
      return { status: 'conflict' };
    }
    if (String(chatId) !== String(this.snapshot.chatId)
        || expectedRevision !== this.snapshot.revision) {
      return { status: 'conflict' };
    }

    this.snapshot = {
      ...this.snapshot,
      state: structuredClone(nextState),
      lastAction,
      revision: this.snapshot.revision + 1
    };
    return { status: 'updated', snapshot: structuredClone(this.snapshot) };
  }
}

const updateState = (changes, lastAction) => (state) => ({
  state: { ...state, ...changes },
  lastAction
});

test('two readers of the same revision permit only the first CAS writer', async () => {
  const repository = new FakeVersionedStateRepository(7, { luz: false });
  const [firstRead, secondRead] = await Promise.all([
    repository.read(7),
    repository.read(7)
  ]);

  assert.equal(firstRead.revision, 0);
  assert.equal(secondRead.revision, 0);

  const first = await repository.compareAndSwap({
    chatId: 7,
    expectedRevision: firstRead.revision,
    nextState: { ...firstRead.state, luz: true },
    lastAction: 'light_on'
  });
  const second = await repository.compareAndSwap({
    chatId: 7,
    expectedRevision: secondRead.revision,
    nextState: { ...secondRead.state, riego: true },
    lastAction: 'irrigation_on'
  });

  assert.equal(first.status, 'updated');
  assert.equal(first.snapshot.revision, 1);
  assert.equal(second.status, 'conflict');
  assert.deepEqual(repository.snapshot.state, { luz: true });
});

test('a conflicted writer rereads and reapplies its intent without losing either change', async () => {
  const repository = new FakeVersionedStateRepository(7, { luz: false, riego: false });
  let raced = false;
  const originalCas = repository.compareAndSwap.bind(repository);
  repository.compareAndSwap = async (args) => {
    if (!raced) {
      raced = true;
      const concurrent = await originalCas({
        chatId: args.chatId,
        expectedRevision: args.expectedRevision,
        nextState: { ...repository.snapshot.state, riego: true },
        lastAction: 'irrigation_on'
      });
      assert.equal(concurrent.status, 'updated');
    }
    return originalCas(args);
  };

  const result = await applyDeviceStateIntent(
    repository,
    7,
    updateState({ luz: true }, 'light_on')
  );

  assert.equal(result.revision, 2);
  assert.deepEqual(result.state, { luz: true, riego: true });
  assert.equal(result.lastAction, 'light_on');
  assert.equal(repository.readCount, 2);
});

test('independent concurrent updates are serialized without overwriting either property', async () => {
  const repository = new FakeVersionedStateRepository(7, {
    luz: false,
    riego: false
  });
  let bothReadResolve;
  const bothRead = new Promise((resolve) => {
    bothReadResolve = resolve;
  });
  let initialReaders = 0;
  const originalRead = repository.read.bind(repository);
  repository.read = async (chatId) => {
    const snapshot = await originalRead(chatId);
    if (initialReaders < 2) {
      initialReaders += 1;
      if (initialReaders === 2) bothReadResolve();
      await bothRead;
    }
    return snapshot;
  };

  const [lightResult, irrigationResult] = await Promise.all([
    applyDeviceStateIntent(repository, 7, updateState({ luz: true }, 'light_on')),
    applyDeviceStateIntent(repository, 7, updateState({ riego: true }, 'irrigation_on'))
  ]);

  assert.equal(repository.snapshot.revision, 2);
  assert.deepEqual(repository.snapshot.state, { luz: true, riego: true });
  assert.ok([lightResult.revision, irrigationResult.revision].includes(2));
});

test('same-property actions follow successful CAS commit order', async () => {
  const repository = new FakeVersionedStateRepository(7, { luz: false });
  let bothReadResolve;
  const bothRead = new Promise((resolve) => {
    bothReadResolve = resolve;
  });
  let initialReaders = 0;
  const originalRead = repository.read.bind(repository);
  repository.read = async (chatId) => {
    const snapshot = await originalRead(chatId);
    if (initialReaders < 2) {
      initialReaders += 1;
      if (initialReaders === 2) bothReadResolve();
      await bothRead;
    }
    return snapshot;
  };

  const [turnOn, turnOff] = await Promise.all([
    applyDeviceStateIntent(repository, 7, updateState({ luz: true }, 'light_on')),
    applyDeviceStateIntent(repository, 7, updateState({ luz: false }, 'light_off'))
  ]);

  assert.equal(repository.snapshot.revision, 2);
  assert.equal(repository.snapshot.state.luz, false);
  assert.equal(repository.snapshot.lastAction, 'light_off');
  assert.ok(turnOn.revision < turnOff.revision);
});

test('persistence errors never return a success-shaped result', async () => {
  const repository = new FakeVersionedStateRepository(7, { luz: false });
  repository.failWrites = 1;

  await assert.rejects(
    applyDeviceStateIntent(repository, 7, updateState({ luz: true }, 'light_on')),
    (error) => error instanceof StatePersistenceError
      && error.cause?.message === 'simulated write failure'
  );
  assert.deepEqual(repository.snapshot.state, { luz: false });
  assert.equal(repository.snapshot.revision, 0);
});

test('an exhausted conflict retry budget fails explicitly', async () => {
  const repository = new FakeVersionedStateRepository(7, { luz: false });
  repository.forceConflicts = 2;

  await assert.rejects(
    applyDeviceStateIntent(repository, 7, updateState({ luz: true }, 'light_on'), {
      maxAttempts: 2
    }),
    (error) => error instanceof StateWriteConflictError
      && error.attempts === 2
      && error.chatId === 7
  );
  assert.deepEqual(repository.snapshot.state, { luz: false });
});

test('legacy state preserves all unrelated properties when intent is reapplied', async () => {
  const legacyState = {
    riego: false,
    horaVirtual: '18:45',
    usarHoraReal: false,
    timeScale: 2,
    __lastCronMs: 1_760_000_000_000,
    unrelated: { keep: true }
  };
  const repository = new FakeVersionedStateRepository(7, legacyState, 4);

  const result = await applyDeviceStateIntent(
    repository,
    7,
    updateState({ riego: true }, 'irrigation_on')
  );

  assert.deepEqual(result.state, { ...legacyState, riego: true });
});

test('virtualInstantMs retains its numeric precision through a retry', async () => {
  const instantMs = 1_767_225_600_123.625;
  const repository = new FakeVersionedStateRepository(7, {
    virtualInstantMs: instantMs,
    horaVirtual: '12:00'
  });
  repository.forceConflicts = 1;

  const result = await applyDeviceStateIntent(repository, 7, (state) => ({
    state: { ...state, riego: true },
    lastAction: 'irrigation_on'
  }));

  assert.equal(result.state.virtualInstantMs, instantMs);
  assert.equal(result.revision, 1);
});

test('retry intent preserves changes made by another writer on different properties', async () => {
  const repository = new FakeVersionedStateRepository(7, {
    luz: false,
    riego: false,
    timeScale: 1
  });
  let raced = false;
  const originalCas = repository.compareAndSwap.bind(repository);
  repository.compareAndSwap = async (args) => {
    if (!raced) {
      raced = true;
      const concurrent = await originalCas({
        chatId: args.chatId,
        expectedRevision: args.expectedRevision,
        nextState: { ...repository.snapshot.state, timeScale: 5 },
        lastAction: 'set_timeScale'
      });
      assert.equal(concurrent.status, 'updated');
    }
    return originalCas(args);
  };

  const result = await applyDeviceStateIntent(
    repository,
    7,
    updateState({ riego: true }, 'irrigation_on')
  );
  assert.deepEqual(result.state, { luz: false, riego: true, timeScale: 5 });
});

test('invalid intents do not modify persisted state', async () => {
  const repository = new FakeVersionedStateRepository(7, { luz: false });

  await assert.rejects(
    applyDeviceStateIntent(repository, 7, () => ({ state: null })),
    TypeError
  );
  assert.equal(repository.compareAndSwapCount, 0);
  assert.deepEqual(repository.snapshot.state, { luz: false });
  assert.equal(repository.snapshot.revision, 0);
});

test('read failures are explicit and do not attempt a write', async () => {
  const repository = new FakeVersionedStateRepository(7, { luz: false });
  repository.failReads = 1;

  await assert.rejects(
    applyDeviceStateIntent(repository, 7, updateState({ luz: true }, 'light_on')),
    (error) => error instanceof StatePersistenceError
      && error.cause?.message === 'simulated read failure'
  );
  assert.equal(repository.compareAndSwapCount, 0);
});

test('a missing row returned by the CAS repository is an explicit persistence error', async () => {
  const repository = new FakeVersionedStateRepository(7, { luz: false });
  repository.compareAndSwap = async () => ({ status: 'not_found' });

  await assert.rejects(
    applyDeviceStateIntent(repository, 7, updateState({ luz: true }, 'light_on')),
    (error) => error instanceof StatePersistenceError
      && error.message.includes('row not found')
  );
});
