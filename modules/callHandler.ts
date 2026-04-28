import RNCallKeep from 'react-native-callkeep';
import { isNumberWhitelisted } from './contactsWhitelist';
import { startFaxTones, stopFaxTones } from './audioEngine';

let activeCallId: string | null = null;
let callIsFiltered = false;
let appEnabled = true;

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
    await handleIncomingCall(callUUID, handle);
  });

  RNCallKeep.addEventListener('endCall', async ({ callUUID }) => {
    await handleCallEnded(callUUID);
  });

  RNCallKeep.addEventListener('didActivateAudioSession', async () => {
    if (callIsFiltered) await startFaxTones();
  });

  RNCallKeep.addEventListener('didDeactivateAudioSession', async () => {
    await stopFaxTones();
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
    RNCallKeep.displayIncomingCall(
      callUUID,
      phoneNumber,
      reason === 'blocked' ? 'Número bloqueado' :
      reason === 'suspicious_hour' ? 'Hora sospechosa' :
      'Número desconocido',
      'number',
      false
    );
    setTimeout(() => {
      RNCallKeep.answerIncomingCall(callUUID);
    }, 1500);
  }
}

async function handleCallEnded(callUUID: string) {
  if (callUUID === activeCallId) {
    await stopFaxTones();
    activeCallId = null;
    callIsFiltered = false;
  }
}

export async function acceptFilteredCall() {
  if (!activeCallId) return;
  callIsFiltered = false;
  await stopFaxTones();
}

export async function rejectFilteredCall() {
  if (!activeCallId) return;
  await stopFaxTones();
  RNCallKeep.endCall(activeCallId);
  activeCallId = null;
  callIsFiltered = false;
}

export function getActiveCallId() {
  return activeCallId;
}

export function getCallIsFiltered() {
  return callIsFiltered;
}
