import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'scamcalls:whitelist';
const BLOCKED_KEY = 'scamcalls:blocked';
const ATTEMPTS_KEY = 'scamcalls:attempts';
const CACHE_TTL = 1000 * 60 * 60;
const MAX_ATTEMPTS = 3;

interface WhitelistCache {
  numbers: string[];
  timestamp: number;
}

interface CallAttempt {
  count: number;
  lastCall: number;
}

function normalizeNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '');
}

function isSuspiciousHour(): boolean {
  const hour = new Date().getHours();
  return hour < 7 || hour >= 21;
}

export async function loadWhitelist(): Promise<string[]> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: WhitelistCache = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
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
    const current = attempts[number] || { count: 0, lastCall: Date.now() };
    const hoursSince = (Date.now() - current.lastCall) / (1000 * 60 * 60);
    if (hoursSince > 24) current.count = 0;
    current.count += 1;
    current.lastCall = Date.now();
    attempts[number] = current;
    await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    if (current.count >= MAX_ATTEMPTS) {
      await blockNumber(number);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

export async function blockNumber(number: string): Promise<void> {
  const raw = await AsyncStorage.getItem(BLOCKED_KEY);
  const blocked: string[] = raw ? JSON.parse(raw) : [];
  const normalized = normalizeNumber(number);
  if (!blocked.includes(normalized)) {
    blocked.push(normalized);
    await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(blocked));
  }
}

export async function isNumberBlocked(number: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(BLOCKED_KEY);
  const blocked: string[] = raw ? JSON.parse(raw) : [];
  const last8 = normalizeNumber(number).slice(-8);
  return blocked.some(n => n.endsWith(last8));
}

export async function isNumberWhitelisted(incomingNumber: string): Promise<{
  allowed: boolean;
  reason: string;
}> {
  const normalized = normalizeNumber(incomingNumber);
  const blocked = await isNumberBlocked(normalized);
  if (blocked) return { allowed: false, reason: 'blocked' };
  const whitelist = await loadWhitelist();
  const last8 = normalized.slice(-8);
  const isKnown = whitelist.some(n => n.endsWith(last8));
  if (isKnown && isSuspiciousHour()) return { allowed: false, reason: 'suspicious_hour' };
  if (isKnown) return { allowed: true, reason: 'whitelisted' };
  await registerCallAttempt(normalized);
  return { allowed: false, reason: 'unknown' };
}

export async function invalidateCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}

export async function getBlockedNumbers(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(BLOCKED_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function unblockNumber(number: string): Promise<void> {
  const raw = await AsyncStorage.getItem(BLOCKED_KEY);
  const blocked: string[] = raw ? JSON.parse(raw) : [];
  const normalized = normalizeNumber(number);
  const filtered = blocked.filter(n => !n.endsWith(normalized.slice(-8)));
  await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(filtered));
}
