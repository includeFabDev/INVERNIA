import { StatePersistenceError } from './experimentalDeviceStateWrites.js';

const DEFAULT_RPC_NAME = 'update_device_state_if_revision';
const MIN_BIGINT = -9223372036854775808n;
const MAX_BIGINT = 9223372036854775807n;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRpcRow(data) {
  if (Array.isArray(data)) {
    if (data.length !== 1) {
      throw new StatePersistenceError('Supabase CAS RPC returned an unexpected row count');
    }
    return data[0];
  }
  return data;
}

function normalizeChatId(chatId) {
  if (typeof chatId === 'number' && !Number.isSafeInteger(chatId)) {
    throw new TypeError('Numeric chatId must be a safe integer; use a decimal string for BIGINT precision');
  }

  if (typeof chatId !== 'number' && typeof chatId !== 'string' && typeof chatId !== 'bigint') {
    throw new TypeError('chatId must be a BIGINT-compatible integer');
  }

  const text = String(chatId);
  if (!/^-?\d+$/.test(text)) {
    throw new TypeError('chatId must be a BIGINT-compatible integer');
  }

  let value;
  try {
    value = BigInt(text);
  } catch (error) {
    throw new TypeError('chatId must be a BIGINT-compatible integer', { cause: error });
  }

  if (value < MIN_BIGINT || value > MAX_BIGINT) {
    throw new RangeError('chatId is outside the PostgreSQL BIGINT range');
  }
  return value.toString();
}

function validateRow(row, { requireChatId = true } = {}) {
  if (!isRecord(row)
      || (requireChatId && typeof row.chat_id !== 'number' && typeof row.chat_id !== 'string')
      || !isRecord(row.state)
      || !Number.isSafeInteger(row.revision)
      || row.revision < 0
      || (row.last_action !== null && typeof row.last_action !== 'string')) {
    throw new StatePersistenceError('Supabase returned an invalid device state row');
  }
}

function toSnapshot(row) {
  return {
    chatId: row.chat_id,
    state: structuredClone(row.state),
    revision: row.revision,
    lastAction: row.last_action,
    updatedAt: row.updated_at ?? null
  };
}

export function createSupabaseDeviceStateRepository(
  supabase,
  { rpcName = DEFAULT_RPC_NAME } = {}
) {
  if (!supabase || typeof supabase.from !== 'function' || typeof supabase.rpc !== 'function') {
    throw new TypeError('A Supabase client with from() and rpc() methods is required');
  }
  if (typeof rpcName !== 'string' || !rpcName.trim()) {
    throw new TypeError('rpcName must be a non-empty string');
  }

  return Object.freeze({
    async read(chatId) {
      const canonicalChatId = normalizeChatId(chatId);
      let response;
      try {
        response = await supabase
          .from('device_states')
          .select('chat_id, state, last_action, updated_at, revision')
          .eq('chat_id', canonicalChatId)
          .maybeSingle();
      } catch (error) {
        throw new StatePersistenceError('Supabase device state read failed', { cause: error });
      }

      if (response?.error) {
        throw new StatePersistenceError('Supabase device state read failed', {
          cause: response.error
        });
      }
      if (!response?.data) {
        const error = new StatePersistenceError(`Device state row not found for chat_id ${chatId}`);
        error.code = 'DEVICE_STATE_NOT_FOUND';
        throw error;
      }

      validateRow(response.data);
      return {
        ...toSnapshot(response.data),
        chatId: canonicalChatId
      };
    },

    async createIfAbsent(chatId, initialState, lastAction = 'init') {
      const canonicalChatId = normalizeChatId(chatId);
      if (!isRecord(initialState) || typeof lastAction !== 'string') {
        throw new TypeError('Initial state must be an object and lastAction must be text');
      }

      let response;
      try {
        response = await supabase
          .from('device_states')
          .insert({
            chat_id: canonicalChatId,
            state: structuredClone(initialState),
            last_action: lastAction,
            revision: 0
          })
          .select('chat_id, state, last_action, updated_at, revision')
          .single();
      } catch (error) {
        throw new StatePersistenceError('Supabase device state creation failed', { cause: error });
      }

      if (response?.error) {
        if (response.error.code === '23505') {
          return { status: 'conflict' };
        }
        throw new StatePersistenceError('Supabase device state creation failed', {
          cause: response.error
        });
      }
      validateRow(response?.data);
      return {
        status: 'created',
        snapshot: {
          ...toSnapshot(response.data),
          chatId: canonicalChatId
        }
      };
    },

    async compareAndSwap({ chatId, expectedRevision, nextState, lastAction }) {
      const canonicalChatId = normalizeChatId(chatId);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
          || !isRecord(nextState)
          || (lastAction !== undefined && lastAction !== null && typeof lastAction !== 'string')) {
        throw new TypeError('Invalid compare-and-swap arguments');
      }

      let response;
      try {
        response = await supabase.rpc(rpcName, {
          p_chat_id: canonicalChatId,
          p_expected_revision: expectedRevision,
          p_next_state: structuredClone(nextState),
          p_last_action: lastAction ?? null
        });
      } catch (error) {
        throw new StatePersistenceError('Supabase device state CAS failed', { cause: error });
      }

      if (response?.error) {
        throw new StatePersistenceError('Supabase device state CAS failed', {
          cause: response.error
        });
      }

      const row = normalizeRpcRow(response?.data);
      if (!isRecord(row) || !['updated', 'conflict', 'not_found'].includes(row.result)) {
        throw new StatePersistenceError('Supabase CAS RPC returned an invalid result');
      }
      if (row.result === 'not_found') {
        return { status: 'not_found' };
      }
      if (row.result === 'conflict') {
        return { status: 'conflict' };
      }

      const committedRow = {
        state: row.state,
        revision: row.revision,
        last_action: row.last_action
      };
      validateRow(committedRow, { requireChatId: false });
      if (committedRow.revision !== expectedRevision + 1) {
        throw new StatePersistenceError('Supabase CAS RPC returned an invalid revision');
      }

      return {
        status: 'updated',
        snapshot: {
          ...toSnapshot(committedRow),
          chatId: canonicalChatId
        }
      };
    }
  });
}
