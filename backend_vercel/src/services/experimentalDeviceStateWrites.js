function clone(value) {
  return structuredClone(value);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class StateWriteConflictError extends Error {
  constructor(chatId, attempts) {
    super(`Device state write conflicted after ${attempts} attempts for chat_id ${chatId}`);
    this.name = 'StateWriteConflictError';
    this.chatId = chatId;
    this.attempts = attempts;
  }
}

export class StatePersistenceError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'StatePersistenceError';
  }
}

function validateSnapshot(snapshot, chatId) {
  if (!isRecord(snapshot)
      || String(snapshot.chatId) !== String(chatId)
      || !isRecord(snapshot.state)
      || !Number.isSafeInteger(snapshot.revision)
      || snapshot.revision < 0) {
    throw new StatePersistenceError('Repository returned an invalid device state snapshot');
  }
}

function validateIntentResult(result) {
  if (!isRecord(result)
      || !isRecord(result.state)
      || (result.lastAction !== undefined && typeof result.lastAction !== 'string')
      || (result.metadata !== undefined && result.metadata === null)) {
    throw new TypeError('State intent must return { state, lastAction?, metadata? }');
  }
}

export async function applyDeviceStateIntent(repository, chatId, intent, options = {}) {
  if (!repository
      || typeof repository.read !== 'function'
      || typeof repository.compareAndSwap !== 'function') {
    throw new TypeError('Repository must implement read and compareAndSwap');
  }
  if (chatId === null || chatId === undefined || typeof intent !== 'function') {
    throw new TypeError('chatId and an intent function are required');
  }

  const maxAttempts = options.maxAttempts === undefined ? 3 : options.maxAttempts;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive safe integer');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let snapshot;
    try {
      snapshot = await repository.read(chatId);
    } catch (error) {
      throw new StatePersistenceError('Could not read device state', { cause: error });
    }

    validateSnapshot(snapshot, chatId);
    const intentResult = intent(clone(snapshot.state), {
      chatId,
      revision: snapshot.revision,
      attempt
    });
    validateIntentResult(intentResult);
    const metadata = intentResult.metadata === undefined ? undefined : clone(intentResult.metadata);

    let result;
    try {
      result = await repository.compareAndSwap({
        chatId,
        expectedRevision: snapshot.revision,
        nextState: clone(intentResult.state),
        lastAction: intentResult.lastAction ?? snapshot.lastAction
      });
    } catch (error) {
      throw new StatePersistenceError('Could not persist device state', { cause: error });
    }

    if (result?.status === 'updated') {
      validateSnapshot(result.snapshot, chatId);
      const committedSnapshot = clone(result.snapshot);
      if (metadata !== undefined) committedSnapshot.metadata = metadata;
      return committedSnapshot;
    }
    if (result?.status === 'not_found') {
      throw new StatePersistenceError(`Device state row not found for chat_id ${chatId}`);
    }
    if (result?.status !== 'conflict') {
      throw new StatePersistenceError('Repository returned an invalid compare-and-swap result');
    }
  }

  throw new StateWriteConflictError(chatId, maxAttempts);
}
