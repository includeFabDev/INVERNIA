import { executeAction } from '../services/executeAction.js';
import { ensureDeviceState, saveDeviceState } from '../services/deviceStates.js';
import { env } from '../config/env.js';

// ID de base de datos unificado para la simulación de la maqueta
const dbChatId = 123456789;

/**
 * Envía un mensaje nuevo a Telegram con opción de teclado inline.
 */
async function sendTelegramMessage(chatId, messageText, replyMarkup = null) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN no configurado (env.TELEGRAM_BOT_TOKEN vacío).');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = { 
    chat_id: chatId, 
    text: messageText, 
    parse_mode: 'Markdown' 
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    console.log('[Telegram sendMessage result]', { ok: result?.ok, description: result?.description });
  } catch (e) {
    console.warn('[Telegram sendMessage] error', e);
  }
}

/**
 * Edita un mensaje existente en Telegram para actualizar su texto y teclado inline.
 */
async function updateTelegramMessage(chatId, messageId, messageText, replyMarkup = null) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: messageText,
    parse_mode: 'Markdown'
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    console.log('[Telegram editMessageText result]', { ok: result?.ok, description: result?.description });
  } catch (e) {
    console.error('[Telegram editMessageText error]', e);
  }
}

/**
 * Responde a un callback query de Telegram para quitar la animación de carga en la app del usuario.
 */
async function answerTelegramCallbackQuery(callbackQueryId, text = '') {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  const payload = { callback_query_id: callbackQueryId };
  if (text) {
    payload.text = text;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    console.log('[Telegram answerCallbackQuery result]', { ok: result?.ok });
  } catch (e) {
    console.error('[Telegram answerCallbackQuery error]', e);
  }
}

/**
 * Genera el texto con el estado actual del invernadero/Smart Home.
 */
function getStatusText(state, zone = 'GENERAL') {
  const measurements = zone === 'GENERAL' ? state : (state.zonas?.[zone] || state);
  const temperature = typeof measurements.temperatura_c === 'number' ? `${measurements.temperatura_c.toFixed(1)} °C` : '-- °C';
  const relativeHumidity = typeof measurements.humedad_pct === 'number' ? `${measurements.humedad_pct.toFixed(0)} %` : '-- %';
  const soilMoisture = typeof measurements.humedad_suelo_pct === 'number' ? `${measurements.humedad_suelo_pct.toFixed(0)} %` : '-- %';
  const illuminance = typeof measurements.iluminancia_lux === 'number' ? `${Math.round(measurements.iluminancia_lux)} lux` : '-- lux';
  const co2 = typeof measurements.co2_ppm === 'number' ? `${Math.round(measurements.co2_ppm)} ppm` : '-- ppm';
  const ph = typeof measurements.ph === 'number' ? measurements.ph.toFixed(2) : '--';
  const mode = state.modoAutomatico !== false ? 'AUTOMÁTICO' : 'MANUAL';
  const irrigation = state.riego ? 'ON' : 'OFF';
  const ventilation = state.aire ? 'ON' : 'OFF';
  const source = measurements.fuenteDatos || state.fuenteDatos || 'simulation';

  return [
    `*INVERNIA · ${zone === 'GENERAL' ? 'GENERAL' : `ZONA ${zone}`}*`,
    `Temperatura: ${temperature}`,
    `Humedad relativa: ${relativeHumidity}`,
    `Humedad del suelo: ${soilMoisture}`,
    `Iluminancia: ${illuminance}`,
    `CO₂: ${co2}`,
    `pH: ${ph}`,
    `Modo: ${mode}`,
    `Riego: ${irrigation}`,
    `Ventilación: ${ventilation}`,
    `Fuente: ${source === 'physical' ? 'DISPOSITIVO IoT' : 'SIMULACIÓN'}`
  ].join('\n');
}

/**
 * Construye el teclado dinámico basándose en los estados actuales.
 * Muestra solo la acción opuesta (ej: Apagar si está encendido).
 */
function buildDynamicKeyboard(state) {
  const keyboard = [];
  keyboard.push([
    { text: 'GENERAL', callback_data: 'zone_GENERAL' },
    { text: 'ZONA A', callback_data: 'zone_A' },
    { text: 'ZONA B', callback_data: 'zone_B' },
    { text: 'ZONA C', callback_data: 'zone_C' }
  ]);

  // Fila Luz
  if (state.luz) {
    keyboard.push([{ text: '🔌 Apagar Luz', callback_data: 'luz_off' }]);
  } else {
    keyboard.push([{ text: '💡 Encender Luz', callback_data: 'luz_on' }]);
  }

  // Fila Ventilador
  if (state.aire) {
    keyboard.push([{ text: '❄️ Apagar Ventilador', callback_data: 'aire_off' }]);
  } else {
    keyboard.push([{ text: '🌬️ Encender Ventilador', callback_data: 'aire_on' }]);
  }

  // Fila Riego
  if (state.riego) {
    keyboard.push([{ text: '🚫 Detener Riego', callback_data: 'riego_off' }]);
  } else {
    keyboard.push([{ text: '🌱 Activar Riego', callback_data: 'riego_on' }]);
  }

  // Fila Velocidad de simulación (x1 / x2 / x5 / x10)
  const ts = state.timeScale;
  const labelScale = (n) => (ts === n ? `• x${n} •` : `x${n}`);
  keyboard.push([
    { text: labelScale(1),  callback_data: 'scale_1' },
    { text: labelScale(2),  callback_data: 'scale_2' },
    { text: labelScale(5),  callback_data: 'scale_5' },
    { text: labelScale(10), callback_data: 'scale_10' },
  ]);

  // Fila de actualización
  keyboard.push([{ text: '🔄 Actualizar Estado', callback_data: 'refresh_panel' }]);

  return { inline_keyboard: keyboard };
}

