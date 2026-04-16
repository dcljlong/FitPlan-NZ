import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserContextType = {
  userName: string | null;
  region: string;
  saturdayDefault: boolean;
  setUserName: (name: string | null) => Promise<void>;
  setRegion: (region: string) => Promise<void>;
  setSaturdayDefault: (val: boolean) => Promise<void>;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  userName: null,
  region: 'AUK',
  saturdayDefault: false,
  setUserName: async () => {},
  setRegion: async () => {},
  setSaturdayDefault: async () => {},
  loading: true,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserNameState] = useState<string | null>(null);
  const [region, setRegionState] = useState('AUK');
  const [saturdayDefault, setSaturdayDefaultState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const name = await AsyncStorage.getItem('userName');
        const reg = await AsyncStorage.getItem('region');
        const sat = await AsyncStorage.getItem('saturdayDefault');
        if (name) setUserNameState(name);
        if (reg) setRegionState(reg);
        if (sat) setSaturdayDefaultState(sat === 'true');
      } catch (e) {
        // ignore
      }
      setLoading(false);
    })();
  }, []);

  const setUserName = async (name: string | null) => {
    if (name) {
      await AsyncStorage.setItem('userName', name);
    } else {
      await AsyncStorage.removeItem('userName');
    }
    setUserNameState(name);
  };

  const setRegion = async (r: string) => {
    await AsyncStorage.setItem('region', r);
    setRegionState(r);
  };

  const setSaturdayDefault = async (val: boolean) => {
    await AsyncStorage.setItem('saturdayDefault', val.toString());
    setSaturdayDefaultState(val);
  };

  return (
    <UserContext.Provider value={{ userName, region, saturdayDefault, setUserName, setRegion, setSaturdayDefault, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
