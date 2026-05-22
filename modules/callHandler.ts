import RNCallKeep from 'react-native-callkeep';
import { isNumberWhitelisted } from './contactsWhitelist';
import { startFaxTones, stopFaxTones } from './audioEngine';

let activeCallId: string | null = null;
let callIsFiltered = false;
let appEnabled = true;
let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
let tonesTimeout: ReturnType<typeof setTimeout> | null = null;
let silenceSeconds = 7;

export function setAppEnabled(enabled: boolean) {
  appEnabled = enabled;
}

export function getAppEnabled() {
  return appEnabled;
}

export function setSilenceSeconds(seconds: number) {
  silenceSeconds = seconds;
}

export function getSilenceSeconds() {
  return silenceSeconds;
}

export async function setupCallHandler() {
  try {
    await RNCallKeep.setup({
      ios: {
        appName: 'ScamCalls Buster',
        supportsVideo: false,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: 'Permisos necesarios',
        alertDescription: 'ScamCalls Buster necesita acceso a las llamadas para filtrar spam',
        cancelButton: 'Cancelar',
        okButton: 'Aceptar',
        additionalPermissions: [],
        foregroundService: {
          channelId: 'scamcalls_calls',
          channelName: 'Filtro de llamadas',
          notificationTitle: 'ScamCalls Buster activo',
        },
        selfManaged: true,
      },
    });
    registerCallEvents();
    console.log('[CallHandler] CallKit configurado');
  } catch (err) {
    console.error('[CallHandler] Error configurando CallKit:', err);
  }
}

function registerCallEvents() {
  RNCallKeep.addEventListener('didReceiveStartCallAction', async ({ callUUID, handle }) => {
    console.log('[CallHandler] Llamada entrante:', handle);
    await handleIncomingCall(callUUID, handle);
  });

  RNCallKeep.addEventListener('endCall', async ({ callUUID }) => {
    console.log('[CallHandler] Llamada terminada:', callUUID);
    await handleCallEnded(callUUID);
  });

  RNCallKeep.addEventListener('didActivateAudioSession', async () => {
    console.log('[CallHandler] Audio activo');
  });

  RNCallKeep.addEventListener('didDeactivateAudioSession', async () => {
    await stopFaxTones();
    clearAllTimeouts();
  });
}

async function handleIncomingCall(callUUID: string, phoneNumber: string) {
  activeCallId = callUUID;
  callIsFiltered = false;

  if (!appEnabled) {
    RNCallKeep.displayIncomingCall(callUUID, phoneNumber, phoneNumber, 'number', false);
    return;
  }

  const { allowed, reason } = await isNumberWhitelisted(phoneNumber);

  if (allowed) {
    RNCallKeep.displayIncomingCall(callUUID, phoneNumber, phoneNumber, 'number', false);
    return;
  }

  // Número desconocido — mostrar llamada, SCB toma control visual
  callIsFiltered = true;
  const displayName = reason === 'suspicious_pattern'
    ? '⚠️ Patrón sospechoso'
    : 'Número desconocido';

  RNCallKeep.displayIncomingCall(callUUID, phoneNumber, displayName, 'number', false);
}

async function handleCallEnded(callUUID: string) {
  if (callUUID === activeCallId) {
    clearAllTimeouts();
    await stopFaxTones();
    activeCallId = null;
    callIsFiltered = false;
  }
}

// Usuario toma la llamada normalmente
export async function acceptFilteredCall() {
  if (!activeCallId) return;
  clearAllTimeouts();
  callIsFiltered = false;
  await stopFaxTones();
  console.log('[CallHandler] Llamada aceptada normalmente');
}

// Usuario elige "Escuchar y decidir" — app contesta, silencio X seg
export async function listenAndDecide() {
  if (!activeCallId) return;
  RNCallKeep.answerIncomingCall(activeCallId);
  console.log(`[CallHandler] Escuchando por ${silenceSeconds} segundos`);
}

// Usuario descarta — empiezan tonos inmediatamente, máximo 20 seg
export async function discardFilteredCall() {
  if (!activeCallId) return;

  console.log('[CallHandler] Descartando — iniciando tonos');
  await startFaxTones();

  // Después de 20 segundos de tonos, SCB corta la conexión
  tonesTimeout = setTimeout(async () => {
    console.log('[CallHandler] 20 segundos de tonos cumplidos, cortando conexión');
    await stopFaxTones();
    if (activeCallId) {
      RNCallKeep.endCall(activeCallId);
      activeCallId = null;
      callIsFiltered = false;
    }
  }, 20000);
}

function clearAllTimeouts() {
  if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
  if (tonesTimeout) { clearTimeout(tonesTimeout); tonesTimeout = null; }
}

export function getActiveCallId() {
  return activeCallId;
}

export function getCallIsFiltered() {
  return callIsFiltered;
}
