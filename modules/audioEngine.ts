import { Audio } from 'expo-av';

let soundObject: Audio.Sound | null = null;
let isPlaying = false;

export async function setupAudioSession() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

function randomToneParams() {
  return {
    frequency: 800 + Math.floor(Math.random() * 600),
    pulseDuration: 0.3 + Math.random() * 0.5,
    silenceDuration: 1.0 + Math.random() * 3.0,
    volume: 0.7 + Math.random() * 0.3,
  };
}

export async function startFaxTones() {
  if (isPlaying) return;
  try {
    await setupAudioSession();
    isPlaying = true;
    await playNextTone();
  } catch (err) {
    console.error('[AudioEngine] Error iniciando tono:', err);
  }
}

async function playNextTone() {
  if (!isPlaying) return;
  try {
    const params = randomToneParams();
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/fax-tone.wav'),
      { isLooping: false, volume: params.volume }
    );
    soundObject = sound;
    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (!isPlaying) return;
      if (status.isLoaded && status.didJustFinish) {
        await sound.unloadAsync();
        setTimeout(() => playNextTone(), params.silenceDuration * 1000);
      }
    });
    await sound.playAsync();
  } catch (err) {
    console.error('[AudioEngine] Error reproduciendo tono:', err);
  }
}

export async function stopFaxTones() {
  isPlaying = false;
  if (soundObject) {
    try {
      await soundObject.stopAsync();
      await soundObject.unloadAsync();
      soundObject = null;
    } catch (err) {
      console.error('[AudioEngine] Error deteniendo tono:', err);
    }
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: true,
  });
}

export function isAudioPlaying() {
  return isPlaying;
}
