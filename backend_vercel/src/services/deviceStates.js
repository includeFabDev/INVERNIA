import { createZoneMeasurements } from './zones.js';
import { applyDeviceStateIntent, StatePersistenceError } from './experimentalDeviceStateWrites.js';
import { createSupabaseDeviceStateRepository } from './supabaseDeviceStateRepository.js';

const DEFAULT_STATE = {
  luz: false,
  aire: false,
  riego: false,
  temperatura_c: 27,
  humedad_pct: 68,
  humedad_suelo_pct: 58,
  iluminancia_lux: 0,
  co2_ppm: 650,
  ph: 6.2,
  modoCalor: false,
  modoSeco: false,
  modoAutomatico: true,
  fuenteDatos: 'simulation',
  usarHoraReal: true,
  timeScale: 1,
  horaVirtual: '18:45'
};

const MAX_CREATE_ATTEMPTS = 3;

function casEnabled() {
  return process.env.DEVICE_STATE_WRITE_MODE === 'cas';
}

function toDeviceStateRow(snapshot) {
  const row = {
    chat_id: snapshot.chatId,
    state: snapshot.state,
    last_action: snapshot.lastAction,
    updated_at: snapshot.updatedAt ?? null,
    revision: snapshot.revision
  };
  if (snapshot.metadata !== undefined) row.metadata = snapshot.metadata;
  return row;
}

export function getDefaultState() {
  const state = { ...DEFAULT_STATE };
  state.zonas = createZoneMeasurements(state);
  return state;
}

export async function ensureDeviceState(supabase, chatId) {
  const repository = createSupabaseDeviceStateRepository(supabase);

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      return toDeviceStateRow(await repository.read(chatId));
    } catch (error) {
      if (!(error instanceof StatePersistenceError) || error.code !== 'DEVICE_STATE_NOT_FOUND') {
        throw error;
      }
    }

    if (!casEnabled()) {
      throw new StatePersistenceError(
        'Device state creation is disabled; set DEVICE_STATE_WRITE_MODE=cas after CAS is installed'
      );
    }

    const creation = await repository.createIfAbsent(chatId, getDefaultState(), 'init');
    if (creation.status === 'created') return toDeviceStateRow(creation.snapshot);
  }

  throw new StatePersistenceError(`Could not create or read device state for chat_id ${chatId}`);
}

export async function saveDeviceState(supabase, chatId, intent, lastAction) {
  if (!casEnabled()) {
    throw new StatePersistenceError(
      'Device state writes are disabled; set DEVICE_STATE_WRITE_MODE=cas after all writers are coordinated'
    );
  }
  if (typeof intent !== 'function') {
    throw new TypeError('saveDeviceState requires a replayable state intent function');
  }

  await ensureDeviceState(supabase, chatId);
  const repository = createSupabaseDeviceStateRepository(supabase);
  const snapshot = await applyDeviceStateIntent(
    repository,
    chatId,
    (state, context) => {
      const result = intent(state, context);
      if (!result || typeof result !== 'object' || !result.state || typeof result.state !== 'object') {
        throw new TypeError('State intent must return an object containing state');
      }
      return {
        state: result.state,
        lastAction: result.lastAction ?? lastAction,
        metadata: result.metadata
      };
    }
  );
  return toDeviceStateRow(snapshot);
}
