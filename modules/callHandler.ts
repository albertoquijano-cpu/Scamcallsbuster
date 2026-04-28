import RNCallKeep from 'react-native-callkeep';
import { isNumberWhitelisted } from './contactsWhitelist';
import { startFaxTones, stopFaxTones } from './audioEngine';

let activeCallId: string | null = null;
let callIsFiltered = false;
let appEnabled = true;
let faxTimeout: ReturnType<typeof setTimeout> | null = null;
let rejectedCalls: Set<string> = new Set();

export function setAppEnabled(enabled: boolean) {
  appEnabled = enabled;
  console.log('[CallHandler] App', enabled ? 'habilitada' : 'deshabilitada');
}

export function getAppEnabled() {
  return appEnabled;
}

export async function setupCallHandler() {
  try {
    await RNCallKeep.setup({
      ios: {
        appName: 'ScamCalls Buster',
        supportsVideo: false,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        // Soporte VoIP/SIP
        includesCallsInRecents: true,
        supportsVideo: false,
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
        // Soporte VoIP en Android
        selfManaged: true,
      },
    });
    registerCallEvents();
    console.log('[CallHandler] CallKit configurado con soporte VoIP/SIP');
  } catch (err) {
    console.error('[CallHandler] Error configurando CallKit:', err);
  }
}

function registerCallEvents() {
  // Llamada entrante — celular y VoIP/SIP
  RNCallKeep.addEventListener('didReceiveStartCallAction', async ({ callUUID, handle, isVideo }) => {
    console.log('[CallHandler] Llamada entrante:', handle, isVideo ? '(video)' : '');
    await handleIncomingCall(callUUID, handle);
  });

  // Emisor colgó — única forma de terminar la conexión real
  RNCallKeep.addEventListener('endCall', async ({ callUUID }) => {
    console.log('[CallHandler] Emisor colgó:', callUUID);
    await handleCallEnded(callUUID);
  });

  // Audio activo — iniciar tono de fax por 10 segundos
  RNCallKeep.addEventListener('didActivateAudioSession', async () => {
    if (callIsFiltered) {
      await startFaxTones();

      // Detener tono automáticamente a los 10 segundos
      faxTimeout = setTimeout(async () => {
        await stopFaxTones();
        console.log('[CallHandler] 10 segundos cumplidos, tono de fax detenido');
        console.log('[CallHandler] Receptor ahora puede escuchar al emisor');
      }, 10000);
    }
  });

  RNCallKeep.addEventListener('didDeactivateAudioSession', async () => {
    await stopFaxTones();
    if (faxTimeout) {
      clearTimeout(faxTimeout);
      faxTimeout = null;
    }
  });

  // El receptor intenta hacer una llamada — liberar línea si hay filtrada activa
  RNCallKeep.addEventListener('didPerformSetMutedCallAction', async ({ callUUID, muted }) => {
    // Si el receptor intenta marcar, cancelar la llamada filtrada rechazada
    if (activeCallId && rejectedCalls.has(activeCallId)) {
      console.log('[CallHandler] Receptor intenta marcar, liberando línea');
      await forceEndFilteredCall();
    }
  });
}

async function handleIncomingCall(callUUID: string, phoneNumber: string) {
  activeCallId = callUUID;

  if (!appEnabled) {
    callIsFiltered = false;
    RNCallKeep.displayIncomingCall(callUUID, phoneNumber, phoneNumber, 'number', false);
    return;
  }

  const { allowed, reason } = await isNumberWhitelisted(phoneNumber);

  if (allowed) {
    callIsFiltered = false;
    RNCallKeep.displayIncomingCall(callUUID, phoneNumber, phoneNumber, 'number', false);
  } else {
    callIsFiltered = true;
    const displayName =
      reason === 'suspicious_pattern' ? '⚠️ Patrón sospechoso' : 'Número desconocido';

    RNCallKeep.displayIncomingCall(callUUID, phoneNumber, displayName, 'number', false);

    setTimeout(() => {
      RNCallKeep.answerIncomingCall(callUUID);
    }, 1500);
  }
}

async function handleCallEnded(callUUID: string) {
  if (callUUID === activeCallId) {
    if (faxTimeout) {
      clearTimeout(faxTimeout);
      faxTimeout = null;
    }
    await stopFaxTones();
    rejectedCalls.delete(callUUID);
    activeCallId = null;
    callIsFiltered = false;
  }
}

// Receptor pulsa "Aceptar" — cortar tono y conectar normalmente
export async function acceptFilteredCall() {
  if (!activeCallId) return;
  if (faxTimeout) {
    clearTimeout(faxTimeout);
    faxTimeout = null;
  }
  callIsFiltered = false;
  await stopFaxTones();
  console.log('[CallHandler] Llamada aceptada, conectando normalmente');
}

// Receptor pulsa "Rechazar" — pantalla desaparece pero conexión sigue activa con tono
export async function rejectFilteredCall() {
  if (!activeCallId) return;

  // Marcar como rechazada visualmente pero mantener conexión
  rejectedCalls.add(activeCallId);
  callIsFiltered = false;

  // Reiniciar tono de fax indefinidamente hasta que emisor cuelgue
  if (faxTimeout) {
    clearTimeout(faxTimeout);
    faxTimeout = null;
  }
  await stopFaxTones();
  await startFaxTones();

  console.log('[CallHandler] Llamada rechazada visualmente, conexión activa con tono');
}

// Forzar cierre si receptor intenta marcar
async function forceEndFilteredCall() {
  if (!activeCallId) return;
  await stopFaxTones();
  RNCallKeep.endCall(activeCallId);
  rejectedCalls.delete(activeCallId);
  activeCallId = null;
  callIsFiltered = false;
  console.log('[CallHandler] Línea liberada para llamada saliente');
}

export function getActiveCallId() {
  return activeCallId;
}

export function getCallIsFiltered() {
  return callIsFiltered;
}
