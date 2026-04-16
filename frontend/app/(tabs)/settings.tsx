import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../../components/theme';
import { api } from '../../components/api';
import { useUser } from '../../contexts/UserContext';

export default function SettingsScreen() {
  const { userName, region, saturdayDefault, setUserName, setRegion, setSaturdayDefault } = useUser();
  const [regions, setRegions] = useState<any[]>([]);
  const [showRegions, setShowRegions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api.getRegions().then(setRegions).catch(console.error);
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await setUserName(null);
          router.replace('/');
        },
      },
    ]);
  };

  const regionName = regions.find(r => r.code === region)?.name || region;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROFILE</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitials}>
                  {userName?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{userName}</Text>
                <Text style={styles.profileLabel}>Logged in as</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCATION</Text>
          <TouchableOpacity
            testID="region-selector-btn"
            style={styles.card}
            onPress={() => setShowRegions(!showRegions)}
            activeOpacity={0.7}
          >
            <View style={styles.settingRow}>
              <Feather name="map-pin" size={20} color={colors.primary} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>NZ Region</Text>
                <Text style={styles.settingValue}>{regionName}</Text>
              </View>
              <Feather name={showRegions ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
          {showRegions && (
            <View style={styles.regionList}>
              {regions.map(r => (
                <TouchableOpacity
                  testID={`region-option-${r.code}`}
                  key={r.code}
                  style={[styles.regionItem, r.code === region && styles.regionItemActive]}
                  onPress={() => { setRegion(r.code); setShowRegions(false); }}
                >
                  <Text style={[styles.regionText, r.code === region && styles.regionTextActive]}>
                    {r.name}
                  </Text>
                  {r.code === region && <Feather name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WORK SCHEDULE DEFAULTS</Text>
          <View style={styles.card}>
            <View style={styles.scheduleRow}>
              <Text style={styles.dayLabel}>Mon – Thu</Text>
              <Text style={styles.dayHours}>9 hours</Text>
            </View>
            <View style={[styles.scheduleRow, styles.scheduleRowBorder]}>
              <Text style={styles.dayLabel}>Friday</Text>
              <Text style={styles.dayHours}>8 hours</Text>
            </View>
            <View style={[styles.scheduleRow, styles.scheduleRowBorder]}>
              <Text style={styles.dayLabel}>Saturday</Text>
              <TouchableOpacity
                testID="saturday-toggle-btn"
                style={[styles.toggle, saturdayDefault && styles.toggleActive]}
                onPress={() => setSaturdayDefault(!saturdayDefault)}
              >
                <View style={[styles.toggleKnob, saturdayDefault && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
            {saturdayDefault && (
              <View style={[styles.scheduleRow, styles.scheduleRowBorder]}>
                <Text style={styles.dayLabel}>Saturday Hours</Text>
                <Text style={styles.dayHours}>6 hours</Text>
              </View>
            )}
            <View style={[styles.scheduleRow, styles.scheduleRowBorder]}>
              <Text style={styles.dayLabel}>Sunday</Text>
              <Text style={[styles.dayHours, { color: colors.red }]}>Off</Text>
            </View>
          </View>
          <Text style={styles.scheduleNote}>
            Standard week: {saturdayDefault ? '50' : '44'} hours. Public holidays automatically excluded.
          </Text>
        </View>

        <TouchableOpacity
          testID="logout-btn"
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={20} color={colors.red} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    paddingBottom: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h1, color: colors.textPrimary },
  content: { padding: spacing.md, paddingBottom: 40 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.subtle,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  profileInitials: { fontSize: 20, fontWeight: '700', color: '#fff' },
  profileInfo: { marginLeft: spacing.md },
  profileName: { ...typography.h3, color: colors.textPrimary },
  profileLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center' },
  settingInfo: { flex: 1, marginLeft: spacing.md },
  settingLabel: { fontSize: 13, color: colors.textSecondary },
  settingValue: { ...typography.h3, color: colors.textPrimary, fontSize: 16 },
  regionList: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border,
    maxHeight: 300, overflow: 'hidden',
  },
  regionItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  regionItemActive: { backgroundColor: colors.primary + '10' },
  regionText: { fontSize: 15, color: colors.textPrimary },
  regionTextActive: { color: colors.primary, fontWeight: '600' },
  scheduleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  scheduleRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  dayLabel: { fontSize: 15, color: colors.textPrimary },
  dayHours: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  toggle: {
    width: 50, height: 28, borderRadius: 14,
    backgroundColor: colors.border, justifyContent: 'center', padding: 2,
  },
  toggleActive: { backgroundColor: colors.primary },
  toggleKnob: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff', ...shadows.subtle,
  },
  toggleKnobActive: { alignSelf: 'flex-end' },
  scheduleNote: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, marginLeft: spacing.xs },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.red + '30',
    marginTop: spacing.md, gap: spacing.sm,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: colors.red },
});
