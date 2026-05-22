import NetInfo from '@react-native-community/netinfo';

export type CallType = 'GSM' | 'VoIP' | 'unknown';

// Detecta si la llamada es GSM o VoIP basándose en el handle y conexión
export async function detectCallType(handle: string): Promise<CallType> {
  try {
    const netInfo = await NetInfo.fetch();
    
    // Números de teléfono tradicionales son GSM
    // Handles con formato SIP (usuario@dominio) son VoIP
    const isSIPFormat = handle.includes('@');
    const isNumericPhone = /^\+?[\d\s\-\(\)]{7,}$/.test(handle);

    if (isSIPFormat) {
      return 'VoIP';
    }

    if (isNumericPhone) {
      // Si hay conexión a internet activa y el número tiene formato internacional
      // podría ser VoIP, pero asumimos GSM por defecto para números normales
      return 'GSM';
    }

    return 'unknown';
  } catch (err) {
    console.error('[CallTypeDetector] Error:', err);
    return 'unknown';
  }
}

export function getCallTypeLabel(callType: CallType): string {
  switch (callType) {
    case 'GSM': return '📱 Llamada GSM';
    case 'VoIP': return '🌐 Llamada VoIP';
    default: return '📞 Llamada';
  }
}

export function getCallTypeColor(callType: CallType): string {
  switch (callType) {
    case 'GSM': return '#4466ff';
    case 'VoIP': return '#00aaff';
    default: return '#888888';
  }
}
