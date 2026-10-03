import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';

import { getSupabaseClient } from './services/supabaseClient.js';
import { stateRoute } from './routes/state.js';
import { telegramWebhookRoute } from './routes/telegram.js';
import { ensureDeviceState } from './services/deviceStates.js';
import { actionRoute } from './routes/action.js';
import { measurementsRoute } from './routes/measurements.js';
import { telemetryRoute } from './routes/telemetry.js';
import { eventsRoute } from './routes/events.js';
import cronHandler from '../../api/cron/invernadero.js';


export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');
  app.use('/frontend', express.static(frontendDirectory));
  app.get('/', (_req, res) => res.sendFile(path.join(frontendDirectory, 'index.html')));


  const supabase = getSupabaseClient();

  // Debug: registra toda petición que llegue a Express.
  // Útil para confirmar si Telegram está entrando o si Vercel responde 404 antes.
  app.use((req, res, next) => {
    console.log('[REQUEST]', req.method, req.originalUrl);
    next();
  });

  app.get('/api/state/:chatId', awaitableHandler(async (req, res) => {

    // para asegurar inicialización automática como en la versión original
    const chatId = req.params.chatId;
    await ensureDeviceState(supabase, chatId);
    return stateRoute(supabase)(req, res);
  }));

  app.get('/api/measurements', awaitableHandler(measurementsRoute(supabase)));
  app.all('/api/events', awaitableHandler(eventsRoute(supabase)));
  app.get('/api/cron/invernadero', awaitableHandler(cronHandler));
  app.post('/api/v1/telemetry', awaitableHandler(telemetryRoute(supabase)));
  app.post('/api/telegram-webhook', awaitableHandler(telegramWebhookRoute(supabase)));
  app.post('/api/action', awaitableHandler(actionRoute(supabase)));


  // helper local
  function awaitableHandler(fn) {
    return async (req, res) => {
      try {
        return await fn(req, res);
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Internal error' });
      }
    };
  }

  return app;
}

// Nota: app.listen() vive en entrypoint.

