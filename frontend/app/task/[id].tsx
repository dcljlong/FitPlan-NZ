import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows, getStatusColor, getStatusLabel } from '../../components/theme';
import { api } from '../../components/api';
import { useUser } from '../../contexts/UserContext';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [hours, setHours] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogHours, setShowLogHours] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [logHoursVal, setLogHoursVal] = useState('');
  const [logDate, setLogDate] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logMember, setLogMember] = useState('');
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editQuotedHours, setEditQuotedHours] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDeps, setEditDeps] = useState<string[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const router = useRouter();
  const { userName } = useUser();

  const loadData = async () => {
    try {
      const [taskData, hoursData, teamData] = await Promise.all([
        api.getTask(id!),
        api.getTaskHours(id!),
        api.getTeam(),
      ]);
      setTask(taskData);
      setHours(hoursData);
      setTeam(teamData);
      // Load sibling tasks for dependency management
      if (taskData?.project_id) {
        const projectData = await api.getProject(taskData.project_id);
        setAllTasks((projectData.tasks || []).filter((t: any) => t.id !== id));
      }
    } catch (e) {
      console.error('Failed to load task', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { if (id) loadData(); }, [id]));

  useEffect(() => {
    const today = new Date();
    setLogDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    setLogMember(userName || '');
  }, [userName]);

  const handleLogHours = async () => {
    const hrs = parseFloat(logHoursVal);
    if (!hrs || hrs <= 0) {
      Alert.alert('Error', 'Please enter valid hours');
      return;
    }
    if (!logMember.trim()) {
      Alert.alert('Error', 'Please select a team member');
      return;
    }
    setSaving(true);
    try {
      await api.logHours(id!, {
        team_member_name: logMember.trim(),
        hours: hrs,
        date: logDate,
        notes: logNotes.trim(),
      });
      setLogHoursVal('');
      setLogNotes('');
      setShowLogHours(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTask = async () => {
    setSaving(true);
    try {
      const updates: any = {};
      if (editName.trim()) updates.name = editName.trim();
      if (editDuration) updates.duration_days = parseInt(editDuration);
      if (editQuotedHours) updates.quoted_hours = parseFloat(editQuotedHours);
      if (editStartDate) updates.start_date = editStartDate;
      updates.dependencies = editDeps;
      await api.updateTask(id!, updates);
      setShowEditTask(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = () => {
    Alert.alert('Delete Task', `Delete "${task?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTask(id!);
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.updateTask(id!, { status: newStatus });
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteLog = (logId: string) => {
    Alert.alert('Delete Log', 'Remove this hour log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await api.deleteHourLog(logId);
          loadData();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><Text style={{ color: colors.red }}>Task not found</Text></View>
      </SafeAreaView>
    );
  }

  const indicatorColor = getStatusColor(task.progress_indicator);
  const progressPct = task.quoted_hours > 0 ? Math.min((task.logged_hours / task.quoted_hours) * 100, 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="back-from-task-btn" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{task.name}</Text>
        <TouchableOpacity testID="edit-task-btn" onPress={() => {
          setEditName(task.name);
          setEditDuration(String(task.duration_days));
          setEditQuotedHours(String(task.quoted_hours));
          setEditStartDate(task.start_date || '');
          setEditDeps(task.dependencies || []);
          setShowEditTask(true);
        }}>
          <Feather name="edit-2" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Indicator Card */}
        <View style={[styles.indicatorCard, { borderLeftColor: indicatorColor }]}>
          <View style={styles.indicatorRow}>
            <View>
              <Text style={styles.indicatorLabel}>{getStatusLabel(task.progress_indicator)}</Text>
              <Text style={styles.indicatorHours}>
                {task.logged_hours?.toFixed(1)} / {task.quoted_hours} hours
              </Text>
            </View>
            <View style={styles.circleProgress}>
              <Text style={[styles.circleText, { color: indicatorColor }]}>{progressPct.toFixed(0)}%</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: indicatorColor }]} />
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>DETAILS</Text>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Schedule</Text>
            <Text style={styles.detailValue}>{task.start_date} → {task.end_date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="clock" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{task.duration_days} working days</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="users" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Required Staff</Text>
            <Text style={[styles.detailValue, { fontWeight: '700', color: colors.primary }]}>
              {task.required_staff > 0 ? `${task.required_staff} people` : 'Set quoted hours'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="flag" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Status</Text>
            <View style={styles.statusRow}>
              {['not_started', 'in_progress', 'completed'].map(s => (
                <TouchableOpacity
                  testID={`status-${s}-btn`}
                  key={s}
                  style={[styles.statusChip, task.status === s && styles.statusChipActive]}
                  onPress={() => handleStatusChange(s)}
                >
                  <Text style={[styles.statusChipText, task.status === s && styles.statusChipTextActive]}>
                    {s === 'not_started' ? 'Not Started' : s === 'in_progress' ? 'In Progress' : 'Completed'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Hour Logs */}
        <View style={styles.logsCard}>
          <View style={styles.logsSectionHeader}>
            <Text style={styles.sectionTitle}>HOUR LOGS</Text>
            <TouchableOpacity
              testID="open-log-hours-btn"
              style={styles.logAddBtn}
              onPress={() => setShowLogHours(true)}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.logAddBtnText}>Log Hours</Text>
            </TouchableOpacity>
          </View>
          {hours.length === 0 ? (
            <Text style={styles.noLogs}>No hours logged yet</Text>
          ) : (
            hours.map(log => (
              <View key={log.id} style={styles.logItem}>
                <View style={styles.logInfo}>
                  <Text style={styles.logMember}>{log.team_member_name}</Text>
                  <Text style={styles.logDate}>{log.date}</Text>
                  {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
                </View>
                <Text style={styles.logHours}>{log.hours}h</Text>
                <TouchableOpacity testID={`delete-log-${log.id}`} onPress={() => handleDeleteLog(log.id)}>
                  <Feather name="x" size={16} color={colors.red} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Delete button */}
        <TouchableOpacity
          testID="delete-task-btn"
          style={styles.deleteBtn}
          onPress={handleDeleteTask}
        >
          <Feather name="trash-2" size={18} color={colors.red} />
          <Text style={styles.deleteBtnText}>Delete Task</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Log Hours Modal */}
      <Modal visible={showLogHours} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Hours</Text>
              <TouchableOpacity testID="close-log-hours-btn" onPress={() => setShowLogHours(false)}>
                <Feather name="x" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Team Member</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              {team.map(m => (
                <TouchableOpacity
                  testID={`select-member-${m.id}`}
                  key={m.id}
                  style={[styles.memberChip, logMember === m.name && styles.memberChipActive]}
                  onPress={() => setLogMember(m.name)}
                >
                  <Text style={[styles.memberChipText, logMember === m.name && styles.memberChipTextActive]}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Hours *</Text>
                <TextInput
                  testID="log-hours-input"
                  style={styles.input}
                  placeholder="8"
                  placeholderTextColor={colors.textSecondary}
                  value={logHoursVal}
                  onChangeText={setLogHoursVal}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  testID="log-date-input"
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={logDate}
                  onChangeText={setLogDate}
                />
              </View>
            </View>

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              testID="log-notes-input"
              style={[styles.input, { height: 60, textAlignVertical: 'top', paddingTop: spacing.sm }]}
              placeholder="What was done..."
              placeholderTextColor={colors.textSecondary}
              value={logNotes}
              onChangeText={setLogNotes}
              multiline
            />

            <TouchableOpacity
              testID="submit-log-hours-btn"
              style={[styles.submitBtn, saving && { opacity: 0.7 }]}
              onPress={handleLogHours}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Log Hours</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Task Modal */}
      <Modal visible={showEditTask} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Task</Text>
                <TouchableOpacity testID="close-edit-task-btn" onPress={() => setShowEditTask(false)}>
                  <Feather name="x" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Task Name</Text>
              <TextInput
                testID="edit-task-name-input"
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
              />
              <Text style={styles.label}>Start Date (YYYY-MM-DD, blank = auto from deps)</Text>
              <TextInput
                testID="edit-task-start-date-input"
                style={styles.input}
                value={editStartDate}
                onChangeText={setEditStartDate}
                placeholder="YYYY-MM-DD or blank for auto"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
              />
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Duration (days)</Text>
                  <TextInput
                    testID="edit-task-duration-input"
                    style={styles.input}
                    value={editDuration}
                    onChangeText={setEditDuration}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ width: spacing.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Quoted Hours</Text>
                  <TextInput
                    testID="edit-task-hours-input"
                    style={styles.input}
                    value={editQuotedHours}
                    onChangeText={setEditQuotedHours}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              {allTasks.length > 0 && (
                <>
                  <Text style={styles.label}>Link After (Dependencies)</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>
                    This task starts after selected tasks finish
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {allTasks.map((t: any) => (
                      <TouchableOpacity
                        testID={`edit-dep-${t.id}`}
                        key={t.id}
                        style={[
                          styles.memberChip,
                          editDeps.includes(t.id) && styles.memberChipActive,
                        ]}
                        onPress={() => {
                          setEditDeps(prev =>
                            prev.includes(t.id) ? prev.filter(d => d !== t.id) : [...prev, t.id]
                          );
                        }}
                      >
                        {editDeps.includes(t.id) && <Feather name="check" size={12} color={colors.primaryForeground} />}
                        <Text style={[styles.memberChipText, editDeps.includes(t.id) && styles.memberChipTextActive]}>
                          {t.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <TouchableOpacity
                testID="submit-edit-task-btn"
                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                onPress={handleEditTask}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.textPrimary, flex: 1, marginHorizontal: spacing.md, fontSize: 18 },
  content: { padding: spacing.md, paddingBottom: 40 },
  indicatorCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, marginBottom: spacing.md, ...shadows.subtle,
  },
  indicatorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  indicatorLabel: { ...typography.h3, color: colors.textPrimary },
  indicatorHours: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  circleProgress: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 3, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  circleText: { fontSize: 16, fontWeight: '700' },
  progressBarBg: {
    height: 8, backgroundColor: colors.surfaceSecondary,
    borderRadius: 4, overflow: 'hidden',
  },
  progressBarFill: { height: 8, borderRadius: 4 },
  detailsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, ...shadows.subtle,
  },
  sectionTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap',
  },
  detailLabel: { fontSize: 14, color: colors.textSecondary, marginLeft: spacing.sm, width: 100 },
  detailValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flex: 1, textAlign: 'right' },
  statusRow: { flexDirection: 'row', gap: spacing.xs, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  statusChipActive: { backgroundColor: colors.primary },
  statusChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  statusChipTextActive: { color: colors.primaryForeground },
  logsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, ...shadows.subtle,
  },
  logsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  logAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.pill, backgroundColor: colors.primary + '15',
  },
  logAddBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  noLogs: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  logItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  logInfo: { flex: 1 },
  logMember: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  logDate: { fontSize: 12, color: colors.textSecondary },
  logNotes: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  logHours: { fontSize: 16, fontWeight: '700', color: colors.primary, marginRight: spacing.sm },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.red + '30', gap: spacing.sm,
  },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: colors.red },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    height: 48, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontSize: 16, color: colors.textPrimary, backgroundColor: colors.background,
  },
  rowInputs: { flexDirection: 'row' },
  memberChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, marginRight: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  memberChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  memberChipText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  memberChipTextActive: { color: colors.primaryForeground },
  submitBtn: {
    height: 52, backgroundColor: colors.primary, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg,
  },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: colors.primaryForeground },
});
