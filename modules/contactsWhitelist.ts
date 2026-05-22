import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'scamcalls:whitelist';
const ATTEMPTS_KEY = 'scamcalls:attempts';
const CACHE_TTL = 1000 * 60 * 5; // Reducido a 5 minutos para pruebas

interface WhitelistCache {
  numbers: string[];
  timestamp: number;
}

interface CallAttempt {
  timestamps: number[];
}

function normalizeNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '');
}

function isSuspiciousPattern(attempts: CallAttempt): boolean {
  if (attempts.timestamps.length < 4) return false;
  const now = Date.now();
  const twoDaysAgo = now - 1000 * 60 * 60 * 48;
  const recent = attempts.timestamps.filter(t => t > twoDaysAgo);
  if (recent.length < 4) return false;
  const hours = recent.map(t => new Date(t).getHours());
  const baseHour = hours[0];
  const similarHours = hours.filter(h => Math.abs(h - baseHour) <= 1);
  return similarHours.length >= 3;
}

export async function loadWhitelist(): Promise<string[]> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: WhitelistCache = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        console.log('[Whitelist] Usando caché:', parsed.numbers.length, 'números');
        return parsed.numbers;
      }
    }
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return [];
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });
    const numbers: string[] = [];
    for (const contact of data) {
      if (contact.phoneNumbers) {
        for (const phone of contact.phoneNumbers) {
          if (phone.number) numbers.push(normalizeNumber(phone.number));
        }
      }
    }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ numbers, timestamp: Date.now() }));
    console.log('[Whitelist] Contactos cargados:', numbers.length);
    return numbers;
  } catch (err) {
    console.error('[Whitelist] Error:', err);
    return [];
  }
}

async function registerCallAttempt(number: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
    const attempts: Record<string, CallAttempt> = raw ? JSON.parse(raw) : {};
    const current = attempts[number] || { timestamps: [] };
    const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
    current.timestamps = current.timestamps.filter(t => t > sevenDaysAgo);
    current.timestamps.push(Date.now());
    attempts[number] = current;
    await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    return isSuspiciousPattern(current);
  } catch (err) {
    return false;
  }
}

export async function isNumberWhitelisted(incomingNumber: string): Promise<{
  allowed: boolean;
  reason: string;
}> {
  const normalized = normalizeNumber(incomingNumber);
  console.log('[Whitelist] Verificando número:', normalized);
  const whitelist = await loadWhitelist();
  const last8 = normalized.slice(-8);
  const isKnown = whitelist.some(n => n.endsWith(last8));
  console.log('[Whitelist] Número conocido:', isKnown);
  if (isKnown) return { allowed: true, reason: 'whitelisted' };
  const suspicious = await registerCallAttempt(normalized);
  return { allowed: false, reason: suspicious ? 'suspicious_pattern' : 'unknown' };
}

export async function invalidateCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
  console.log('[Whitelist] Caché invalidado');
}
