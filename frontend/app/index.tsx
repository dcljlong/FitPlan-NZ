import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../contexts/UserContext';
import { api } from '../components/api';
import { colors, spacing, radius, typography, shadows } from '../components/theme';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { userName, setUserName, loading: userLoading } = useUser();

  React.useEffect(() => {
    if (!userLoading && userName) {
      router.replace('/(tabs)/projects');
    }
  }, [userLoading, userName]);

  const handleLogin = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.login(trimmed);
      await setUserName(trimmed);
      router.replace('/(tabs)/projects');
    } catch (e: any) {
      setError(e.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1768321916877-8cf4e4ef7487?w=800' }}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoIcon}>▲</Text>
              </View>
              <Text style={styles.appName}>FitPlan NZ</Text>
              <Text style={styles.tagline}>Construction Project Planner</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Get Started</Text>
              <Text style={styles.cardSubtitle}>Enter your name to continue</Text>

              <TextInput
                testID="login-name-input"
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                testID="login-submit-btn"
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.buttonText}>Get Started</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.footer}>Interior Fitout Planning Made Simple</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.secondary },
  bgImage: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    width: '100%', height: '100%',
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.75)',
  },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background,
  },
  logoContainer: { alignItems: 'center', marginBottom: spacing.xl },
  logoBadge: {
    width: 64, height: 64, borderRadius: radius.lg,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoIcon: { fontSize: 28, color: colors.primaryForeground },
  appName: {
    ...typography.h1, color: colors.primaryForeground,
    marginBottom: spacing.xs,
  },
  tagline: { ...typography.body, color: 'rgba(255,255,255,0.7)' },
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, ...shadows.medium,
  },
  cardTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  cardSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  input: {
    height: 52, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontSize: 16, color: colors.textPrimary, backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.red, fontSize: 14, marginBottom: spacing.sm },
  button: {
    height: 52, backgroundColor: colors.primary, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: 17, fontWeight: '700', color: colors.primaryForeground },
  footer: {
    marginTop: spacing.xl, ...typography.caption,
    color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
  },
});
