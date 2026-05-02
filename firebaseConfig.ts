import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCjT4dpAsHbwrK8YJteBXx_0e-oIi8knz8",
  authDomain: "dehouse-market.firebaseapp.com",
  projectId: "dehouse-market",
  storageBucket: "dehouse-market.firebasestorage.app",
  messagingSenderId: "983322953388",
  appId: "1:983322953388:android:073ff2ce5644442e6ac109",
};

// Inicia a App
const app = initializeApp(firebaseConfig);

// Inicia o Auth garantindo que o utilizador não perde o login
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export { auth };

