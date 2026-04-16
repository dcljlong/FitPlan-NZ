import { Stack } from 'expo-router';
import { UserProvider } from '../contexts/UserContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <UserProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="project/create" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="task/[id]" options={{ headerShown: false }} />
      </Stack>
    </UserProvider>
  );
}