/**
 * Route Handler para el Webhook de Telegram
 */
export function telegramWebhookRoute(supabase) {
  return async function telegramWebhookHandler(req, res) {
    try {
      const body = req.body || {};
      const isCallback = !!body.callback_query;
      const callbackQueryId = body.callback_query?.id;
      const callbackData = body.callback_query?.data;
      const messageId = body.callback_query?.message?.message_id || body.message?.message_id;
      const chatId = body.callback_query?.message?.chat?.id || body.message?.chat?.id;

      if (!chatId) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      if (isCallback && callbackQueryId && callbackData) {
        console.log(`[Telegram Webhook] Callback recibida. Chat: ${chatId}, Data: ${callbackData}`);
        let messageAck = 'Actualizando...';
        let selectedZone = 'GENERAL';

        // Procesar acciones siempre sobre el dbChatId fijo
        if (['zone_GENERAL', 'zone_A', 'zone_B', 'zone_C'].includes(callbackData)) {
          selectedZone = callbackData.slice('zone_'.length);
          messageAck = selectedZone === 'GENERAL' ? 'Estado general' : `Estado de Zona ${selectedZone}`;
        } else if (callbackData === 'luz_on') {
          await executeAction(supabase, { action: 'turn_on', device: 'luz' }, dbChatId);
          messageAck = '💡 Luz encendida';
        } else if (callbackData === 'luz_off') {
          await executeAction(supabase, { action: 'turn_off', device: 'luz' }, dbChatId);
          messageAck = '🔌 Luz apagada';
        } else if (callbackData === 'aire_on') {
          await executeAction(supabase, { action: 'turn_on', device: 'aire' }, dbChatId);
          messageAck = '🌬️ Ventilador encendido';
        } else if (callbackData === 'aire_off') {
          await executeAction(supabase, { action: 'turn_off', device: 'aire' }, dbChatId);
          messageAck = '❄️ Ventilador apagado';
        } else if (callbackData === 'riego_on') {
          await executeAction(supabase, { action: 'turn_on', device: 'riego' }, dbChatId);
          messageAck = '🌱 Riego activado';
        } else if (callbackData === 'riego_off') {
          await executeAction(supabase, { action: 'turn_off', device: 'riego' }, dbChatId);
          messageAck = '🚫 Riego detenido';
        } else if (callbackData === 'scale_1' || callbackData === 'scale_2' || callbackData === 'scale_5' || callbackData === 'scale_10') {
          // Botones de velocidad de simulación: persisten timeScale en Supabase
          // para que el cron del clima y el frontend lean el mismo factor.
          const nextScale = Number(callbackData.split('_')[1]);
          const current = await ensureDeviceState(supabase, dbChatId);
          const nextState = { ...(current.state || {}) };
          nextState.timeScale = nextScale;
          await saveDeviceState(supabase, dbChatId, nextState, 'set_timeScale');
          messageAck = `⏩ Velocidad: x${nextScale}`;
        } else if (callbackData === 'refresh_panel') {
          messageAck = '🔄 Estado actualizado';
        }

        // 1. Responder la callback query de Telegram
        await answerTelegramCallbackQuery(callbackQueryId, messageAck);

        // 2. Obtener estado nuevo de la base de datos fija y editar el mensaje existente
        const current = await ensureDeviceState(supabase, dbChatId);
        const statusText = getStatusText(current.state, selectedZone);
        const keyboard = buildDynamicKeyboard(current.state);
        
        const updateText = `🎛️ *Panel de Control - Smart Home / Invernadero*\n\n${statusText}`;
        // Mandamos a chatId (el chat donde se presionó el botón) pero con la info del dbChatId fijo
        await updateTelegramMessage(chatId, messageId, updateText, keyboard);

        return res.json({ ok: true });
      }

      // Si no es un callback, es un mensaje de texto normal
      console.log(`[Telegram Webhook] Mensaje normal recibido. Chat: ${chatId}`);

      // Consultamos el estado de la base de datos fija
      const current = await ensureDeviceState(supabase, dbChatId);
      const statusText = getStatusText(current.state);
      const keyboard = buildDynamicKeyboard(current.state);

      const welcomeMsg = `👋 *¡Bienvenido al sistema de control de tu Smart Home / Invernadero!*\n\nA continuación, tienes las opciones disponibles para controlar los dispositivos y sensores:\n\n${statusText}`;

      // Mandamos el mensaje al usuario que escribió (chatId) usando los datos del dbChatId fijo
      await sendTelegramMessage(chatId, welcomeMsg, keyboard);
      return res.json({ ok: true });

    } catch (err) {
      console.error('[Telegram Webhook Error]', err);
      return res.status(500).json({ error: 'Error en webhook' });
    }
  };
}
