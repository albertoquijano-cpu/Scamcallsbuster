import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useIncomingCall, CallState } from '../hooks/useIncomingCall';
import { setAppEnabled, setSilenceSeconds, listenAndDecide } from '../modules/callHandler';

export default function FilterScreen() {
  const {
    callState,
    callInfo,
    handleTakeCall,
    handleListen,
    handleAcceptAfterListen,
    handleDiscard,
  } = useIncomingCall();

  const [appActive, setAppActive] = useState(true);
  const [testState, setTestState] = useState<CallState>('idle');
  const [silenceInput, setSilenceInput] = useState('7');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(1)).current;

  const activeState = callState !== 'idle' ? callState : testState;

  useEffect(() => {
    if (activeState === 'incoming') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      ringAnim.stopAnimation();
      ringAnim.setValue(1);
    }

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

  const handleSilenceChange = (value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    setSilenceInput(clean);
    const num = parseInt(clean);
    if (!isNaN(num) && num > 0 && num <= 60) {
      setSilenceSeconds(num);
    }
  };

  // Simulaciones para pruebas
  const simulateIncoming = () => setTestState('incoming');
  const simListen = () => setTestState('listening');
  const simAccept = async () => { await handleTakeCall(); setTestState('accepted'); setTimeout(() => setTestState('idle'), 2000); };
  const simDiscard = async () => { await handleDiscard(); setTestState('filtered'); };
  const simAcceptAfter = async () => { await handleAcceptAfterListen(); setTestState('accepted'); setTimeout(() => setTestState('idle'), 2000); };

  // PANTALLA IDLE
  if (activeState === 'idle') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

            <Image source={require('../assets/icon.png')} style={styles.appIcon} resizeMode='cover' />
            <Text style={styles.idleTitle}>
              {appActive ? 'ScamCalls Buster activo' : 'ScamCalls Buster inactivo'}
            </Text>
            <Text style={styles.idleSubtitle}>
              {appActive
                ? 'Las llamadas de números desconocidos serán interceptadas automáticamente'
                : 'Todas las llamadas entrarán normalmente sin filtro'}
            </Text>

            {appActive && (
              <View style={styles.silenceBox}>
                <Text style={styles.silenceLabel}>
                  Segundos de escucha antes de activar bloqueo
                </Text>
                <View style={styles.silenceInputRow}>
                  <TextInput
                    style={styles.silenceInput}
                    value={silenceInput}
                    onChangeText={handleSilenceChange}
                    keyboardType='number-pad'
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text style={styles.silenceUnit}>seg</Text>
                </View>
                <Text style={styles.silenceHint}>Mínimo 1 seg — máximo 60 seg</Text>
              </View>
            )}

            <TouchableOpacity style={styles.testButton} onPress={simulateIncoming}>
              <Text style={styles.testButtonText}>🧪  Simular llamada sospechosa</Text>
            </TouchableOpacity>

          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  // PANTALLA INCOMING — primera alerta
  if (activeState === 'incoming') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.incomingContainer}>

          <Animated.Image
            source={require('../assets/icon.png')}
            style={[styles.incomingIcon, { transform: [{ scale: ringAnim }] }]}
            resizeMode='cover'
          />

          <Text style={styles.incomingTitle}>Llamada sospechosa</Text>
          <Text style={styles.incomingNumber}>
            {callInfo?.phoneNumber ?? '+00 000 000 0000'}
          </Text>
          <Text style={styles.incomingSubtitle}>
            Este número no está en tus contactos
          </Text>

          <View style={styles.incomingButtons}>
            <TouchableOpacity style={styles.takeButton} onPress={simAccept} activeOpacity={0.8}>
              <Text style={styles.takeButtonText}>📞  Tomar llamada</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.listenButton} onPress={simListen} activeOpacity={0.8}>
              <Text style={styles.listenButtonText}>👂  Escuchar y decidir</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    );
  }

  // PANTALLA LISTENING — silencio X seg, usuario escucha
  if (activeState === 'listening') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.listeningContainer}>

          <Text style={styles.listeningIcon}>👂</Text>
          <Text style={styles.listeningTitle}>Escuchando...</Text>
          <Text style={styles.listeningNumber}>
            {callInfo?.phoneNumber ?? '+00 000 000 0000'}
          </Text>
          <Text style={styles.listeningSubtitle}>
            Quien llama no puede oírte.{'\n'}Escucha y decide.
          </Text>

          <View style={styles.listeningButtons}>
            <TouchableOpacity style={styles.acceptButton} onPress={simAcceptAfter} activeOpacity={0.8}>
              <Text style={styles.acceptButtonText}>✓  Aceptar llamada</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.discardButton} onPress={simDiscard} activeOpacity={0.8}>
              <Text style={styles.discardButtonText}>🔇  Descartar electrónicamente</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    );
  }

  // PANTALLA FILTERED — tonos activos
  if (activeState === 'filtered') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.filteredContainer}>

          <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.filterIcon}>🔇</Text>
          </Animated.View>

          <Text style={styles.filteredTitle}>Bloqueo activo</Text>
          <Text style={styles.phoneNumber}>
            {callInfo?.phoneNumber ?? '+00 000 000 0000'}
          </Text>

          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>🚫 Bloqueo en acción</Text>
            <Text style={styles.alertText}>
              Quien llama no puede oír lo que digas, pero tú sí puedes oír lo que él diga para que decidas si tomas la llamada o no.
            </Text>
          </View>

          <Text style={styles.tonesNote}>
            La conexión se cortará automáticamente en 20 segundos
          </Text>

        </View>
      </SafeAreaView>
    );
  }

  // PANTALLA ACCEPTED
  if (activeState === 'accepted') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.idleContainer}>
          <Text style={styles.resultIcon}>✅</Text>
          <Text style={styles.idleTitle}>Llamada conectada</Text>
          <Text style={styles.idleSubtitle}>Hablando normalmente</Text>
        </View>
      </SafeAreaView>
    );
  }

  // PANTALLA ENDED
  if (activeState === 'ended') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.idleContainer}>
          <Text style={styles.resultIcon}>📵</Text>
          <Text style={styles.idleSubtitle}>El emisor desconectó la llamada</Text>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  idleContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  switchRow: { position: 'absolute', top: 20, right: 24, flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 13, color: '#888888' },
  appIcon: { width: 100, height: 100, borderRadius: 22, marginBottom: 20 },
  idleTitle: { fontSize: 24, fontWeight: '600', color: '#ffffff', marginBottom: 12, textAlign: 'center' },
  idleSubtitle: { fontSize: 15, color: '#888888', textAlign: 'center', lineHeight: 22 },
  resultIcon: { fontSize: 64, marginBottom: 20 },
  silenceBox: { marginTop: 32, backgroundColor: '#1a1a1a', borderRadius: 14, padding: 18, width: '100%', borderWidth: 1, borderColor: '#333333', alignItems: 'center' },
  silenceLabel: { fontSize: 13, color: '#aaaaaa', textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  silenceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  silenceInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#00cc66', borderRadius: 10, color: '#00cc66', fontSize: 28, fontWeight: '700', textAlign: 'center', width: 70, paddingVertical: 8 },
  silenceUnit: { fontSize: 16, color: '#888888' },
  silenceHint: { fontSize: 11, color: '#555555', marginTop: 8 },
  testButton: { marginTop: 32, borderWidth: 1, borderColor: '#444444', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  testButtonText: { color: '#888888', fontSize: 14 },
  incomingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  incomingIcon: { width: 110, height: 110, borderRadius: 24, marginBottom: 24 },
  incomingTitle: { fontSize: 26, fontWeight: '700', color: '#ff4444', marginBottom: 8, textAlign: 'center' },
  incomingNumber: { fontSize: 20, fontWeight: '500', color: '#f0a500', marginBottom: 8 },
  incomingSubtitle: { fontSize: 14, color: '#888888', marginBottom: 40, textAlign: 'center' },
  incomingButtons: { width: '100%', gap: 14 },
  takeButton: { backgroundColor: '#003a1a', borderWidth: 1, borderColor: '#00cc66', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  takeButtonText: { color: '#00cc66', fontSize: 17, fontWeight: '600' },
  listenButton: { backgroundColor: '#1a1a2a', borderWidth: 1, borderColor: '#4466ff', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  listenButtonText: { color: '#4466ff', fontSize: 17, fontWeight: '600' },
  listeningContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  listeningIcon: { fontSize: 72, marginBottom: 16 },
  listeningTitle: { fontSize: 28, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  listeningNumber: { fontSize: 18, fontWeight: '500', color: '#f0a500', marginBottom: 12 },
  listeningSubtitle: { fontSize: 14, color: '#888888', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  listeningButtons: { width: '100%', gap: 14 },
  acceptButton: { backgroundColor: '#003a1a', borderWidth: 1, borderColor: '#00cc66', borderRadius: 14, paddingVertical: 16, alignItems: 'center', width: '100%' },
  acceptButtonText: { color: '#00cc66', fontSize: 17, fontWeight: '600' },
  discardButton: { backgroundColor: '#2a0000', borderWidth: 1, borderColor: '#ff4444', borderRadius: 14, paddingVertical: 16, alignItems: 'center', width: '100%' },
  discardButtonText: { color: '#ff4444', fontSize: 17, fontWeight: '600' },
  filteredContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  iconWrapper: { marginBottom: 16 },
  filterIcon: { fontSize: 72 },
  filteredTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 6 },
  phoneNumber: { fontSize: 20, fontWeight: '500', color: '#f0a500', marginBottom: 20 },
  alertBox: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#333333' },
  alertTitle: { fontSize: 16, fontWeight: '700', color: '#ff4444', marginBottom: 8, textAlign: 'center' },
  alertText: { fontSize: 14, color: '#cccccc', textAlign: 'center', lineHeight: 21 },
  tonesNote: { fontSize: 12, color: '#555555', textAlign: 'center' },
});
