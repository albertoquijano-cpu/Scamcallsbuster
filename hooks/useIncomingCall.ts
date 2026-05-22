import { useState, useEffect, useCallback } from 'react';
import RNCallKeep from 'react-native-callkeep';
import {
  setupCallHandler,
  acceptFilteredCall,
  getCallIsFiltered,
} from '../modules/callHandler';

export type CallState = 'idle' | 'incoming' | 'filtered' | 'accepted' | 'ended';

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
      const isSuspicious = handle.includes('sospechoso');
      setCallInfo({ callUUID, phoneNumber: handle, isFiltered: true, isSuspicious });
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

  const handleAccept = useCallback(async () => {
    await acceptFilteredCall();
    setCallState('accepted');
  }, []);

  return { callState, callInfo, handleAccept };
}
