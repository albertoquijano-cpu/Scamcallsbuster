import RNCallKeep from 'react-native-callkeep';
import { isNumberWhitelisted } from './contactsWhitelist';
import { startFaxTones, stopFaxTones } from './audioEngine';
import { detectCallType, CallType } from './callTypeDetector';
import { addSuspiciousNumber } from './callDirectory';

let activeCallId: string | null = null;
let callIsFiltered = false;
let activeCallType: CallType = 'unknown';
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

export function getActiveCallType(): CallType {
  return activeCallType;
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
    console.log('[CallHandler] Audio activo, callType:', activeCallType);
    // VoIP — app contestó automáticamente, iniciar silencio
    if (callIsFiltered && activeCallType === 'VoIP') {
      silenceTimeout = setTimeout(async () => {
        console.log('[CallHandler] VoIP: silencio terminado, iniciando tonos');
        await startFaxAndDisconnect();
      }, silenceSeconds * 1000);
    }
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

  // Detectar tipo de llamada
  activeCallType = await detectCallType(phoneNumber);
  callIsFiltered = true;

  const displayName = reason === 'suspicious_pattern'
    ? '⚠️ Patrón sospechoso'
    : 'Número desconocido';

  RNCallKeep.displayIncomingCall(callUUID, phoneNumber, displayName, 'number', false);

  // Agregar a Call Directory para identificación futura
  await addSuspiciousNumber(phoneNumber);

  // VoIP — app contesta automáticamente después de 1.5 seg
  if (activeCallType === 'VoIP') {
    setTimeout(() => {
      if (activeCallId === callUUID) {
        RNCallKeep.answerIncomingCall(callUUID);
      }
    }, 1500);
  }
  // GSM — usuario contesta manualmente, SCB muestra pantalla
}

async function handleCallEnded(callUUID: string) {
  if (callUUID === activeCallId) {
    clearAllTimeouts();
    await stopFaxTones();
    activeCallId = null;
    callIsFiltered = false;
    activeCallType = 'unknown';
  }
}

// Iniciar tonos y desconectar después de 20 segundos
async function startFaxAndDisconnect() {
  await startFaxTones();
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

// Usuario toma la llamada normalmente
export async function acceptFilteredCall() {
  if (!activeCallId) return;
  clearAllTimeouts();
  callIsFiltered = false;
  await stopFaxTones();
  console.log('[CallHandler] Llamada aceptada normalmente');
}

// Usuario eligió escuchar — GSM ya está conectado, solo iniciamos silencio
export async function startListening() {
  if (!activeCallId) return;
  console.log(`[CallHandler] GSM: escuchando por ${silenceSeconds} segundos`);
  // El silencio es natural — el usuario ya contestó y SCB no emite nada
  // El timer de silencio corre en la UI
}

// Usuario descarta — empiezan tonos inmediatamente, 20 seg máximo
export async function discardFilteredCall() {
  if (!activeCallId) return;
  clearAllTimeouts();
  console.log('[CallHandler] Descartando — iniciando tonos');
  await startFaxAndDisconnect();
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
