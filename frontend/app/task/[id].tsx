import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  getStatusColor,
  getStatusLabel,
  getStaffingColor,
  getStaffingLabel,
} from '../../components/theme';
import { api } from '../../components/api';
import { useUser } from '../../contexts/UserContext';

function formatIsoToNz(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [hours, setHours] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogHours, setShowLogHours] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [saving, setSaving] = useState(false);

  const [logHoursVal, setLogHoursVal] = useState('');
  const [logDate, setLogDate] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logMember, setLogMember] = useState('');

  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editQuotedHours, setEditQuotedHours] = useState('');
  const [editAllocatedStaff, setEditAllocatedStaff] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDeps, setEditDeps] = useState<string[]>([]);

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

      if (taskData?.project_id) {
        const projectData = await api.getProject(taskData.project_id);
        setProject(projectData);
        setAllTasks((projectData.tasks || []).filter((t: any) => t.id !== id));
      }
    } catch (e) {
      console.error('Failed to load task', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    if (id) loadData();
  }, [id]));

  useEffect(() => {
    const today = new Date();
    setLogDate(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    );
    setLogMember(userName || '');
  }, [userName]);

  const openEditTask = () => {
    if (!task) return;
    setEditName(task.name || '');
    setEditDuration(String(task.duration_days || 0));
    setEditQuotedHours(String(task.quoted_hours || 0));
    setEditAllocatedStaff(String(task.allocated_staff_count || 0));
    setEditStartDate(task.start_date || '');
    setEditDeps(task.dependencies || []);
    setShowEditTask(true);
  };

  const toggleDep = (depId: string) => {
    setEditDeps((prev) => prev.includes(depId) ? prev.filter((d) => d !== depId) : [...prev, depId]);
  };

  const handleLogHours = async () => {
    const hrs = parseFloat(logHoursVal);
    if (!hrs || hrs <= 0) {
      Alert.alert('Error', 'Please enter valid hours');
      return;
    }
    if (!logMember.trim()) {
      Alert.alert('Error', 'Please select or enter a team member');
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
    if (!editName.trim()) {
      Alert.alert('Error', 'Task name is required');
      return;
    }
    if (!editDuration || parseInt(editDuration) <= 0) {
      Alert.alert('Error', 'Duration must be at least 1 day');
      return;
    }
    if (editStartDate && !editStartDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Error', 'Manual start date must be YYYY-MM-DD');
      return;
    }

    setSaving(true);
    try {
      const updates: any = {
        name: editName.trim(),
        duration_days: parseInt(editDuration) || 1,
        quoted_hours: parseFloat(editQuotedHours) || 0,
        allocated_staff_count: parseInt(editAllocatedStaff) || 0,
        dependencies: editDeps,
      };

      if (editStartDate.trim()) {
        updates.start_date = editStartDate.trim();
      }

      await api.updateTask(id!, updates);
      setShowEditTask(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearManualDate = async () => {
    try {
      await api.clearDateOverride(id!);
      setEditStartDate('');
      loadData();
      Alert.alert('Updated', 'Task date override cleared. Task will now auto-schedule from dependencies.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteTask = () => {
    Alert.alert('Delete Task', `Delete "${task?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
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
        text: 'Delete',
        style: 'destructive',
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
  const staffingColor = getStaffingColor(task.staffing_status);
  const progressPct = task.quoted_hours > 0 ? Math.min((task.logged_hours / task.quoted_hours) * 100, 100) : 0;
  const predecessorNames = (allTasks || [])
    .filter((t: any) => (task.dependencies || []).includes(t.id))
    .map((t: any) => t.name);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-from-task-btn" onPress={() => router.replace('/projects')}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{task.name}</Text>
        <TouchableOpacity testID="edit-task-btn" onPress={openEditTask}>
          <Feather name="edit-2" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.indicatorCard, { borderLeftColor: indicatorColor }]}>
          <View style={styles.indicatorRow}>
            <View>
              <Text style={styles.indicatorLabel}>{getStatusLabel(task.progress_indicator)}</Text>
              <Text style={styles.indicatorHours}>
                {(task.logged_hours || 0).toFixed(1)} / {task.quoted_hours || 0} hours
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

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>PLANNING</Text>

          <View style={styles.detailRow}>
            <Feather name="calendar" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Schedule</Text>
            <Text style={styles.detailValue}>{formatIsoToNz(task.start_date)} → {formatIsoToNz(task.end_date)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Feather name="clock" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{task.duration_days} working days</Text>
          </View>

          <View style={styles.detailRow}>
            <Feather name="git-merge" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Predecessors</Text>
            <Text style={styles.detailValue}>
              {predecessorNames.length > 0 ? predecessorNames.join(', ') : 'None'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Feather name="bar-chart-2" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Quoted Hours</Text>
            <Text style={styles.detailValue}>{task.quoted_hours || 0}</Text>
          </View>

          <View style={styles.detailRow}>
            <Feather name="users" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Required Staff</Text>
            <Text style={[styles.detailValue, { fontWeight: '700', color: colors.primary }]}>
              {task.required_staff > 0 ? `${task.required_staff}` : 'Set quoted hours'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Feather name="user-check" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Allocated Staff</Text>
            <Text style={styles.detailValue}>{task.allocated_staff_count || 0}</Text>
          </View>

          <View style={styles.detailRow}>
            <Feather name="alert-circle" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Staffing</Text>
            <View style={[styles.inlineBadge, { backgroundColor: staffingColor + '20' }]}>
              <Text style={[styles.inlineBadgeText, { color: staffingColor }]}>
                {getStaffingLabel(task.staffing_status)}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Feather name="flag" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Status</Text>
            <View style={styles.statusRow}>
              {['not_started', 'in_progress', 'completed'].map((s) => (
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

        <View style={styles.logsCard}>
          <View style={styles.logsSectionHeader}>
            <Text style={styles.sectionTitle}>HOUR LOGS</Text>
            <TouchableOpacity
              testID="open-log-hours-btn"
              style={styles.logAddBtn}
              onPress={() => setShowLogHours(true)}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.logAddText}>Log Hours</Text>
            </TouchableOpacity>
          </View>

          {hours.length === 0 ? (
            <Text style={styles.emptyText}>No hours logged yet</Text>
          ) : (
            hours.map((log: any) => (
              <View key={log.id} style={styles.logItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>{log.team_member_name} — {log.hours}h</Text>
                  <Text style={styles.logMeta}>{formatIsoToNz(log.date)}</Text>
                  {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDeleteLog(log.id)}>
                  <Feather name="trash-2" size={18} color={colors.red} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          testID="delete-task-btn"
          style={styles.deleteBtn}
          onPress={handleDeleteTask}
        >
          <Feather name="trash-2" size={18} color="#fff" />
          <Text style={styles.deleteBtnText}>Delete Task</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showLogHours} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log Hours</Text>

            <Text style={styles.inputLabel}>Team Member</Text>
            <TextInput
              style={styles.input}
              value={logMember}
              onChangeText={setLogMember}
              placeholder="Team member name"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Hours</Text>
            <TextInput
              style={styles.input}
              value={logHoursVal}
              onChangeText={setLogHoursVal}
              keyboardType="decimal-pad"
              placeholder="e.g. 8"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Date</Text>
            <TextInput
              style={styles.input}
              value={logDate}
              onChangeText={setLogDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={logNotes}
              onChangeText={setLogNotes}
              multiline
              placeholder="Optional notes"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowLogHours(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogHours} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showEditTask} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrap}
        >
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Task Plan</Text>

              <Text style={styles.inputLabel}>Task Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Task name"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Duration (working days)</Text>
              <TextInput
                style={styles.input}
                value={editDuration}
                onChangeText={setEditDuration}
                keyboardType="number-pad"
                placeholder="e.g. 5"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Quoted Hours</Text>
              <TextInput
                style={styles.input}
                value={editQuotedHours}
                onChangeText={setEditQuotedHours}
                keyboardType="decimal-pad"
                placeholder="e.g. 80"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Allocated Staff</Text>
              <TextInput
                style={styles.input}
                value={editAllocatedStaff}
                onChangeText={setEditAllocatedStaff}
                keyboardType="number-pad"
                placeholder="e.g. 2"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Manual Start Override</Text>
              <TextInput
                style={styles.input}
                value={editStartDate}
                onChangeText={setEditStartDate}
                placeholder="YYYY-MM-DD (leave blank for auto)"
                placeholderTextColor={colors.textSecondary}
              />

              <TouchableOpacity style={styles.clearOverrideBtn} onPress={handleClearManualDate}>
                <Feather name="rotate-ccw" size={16} color={colors.secondary} />
                <Text style={styles.clearOverrideText}>Clear manual date and auto-schedule from predecessors</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Predecessors (Finish-to-Start)</Text>
              <View style={styles.depList}>
                {allTasks.length === 0 ? (
                  <Text style={styles.emptyText}>No other tasks available</Text>
                ) : (
                  allTasks.map((t: any) => {
                    const selected = editDeps.includes(t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.depItem, selected && styles.depItemSelected]}
                        onPress={() => toggleDep(t.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.depTitle}>{t.name}</Text>
                          <Text style={styles.depMeta}>{formatIsoToNz(t.start_date)} → {formatIsoToNz(t.end_date)}</Text>
                        </View>
                        <Feather
                          name={selected ? 'check-square' : 'square'}
                          size={20}
                          color={selected ? colors.primary : colors.textSecondary}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowEditTask(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleEditTask} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Plan</Text>}
                </TouchableOpacity>
              </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  content: { padding: spacing.md, paddingBottom: 80, gap: spacing.md },
  indicatorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 6,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  indicatorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  indicatorLabel: { ...typography.h3, color: colors.textPrimary },
  indicatorHours: { ...typography.body, color: colors.textSecondary },
  circleProgress: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 3, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  circleText: { fontSize: 16, fontWeight: '800' },
  progressBarBg: {
    height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden',
  },
  progressBarFill: { height: 8, borderRadius: 4 },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  logsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  detailRow: {
    marginBottom: spacing.md,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 4,
  },
  detailValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  inlineBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  inlineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  statusChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusChipTextActive: {
    color: colors.secondaryForeground,
  },
  logsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logAddText: { color: colors.primary, fontWeight: '700' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  logItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  logMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  logNotes: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  deleteBtn: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    ...shadows.medium,
  },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    color: colors.textPrimary,
    fontSize: 16,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  clearOverrideBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  clearOverrideText: {
    color: colors.secondary,
    fontWeight: '700',
    flex: 1,
  },
  depList: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  depItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
  },
  depItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
  },
  depTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  depMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
