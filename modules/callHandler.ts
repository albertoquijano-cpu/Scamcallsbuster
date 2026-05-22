import RNCallKeep from 'react-native-callkeep';
import { isNumberWhitelisted } from './contactsWhitelist';
import { startFaxTones, stopFaxTones } from './audioEngine';

let activeCallId: string | null = null;
let callIsFiltered = false;
let appEnabled = true;
let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
let autoAnswerTimeout: ReturnType<typeof setTimeout> | null = null;
let userAnswered = false;
let silenceSeconds = 7;

export function setAppEnabled(enabled: boolean) {
  appEnabled = enabled;
  console.log('[CallHandler] App', enabled ? 'habilitada' : 'deshabilitada');
}

export function getAppEnabled() {
  return appEnabled;
}

export function setSilenceSeconds(seconds: number) {
  silenceSeconds = seconds;
  console.log('[CallHandler] Silencio configurado:', seconds, 'segundos');
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

  RNCallKeep.addEventListener('answerCall', async ({ callUUID }) => {
    if (callUUID === activeCallId && callIsFiltered) {
      console.log('[CallHandler] Usuario contestó manualmente');
      userAnswered = true;
      if (autoAnswerTimeout) {
        clearTimeout(autoAnswerTimeout);
        autoAnswerTimeout = null;
      }
      silenceTimeout = setTimeout(async () => {
        console.log(`[CallHandler] ${silenceSeconds}s de silencio cumplidos, iniciando tonos`);
        await startFaxTones();
      }, silenceSeconds * 1000);
    }
  });

  RNCallKeep.addEventListener('endCall', async ({ callUUID }) => {
    console.log('[CallHandler] Emisor colgó:', callUUID);
    await handleCallEnded(callUUID);
  });

  RNCallKeep.addEventListener('didActivateAudioSession', async () => {
    if (callIsFiltered && !userAnswered) {
      await startFaxTones();
    }
  });

  RNCallKeep.addEventListener('didDeactivateAudioSession', async () => {
    await stopFaxTones();
    clearAllTimeouts();
  });
}

async function handleIncomingCall(callUUID: string, phoneNumber: string) {
  activeCallId = callUUID;
  userAnswered = false;

  if (!appEnabled) {
    callIsFiltered = false;
    RNCallKeep.displayIncomingCall(callUUID, phoneNumber, phoneNumber, 'number', false);
    return;
  }

  const { allowed, reason } = await isNumberWhitelisted(phoneNumber);

  if (allowed) {
    callIsFiltered = false;
    RNCallKeep.displayIncomingCall(callUUID, phoneNumber, phoneNumber, 'number', false);
    return;
  }

  callIsFiltered = true;
  const displayName = reason === 'suspicious_pattern'
    ? '⚠️ Patrón sospechoso'
    : 'Número desconocido';

  RNCallKeep.displayIncomingCall(callUUID, phoneNumber, displayName, 'number', false);

  autoAnswerTimeout = setTimeout(async () => {
    if (!userAnswered && activeCallId === callUUID) {
      console.log('[CallHandler] 10s de repique, app contesta automáticamente');
      RNCallKeep.answerIncomingCall(callUUID);
    }
  }, 10000);
}

async function handleCallEnded(callUUID: string) {
  if (callUUID === activeCallId) {
    clearAllTimeouts();
    await stopFaxTones();
    activeCallId = null;
    callIsFiltered = false;
    userAnswered = false;
  }
}

function clearAllTimeouts() {
  if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
  if (autoAnswerTimeout) { clearTimeout(autoAnswerTimeout); autoAnswerTimeout = null; }
}

export async function acceptFilteredCall() {
  if (!activeCallId) return;
  clearAllTimeouts();
  callIsFiltered = false;
  await stopFaxTones();
  console.log('[CallHandler] Llamada aceptada, conectando normalmente');
}

export function getActiveCallId() {
  return activeCallId;
}

export function getCallIsFiltered() {
  return callIsFiltered;
}
