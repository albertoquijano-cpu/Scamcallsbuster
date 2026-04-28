import { useState, useEffect, useCallback } from 'react';
import RNCallKeep from 'react-native-callkeep';
import {
  setupCallHandler,
  acceptFilteredCall,
  rejectFilteredCall,
  getCallIsFiltered,
} from '../modules/callHandler';

export type CallState = 'idle' | 'filtered' | 'accepted' | 'ended';

interface IncomingCallInfo {
  callUUID: string;
  phoneNumber: string;
  isFiltered: boolean;
}

export function useIncomingCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<IncomingCallInfo | null>(null);

  useEffect(() => {
    setupCallHandler();

    RNCallKeep.addEventListener('didReceiveStartCallAction', ({ callUUID, handle }) => {
      const isFiltered = getCallIsFiltered();
      setCallInfo({ callUUID, phoneNumber: handle, isFiltered });
      setCallState(isFiltered ? 'filtered' : 'idle');
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

  const handleReject = useCallback(async () => {
    await rejectFilteredCall();
    setCallState('ended');
    setCallInfo(null);
    setTimeout(() => setCallState('idle'), 2000);
  }, []);

  return { callState, callInfo, handleAccept, handleReject };
}
