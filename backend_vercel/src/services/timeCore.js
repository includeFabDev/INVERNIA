export const DEFAULT_TIME_POLICY = Object.freeze({
  MIN_DT_SEC: 0.5,
  MAX_DT_SEC: 120
});

export function isVirtualInstantInitialized(virtualInstantMs) {
  return Number.isFinite(virtualInstantMs)
    && Math.abs(virtualInstantMs) <= 8.64e15;
}

export function validateTimeScale(timeScale) {
  if (typeof timeScale !== 'number' || !Number.isFinite(timeScale) || timeScale <= 0) {
    throw new RangeError('timeScale must be a finite number greater than zero');
  }
  return timeScale;
}

export function normalizeDeltaSeconds(rawSeconds, options = {}) {
  const minSec = options.minSec === undefined ? DEFAULT_TIME_POLICY.MIN_DT_SEC : options.minSec;
  const maxSec = options.maxSec === undefined ? DEFAULT_TIME_POLICY.MAX_DT_SEC : options.maxSec;
  if (!Number.isFinite(minSec) || minSec < 0 || !Number.isFinite(maxSec) || maxSec < minSec) {
    throw new RangeError('Delta limits must be finite, non-negative, and ordered');
  }
  if (typeof rawSeconds !== 'number' || !Number.isFinite(rawSeconds)) {
    throw new RangeError('Delta seconds must be a finite number');
  }

  const effectiveSeconds = Math.max(minSec, Math.min(maxSec, rawSeconds));
  return {
    rawSeconds,
    effectiveSeconds,
    clamped: effectiveSeconds !== rawSeconds,
    deltaMs: effectiveSeconds * 1000
  };
}

export function advanceVirtualInstant(previousVirtualInstantMs, rawDtSeconds, timeScale, options = {}) {
  if (previousVirtualInstantMs === null || previousVirtualInstantMs === undefined) {
    return null;
  }
  if (!isVirtualInstantInitialized(previousVirtualInstantMs)) {
    throw new RangeError('virtualInstantMs must be a valid Unix timestamp in milliseconds');
  }

  const validatedTimeScale = validateTimeScale(timeScale);
  const normalizedDelta = normalizeDeltaSeconds(rawDtSeconds, options);
  const virtualMinutesDelta = normalizedDelta.effectiveSeconds * validatedTimeScale;
  const virtualMillisecondsDelta = virtualMinutesDelta * 60_000;
  const nextVirtualInstantMs = previousVirtualInstantMs + virtualMillisecondsDelta;
  if (!isVirtualInstantInitialized(nextVirtualInstantMs)) {
    throw new RangeError('Advanced virtual instant is outside the supported Date range');
  }

  return {
    previousVirtualInstantMs,
    rawDtSeconds: normalizedDelta.rawSeconds,
    effectiveSeconds: normalizedDelta.effectiveSeconds,
    clamped: normalizedDelta.clamped,
    timeScale: validatedTimeScale,
    virtualMinutesDelta,
    virtualMillisecondsDelta,
    nextVirtualInstantMs
  };
}

export function parseVirtualHHMM(hhmm) {
  if (typeof hhmm !== 'string') {
    return null;
  }

  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) {
    return null;
  }

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }

  return {
    hh,
    mm,
    totalMinutes: (hh * 60) + mm
  };
}

export function minutesToHHMM(totalMinutes) {
  if (typeof totalMinutes !== 'number' || !Number.isFinite(totalMinutes)) {
    throw new RangeError('totalMinutes must be a finite number');
  }

  const wholeMinutes = Math.floor(totalMinutes);
  const normalized = ((wholeMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function getTimeZoneParts(instantMs, timeZone = 'UTC') {
  if (!isVirtualInstantInitialized(instantMs)) {
    throw new RangeError('virtualInstantMs must be a valid Unix timestamp in milliseconds');
  }

  const date = new Date(instantMs);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  const map = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal' && part.type !== 'timeZoneName') {
      map[part.type] = part.value;
    }
  }

  return map;
}

export function deriveVirtualHourHH(virtualInstantMs, timeZone = 'UTC') {
  if (virtualInstantMs === null || virtualInstantMs === undefined) {
    return null;
  }

  const parts = getTimeZoneParts(virtualInstantMs, timeZone);
  const hour = Number(parts.hour || 0);
  const minute = Number(parts.minute || 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function deriveVirtualDateISO(virtualInstantMs, timeZone = 'UTC') {
  if (virtualInstantMs === null || virtualInstantMs === undefined) {
    return null;
  }

  const parts = getTimeZoneParts(virtualInstantMs, timeZone);
  const year = Number(parts.year || 1970);
  const month = Number(parts.month || 1);
  const day = Number(parts.day || 1);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function calculateVirtualElapsedDays(referenceInstantMs, currentInstantMs) {
  if (referenceInstantMs === null || referenceInstantMs === undefined
      || currentInstantMs === null || currentInstantMs === undefined) {
    return null;
  }
  if (!isVirtualInstantInitialized(referenceInstantMs) || !isVirtualInstantInitialized(currentInstantMs)) {
    throw new RangeError('Elapsed-day inputs must be valid Unix timestamps in milliseconds');
  }

  const deltaMs = currentInstantMs - referenceInstantMs;
  return deltaMs / 86_400_000;
}

export function getVirtualDateState(virtualInstantMs, timeZone = 'UTC') {
  if (virtualInstantMs === null || virtualInstantMs === undefined) {
    return null;
  }
  if (!isVirtualInstantInitialized(virtualInstantMs)) {
    throw new RangeError('virtualInstantMs must be a valid Unix timestamp in milliseconds');
  }

  return {
    instantMs: virtualInstantMs,
    dateISO: deriveVirtualDateISO(virtualInstantMs, timeZone),
    hourHH: deriveVirtualHourHH(virtualInstantMs, timeZone)
  };
}
