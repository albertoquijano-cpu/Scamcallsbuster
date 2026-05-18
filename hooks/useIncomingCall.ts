import { useState, useEffect, useCallback } from 'react';
import RNCallKeep from 'react-native-callkeep';
import {
  setupCallHandler,
  acceptFilteredCall,
  hangupFilteredCall,
  getCallIsFiltered,
} from '../modules/callHandler';

export type CallState = 'idle' | 'filtered' | 'accepted' | 'ended';

interface IncomingCallInfo {
  callUUID: string;
  phoneNumber: string;
  isFiltered: boolean;
  isSuspicious: boolean;
}

export function useIncomingCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<IncomingCallInfo | null>(null);

  useEffect(() => {
    setupCallHandler();

    RNCallKeep.addEventListener('didReceiveStartCallAction', ({ callUUID, handle }) => {
      const isFiltered = getCallIsFiltered();
      const isSuspicious = handle.includes('sospechoso');
      setCallInfo({ callUUID, phoneNumber: handle, isFiltered, isSuspicious });
      setCallState(isFiltered ? 'filtered' : 'idle');
    });

    // Emisor colgó — notificar al receptor sutilmente
    RNCallKeep.addEventListener('endCall', () => {
      setCallState('ended');
      setCallInfo(null);
      setTimeout(() => setCallState('idle'), 2000);
    });

    return () => {
      RNCallKeep.removeEventListener('didReceiveStartCallAction');
      RNCallKeep.removeEventListener('endCall');
    };
  }, []);

  const handleAccept = useCallback(async () => {
    await acceptFilteredCall();
    setCallState('accepted');
  }, []);

  // Colgar visualmente — conexión sigue activa en background con tono de fax
  const handleHangup = useCallback(async () => {
    await hangupFilteredCall();
    setCallState('idle'); // Vuelve a pantalla principal silenciosamente
  }, []);

  return { callState, callInfo, handleAccept, handleHangup };
}
