import { useState, useEffect, useCallback } from 'react';
import RNCallKeep from 'react-native-callkeep';
import {
  setupCallHandler,
  acceptFilteredCall,
  discardFilteredCall,
  getCallIsFiltered,
} from '../modules/callHandler';

export type CallState = 'idle' | 'incoming' | 'listening' | 'filtered' | 'accepted' | 'ended';

interface IncomingCallInfo {
  callUUID: string;
  phoneNumber: string;
  isSuspicious: boolean;
}

export function useIncomingCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<IncomingCallInfo | null>(null);

  useEffect(() => {
    setupCallHandler();

    RNCallKeep.addEventListener('didReceiveStartCallAction', ({ callUUID, handle }) => {
      const isSuspicious = handle.includes('sospechoso');
      setCallInfo({ callUUID, phoneNumber: handle, isSuspicious });
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

  // Usuario quiere escuchar antes de decidir
  const handleListen = useCallback(() => {
    setCallState('listening');
  }, []);

  // Usuario acepta después de escuchar
  const handleAcceptAfterListen = useCallback(async () => {
    await acceptFilteredCall();
    setCallState('accepted');
  }, []);

  // Usuario descarta — empiezan los tonos
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
