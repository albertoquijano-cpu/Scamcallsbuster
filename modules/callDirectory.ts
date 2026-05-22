import { NativeModules, Platform } from 'react-native';

const SUITE_NAME = 'group.com.albertoquijano.scamcallsbuster';

interface IdentifiedNumber {
  number: number;
  label: string;
}

// Convierte número de teléfono a formato numérico para CallKit
function phoneToInt(phone: string): number {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return parseInt(cleaned);
}

// Agrega un número a la lista de identificados como sospechoso
export async function addSuspiciousNumber(phoneNumber: string): Promise<void> {
  try {
    if (Platform.OS !== 'ios') return;

    const { SharedStorage } = NativeModules;
    if (!SharedStorage) {
      console.warn('[CallDirectory] SharedStorage no disponible');
      return;
    }

    const existing = await SharedStorage.getItem('scamcalls_identified', SUITE_NAME);
    const numbers: IdentifiedNumber[] = existing ? JSON.parse(existing) : [];

    const num = phoneToInt(phoneNumber);
    if (!isNaN(num) && !numbers.find(n => n.number === num)) {
      numbers.push({ number: num, label: '🚫 ScamCalls Buster — Número sospechoso' });
      numbers.sort((a, b) => a.number - b.number);
      await SharedStorage.setItem('scamcalls_identified', JSON.stringify(numbers), SUITE_NAME);
      console.log('[CallDirectory] Número agregado:', phoneNumber);

      // Recargar la extensión para que tome efecto
      await reloadExtension();
    }
  } catch (err) {
    console.error('[CallDirectory] Error agregando número:', err);
  }
}

// Recarga la extensión Call Directory
export async function reloadExtension(): Promise<void> {
  try {
    if (Platform.OS !== 'ios') return;
    const { CallDirectoryManager } = NativeModules;
    if (CallDirectoryManager) {
      await CallDirectoryManager.reloadExtension();
      console.log('[CallDirectory] Extensión recargada');
    }
  } catch (err) {
    console.error('[CallDirectory] Error recargando extensión:', err);
  }
}

// Limpia todos los números identificados
export async function clearAllNumbers(): Promise<void> {
  try {
    if (Platform.OS !== 'ios') return;
    const { SharedStorage } = NativeModules;
    if (SharedStorage) {
      await SharedStorage.setItem('scamcalls_identified', '[]', SUITE_NAME);
      await reloadExtension();
    }
  } catch (err) {
    console.error('[CallDirectory] Error limpiando números:', err);
  }
}
