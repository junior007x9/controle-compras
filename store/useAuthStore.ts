import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store'; // 🔥 O COFRE FOI ATIVADO
import { auth } from '../firebaseConfig'; 
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Alert } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: '983322953388-1mb5pquf9oimaga5mr85juk4j8sf1an7.apps.googleusercontent.com',
});

// 🔥 ADAPTADOR DO COFRE PARA O ZUSTAND
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await SecureStore.getItemAsync(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.removeItemAsync(name);
  },
};

export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  foto: string;
}

interface AuthState {
  usuario: UserProfile | null;
  familiaId: string | null;
  setUsuario: (user: UserProfile | null) => void;
  setFamiliaId: (id: string) => void;
  gerarNovaFamilia: () => void;
  sairDaFamilia: () => void;
  fazerLogout: () => void;
  entrarOuRegistar: (email: string, senha: string) => Promise<void>;
  entrarComGoogle: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      familiaId: null,
      
      setUsuario: (user) => set({ usuario: user }),
      setFamiliaId: (id) => set({ familiaId: id.toUpperCase() }),
      
      gerarNovaFamilia: () => {
        const novoCodigo = Math.random().toString(36).substring(2, 8).toUpperCase();
        set({ familiaId: novoCodigo });
      },
      
      sairDaFamilia: () => set({ familiaId: null }),

      fazerLogout: async () => {
        try {
          await firebaseSignOut(auth);
          await GoogleSignin.signOut(); 
          set({ usuario: null, familiaId: null });
        } catch (error) {}
      },

      entrarOuRegistar: async (email, senha) => {
        if (!email || !senha || senha.length < 6) {
          Alert.alert("Aviso", "Preencha um e-mail válido e uma senha com pelo menos 6 caracteres.");
          return;
        }

        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, senha);
          const user = userCredential.user;
          
          set({ 
            usuario: { 
              uid: user.uid, 
              nome: user.email?.split('@')[0] || 'Utilizador', 
              email: user.email || '', 
              foto: `https://ui-avatars.com/api/?name=${user.email || 'U'}&background=random` 
            } 
          });
        } catch (error: any) {
          if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
              const newUserCredential = await createUserWithEmailAndPassword(auth, email, senha);
              const newUser = newUserCredential.user;
              
              set({ 
                usuario: { 
                  uid: newUser.uid, 
                  nome: newUser.email?.split('@')[0] || 'Novo Utilizador', 
                  email: newUser.email || '', 
                  foto: `https://ui-avatars.com/api/?name=${newUser.email || 'U'}&background=random` 
                } 
              });
            } catch (createError: any) {
              if (createError.code === 'auth/email-already-in-use') {
                Alert.alert("E-mail Google", "Este e-mail já pertence a uma conta Google. Por favor, clique no botão 'Entrar com o Google' abaixo.");
              } else {
                Alert.alert("Erro ao criar conta", createError.message);
              }
            }
          } else {
            Alert.alert("Erro de Autenticação", error.message);
          }
        }
      },

      entrarComGoogle: async () => {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();
          
          let idToken = null;
          if (response && response.data && response.data.idToken) {
             idToken = response.data.idToken;
          } else if (response && (response as any).idToken) {
             idToken = (response as any).idToken;
          }

          if (!idToken) {
            Alert.alert("Erro Técnico", "O Google autorizou, mas não devolveu a chave de segurança (Token).");
            return;
          }

          const googleCredential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, googleCredential);
          const user = userCredential.user;

          set({
            usuario: {
              uid: user.uid,
              nome: user.displayName || user.email?.split('@')[0] || 'Utilizador Google',
              email: user.email || '',
              foto: user.photoURL || `https://ui-avatars.com/api/?name=${user.email || 'G'}&background=random`
            }
          });
        } catch (error: any) {
          console.log(error);
          Alert.alert("Erro do Google (Tire um Print!)", `Código: ${error.code || 'Desconhecido'}\nMensagem: ${error.message || error}`);
        }
      }

    }),
    {
      name: 'auth-storage',
      // 🔥 AQUI DEFINIMOS QUE ELE DEVE USAR O COFRE NOVO
      storage: createJSONStorage(() => secureStorage), 
    }
  )
);