import React, { useEffect } from 'react';
import { StatusBar, Alert } from 'react-native';
import * as Contacts from 'expo-contacts';
import FilterScreen from './app/filter-screen';
import { setupCallHandler } from './modules/callHandler';
import { loadWhitelist } from './modules/contactsWhitelist';

export default function App() {
  useEffect(() => {
    async function initialize() {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permisos necesarios',
            'ScamCalls Buster necesita acceso a tus contactos para filtrar llamadas desconocidas.',
            [{ text: 'Entendido' }]
          );
          return;
        }
        await loadWhitelist();
        await setupCallHandler();
        console.log('[App] ScamCalls Buster inicializado correctamente');
      } catch (err) {
        console.error('[App] Error en inicialización:', err);
      }
    }
    initialize();
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <FilterScreen />
    </>
  );
}
