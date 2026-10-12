import { ensureDeviceState, saveDeviceState } from './deviceStates.js';

function actionToLastActionTurnOn(device) {
  if (device === 'luz') return 'encender_luz';
  if (device === 'aire') return 'encender_aire';
  if (device === 'temperatura_c') return 'activar_calor';
  if (device === 'humedad_pct') return 'activar_sequedad';
  if (device === 'riego') return 'activar_riego';
  return 'accion_on';
}

function actionToLastActionTurnOff(device) {
  if (device === 'luz') return 'apagar_luz';
  if (device === 'aire') return 'apagar_aire';
  if (device === 'temperatura_c') return 'desactivar_calor';
  if (device === 'humedad_pct') return 'desactivar_sequedad';
  if (device === 'riego') return 'desactivar_riego';
  return 'accion_off';
}

function applySimulatedModeFromTemperature(state, deviceOn) {
  const normalTemp = 27;
  const topTemp = 35;
  const step = 2;

  if (deviceOn) {
    state.modoCalor = true;
    state.temperatura_c = Math.min(topTemp, (state.temperatura_c ?? normalTemp) + step);
  } else {
    state.modoCalor = false;
    state.temperatura_c = Math.max(normalTemp, (state.temperatura_c ?? topTemp) - step);
  }
}

function applySimulatedModeFromHumidity(state, deviceOn) {
  const normalHumidity = 68;
  const dryHumidity = 40;
  const step = 6;

  if (deviceOn) {
    state.modoSeco = true;
    state.humedad_pct = Math.max(dryHumidity, (state.humedad_pct ?? normalHumidity) - step);
  } else {
    state.modoSeco = false;
    state.humedad_pct = Math.min(normalHumidity, (state.humedad_pct ?? dryHumidity) + step);
  }
}

function applySimulatedModeFromIrrigation(state, deviceOn) {
  const normalHumidity = 68;
  const maxHumidity = 70;
  const step = 6;

  state.riego = deviceOn;
  if (deviceOn) {
    state.humedad_pct = Math.min(maxHumidity, (state.humedad_pct ?? normalHumidity) + step);
  } else {
    state.humedad_pct = Math.max(normalHumidity, (state.humedad_pct ?? maxHumidity) - step);
  }
}

function applyDeviceAction(state, device, on) {
  if (device === 'luz' || device === 'aire') {
    state[device] = on;
  } else if (device === 'temperatura_c') {
    applySimulatedModeFromTemperature(state, on);
    if (state.temperatura_c >= 32) state.aire = true;
    if (!on && state.temperatura_c <= 30) state.aire = false;
  } else if (device === 'humedad_pct') {
    applySimulatedModeFromHumidity(state, on);
    if (on && state.humedad_pct <= 45) state.riego = true;
  } else if (device === 'riego') {
    applySimulatedModeFromIrrigation(state, on);
    if (state.humedad_pct >= 70) state.riego = false;
  }
}

function isSupportedDevice(device) {
  return ['luz', 'aire', 'temperatura_c', 'humedad_pct', 'riego'].includes(device);
}

export async function executeAction(supabase, actionObj, chatId) {
  if (!actionObj) {
    const current = await ensureDeviceState(supabase, chatId);
    return { ...current, applied: false };
  }

  const { action, device } = actionObj;
  if (!isSupportedDevice(device)) {
    const current = await ensureDeviceState(supabase, chatId);
    return { ...current, applied: false };
  }

  const on = action === 'turn_on';
  const lastAction = on
    ? actionToLastActionTurnOn(device)
    : actionToLastActionTurnOff(device);
  const saved = await saveDeviceState(
    supabase,
    chatId,
    (state) => {
      applyDeviceAction(state, device, on);
      return { state };
    },
    lastAction
  );
  return { ...saved, applied: true };
}

export async function toggleDevice(supabase, device, chatId) {
  if (device === 'luz' || device === 'aire') {
    const saved = await saveDeviceState(
      supabase,
      chatId,
      (state) => {
        const next = !state[device];
        state[device] = next;
        return {
          state,
          lastAction: next
            ? actionToLastActionTurnOn(device)
            : actionToLastActionTurnOff(device)
        };
      }
    );
    return { ...saved, applied: true };
  }

  const modeField = device === 'temperatura_c'
    ? 'modoCalor'
    : device === 'humedad_pct'
      ? 'modoSeco'
      : device === 'riego'
        ? 'riego'
        : null;
  if (!modeField) {
    const current = await ensureDeviceState(supabase, chatId);
    return { ...current, state: current.state, applied: false };
  }

  const saved = await saveDeviceState(
    supabase,
    chatId,
    (state) => {
      const on = !state[modeField];
      applyDeviceAction(state, device, on);
      return {
        state,
        lastAction: on
          ? actionToLastActionTurnOn(device)
          : actionToLastActionTurnOff(device)
      };
    }
  );
  return { ...saved, applied: true };
}
