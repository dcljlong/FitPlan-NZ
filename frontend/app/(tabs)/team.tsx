import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../../components/theme';
import { api } from '../../components/api';

export default function TeamScreen() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadTeam = async () => {
    try {
      const data = await api.getTeam();
      setMembers(data);
    } catch (e) {
      console.error('Failed to load team', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadTeam(); }, []));

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await api.createTeamMember({ name: name.trim(), role: role.trim() });
      setName('');
      setRole('');
      setShowForm(false);
      loadTeam();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (member: any) => {
    Alert.alert('Remove Member', `Remove ${member.name} from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTeamMember(member.id);
            loadTeam();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const renderMember = ({ item, index }: { item: any; index: number }) => {
    const initials = item.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const avatarColors = ['#F97316', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B'];
    const bgColor = avatarColors[index % avatarColors.length];
    return (
      <View testID={`team-member-${item.id}`} style={styles.memberCard}>
        <View style={[styles.avatar, { backgroundColor: bgColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          {item.role ? <Text style={styles.memberRole}>{item.role}</Text> : null}
        </View>
        <TouchableOpacity
          testID={`delete-member-${item.id}`}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="trash-2" size={18} color={colors.red} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Team</Text>
          <Text style={styles.headerSub}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            testID="team-list"
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={renderMember}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="users" size={48} color={colors.border} />
                <Text style={styles.emptyText}>No team members yet</Text>
              </View>
            }
          />
        )}

        {showForm ? (
          <View style={styles.formContainer}>
            <TextInput
              testID="team-name-input"
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <TextInput
              testID="team-role-input"
              style={styles.input}
              placeholder="Role (optional)"
              placeholderTextColor={colors.textSecondary}
              value={role}
              onChangeText={setRole}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                testID="cancel-add-member-btn"
                style={styles.cancelBtn}
                onPress={() => { setShowForm(false); setName(''); setRole(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="confirm-add-member-btn"
                style={[styles.addBtn, adding && { opacity: 0.7 }]}
                onPress={handleAdd}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Text style={styles.addBtnText}>Add Member</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {!showForm && (
          <TouchableOpacity
            testID="show-add-member-btn"
            style={styles.fab}
            onPress={() => setShowForm(true)}
            activeOpacity={0.8}
          >
            <Feather name="user-plus" size={24} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
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
  headerSub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.md, paddingBottom: 100 },
  memberCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.subtle,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  memberInfo: { flex: 1 },
  memberName: { ...typography.h3, color: colors.textPrimary, fontSize: 16 },
  memberRole: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { ...typography.h3, color: colors.textSecondary, marginTop: spacing.md },
  formContainer: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, ...shadows.medium,
  },
  input: {
    height: 48, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontSize: 16, color: colors.textPrimary, marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  formButtons: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  addBtn: {
    flex: 1, height: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primary,
  },
  addBtnText: { fontSize: 16, fontWeight: '600', color: colors.primaryForeground },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.primary, justifyContent: 'center',
    alignItems: 'center', ...shadows.medium,
  },
});
