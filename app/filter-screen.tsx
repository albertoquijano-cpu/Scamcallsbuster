import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIncomingCall, CallState } from '../hooks/useIncomingCall';
import { setAppEnabled, setFaxDelay, getFaxDelay } from '../modules/callHandler';
import BreastplateIcon from '../components/BreastplateIcon';

const FAX_DELAY_KEY = '@scamcalls_fax_delay';

export default function FilterScreen() {
  const { callState, callInfo, handleAccept, handleHangup } = useIncomingCall();
  const [appActive, setAppActive] = useState(true);
  const [faxDelay, setFaxDelayState] = useState<0 | 4 | 8>(4);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const activeState = callState;

  // Cargar delay guardado al iniciar
  useEffect(() => {
    AsyncStorage.getItem(FAX_DELAY_KEY).then(val => {
      if (val !== null) {
        const parsed = parseInt(val) as 0 | 4 | 8;
        setFaxDelayState(parsed);
        setFaxDelay(parsed);
      }
    });
  }, []);

  useEffect(() => {
    if (activeState === 'filtered') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [activeState]);

  const toggleApp = (value: boolean) => {
    setAppActive(value);
    setAppEnabled(value);
  };

  const handleDelayChange = async (delay: 0 | 4 | 8) => {
    setFaxDelayState(delay);
    setFaxDelay(delay);
    await AsyncStorage.setItem(FAX_DELAY_KEY, delay.toString());
  };

  const testAccept = async () => {
    await handleAccept();
  };

  const testHangup = async () => {
    await handleHangup();
  };

  if (activeState === 'idle') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.idleContainer}>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {appActive ? 'Protección activa' : 'Protección desactivada'}
            </Text>
            <Switch
              value={appActive}
              onValueChange={toggleApp}
              trackColor={{ false: '#333333', true: '#00cc66' }}
              thumbColor='#ffffff'
            />
          </View>

          <View style={styles.idleIcon}>
            <BreastplateIcon size={90} active={appActive} />
          </View>
          <Text style={styles.idleTitle}>
            {appActive ? 'ScamCalls Buster activo' : 'ScamCalls Buster inactivo'}
          </Text>
          <Text style={styles.idleSubtitle}>
            {appActive
              ? 'Las llamadas de números desconocidos serán bloqueadas automáticamente'
              : 'Todas las llamadas entrarán normalmente sin filtro'}
          </Text>

          {/* Selector de tiempo de espera antes de activar sonidos de fax */}
          <View style={styles.delaySection}>
            <Text style={styles.delayLabel}>Espera antes de activar sonido de fax</Text>
            <View style={styles.delayPicker}>
              {([0, 4, 8] as const).map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[styles.delayOption, faxDelay === sec && styles.delayOptionActive]}
                  onPress={() => handleDelayChange(sec)}
                >
                  <Text style={[styles.delayOptionText, faxDelay === sec && styles.delayOptionTextActive]}>
                    {sec === 0 ? 'Inmediato' : `${sec} seg`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

</View>
      </SafeAreaView>
    );
  }

  if (activeState === 'filtered') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.filteredContainer}>

          <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.filterIcon}>
              {callInfo?.isSuspicious ? '⚠️' : '🔇'}
            </Text>
          </Animated.View>

          <Text style={styles.filteredTitle}>Número desconocido</Text>
          <Text style={styles.phoneNumber}>
            {callInfo?.phoneNumber ?? '+00 000 000 0000'}
          </Text>

          {callInfo?.isSuspicious && (
            <View style={styles.suspiciousBox}>
              <Text style={styles.suspiciousText}>
                ⚠️ Este número ha llamado repetidamente en horarios similares
              </Text>
            </View>
          )}

          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>🚫 Bloqueo en acción</Text>
            <Text style={styles.alertText}>
              Quien llama no puede oír lo que digas, pero tú sí puedes oír lo que él diga para que decidas si tomas la llamada o no.
            </Text>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.hangupButton}
              onPress={testHangup}
              activeOpacity={0.8}
            >
              <Text style={styles.hangupButtonText}>✕  Colgar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={testAccept}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptButtonText}>✓  Aceptar llamada</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    );
  }

  if (activeState === 'accepted') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.idleContainer}>
          <Text style={styles.idleIcon}>✅</Text>
          <Text style={styles.idleTitle}>Llamada conectada</Text>
          <Text style={styles.idleSubtitle}>El bloqueo fue desactivado</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (activeState === 'ended') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.idleContainer}>
          <Text style={styles.idleIcon}>📵</Text>
          <Text style={styles.idleTitle}>Llamada terminada</Text>
          <Text style={styles.idleSubtitle}>El emisor colgó</Text>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  idleContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  switchRow: {
    position: 'absolute',
    top: 20,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabel: { fontSize: 13, color: '#888888' },
  idleIcon: { marginBottom: 20 },
  idleTitle: { fontSize: 24, fontWeight: '600', color: '#ffffff', marginBottom: 12, textAlign: 'center' },
  idleSubtitle: { fontSize: 15, color: '#888888', textAlign: 'center', lineHeight: 22 },
  delaySection: {
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
  },
  delayLabel: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 12,
    textAlign: 'center',
  },
  delayPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  delayOption: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#1a1a1a',
  },
  delayOptionActive: {
    borderColor: '#00cc66',
    backgroundColor: '#003a1a',
  },
  delayOptionText: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '500',
  },
  delayOptionTextActive: {
    color: '#00cc66',
  },
  filteredContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  iconWrapper: { marginBottom: 16 },
  filterIcon: { fontSize: 72 },
  filteredTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 6 },
  phoneNumber: { fontSize: 20, fontWeight: '500', color: '#f0a500', marginBottom: 20 },
  suspiciousBox: {
    backgroundColor: '#2a1500',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0a500',
  },
  suspiciousText: { fontSize: 13, color: '#f0a500', textAlign: 'center' },
  alertBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 18,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: '#333333',
  },
  alertTitle: { fontSize: 16, fontWeight: '700', color: '#ff4444', marginBottom: 8, textAlign: 'center' },
  alertText: { fontSize: 14, color: '#cccccc', textAlign: 'center', lineHeight: 21 },
  buttonsContainer: { width: '100%', gap: 12 },
  hangupButton: { backgroundColor: '#2a0000', borderWidth: 1, borderColor: '#ff4444', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  hangupButtonText: { color: '#ff4444', fontSize: 17, fontWeight: '600' },
  acceptButton: { backgroundColor: '#003a1a', borderWidth: 1, borderColor: '#00cc66', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  acceptButtonText: { color: '#00cc66', fontSize: 17, fontWeight: '600' },
});
