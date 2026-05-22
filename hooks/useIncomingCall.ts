import { useState, useEffect, useCallback } from 'react';
import RNCallKeep from 'react-native-callkeep';
import {
  setupCallHandler,
  acceptFilteredCall,
  discardFilteredCall,
  startListening,
  getCallIsFiltered,
  getActiveCallType,
} from '../modules/callHandler';
import { CallType } from '../modules/callTypeDetector';

export type CallState = 'idle' | 'incoming' | 'listening' | 'filtered' | 'accepted' | 'ended';

interface IncomingCallInfo {
  callUUID: string;
  phoneNumber: string;
  isSuspicious: boolean;
  callType: CallType;
}

export function useIncomingCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<IncomingCallInfo | null>(null);

  useEffect(() => {
    setupCallHandler();

    RNCallKeep.addEventListener('didReceiveStartCallAction', ({ callUUID, handle }) => {
      const isSuspicious = handle.includes('sospechoso');
      const callType = getActiveCallType();
      setCallInfo({ callUUID, phoneNumber: handle, isSuspicious, callType });
      setCallState('incoming');
    });

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

  // Usuario toma la llamada normalmente
  const handleTakeCall = useCallback(async () => {
    await acceptFilteredCall();
    setCallState('accepted');
  }, []);

  // Usuario elige escuchar y decidir
  const handleListen = useCallback(async () => {
    await startListening();
    setCallState('listening');
  }, []);

  // Usuario acepta después de escuchar
  const handleAcceptAfterListen = useCallback(async () => {
    await acceptFilteredCall();
    setCallState('accepted');
  }, []);

  // Usuario descarta — tonos inmediatos
  const handleDiscard = useCallback(async () => {
    await discardFilteredCall();
    setCallState('filtered');
  }, []);

  return {
    callState,
    callInfo,
    handleTakeCall,
    handleListen,
    handleAcceptAfterListen,
    handleDiscard,
  };
}
