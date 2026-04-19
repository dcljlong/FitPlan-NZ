import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, Switch, Alert,
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
  getScheduleColor,
  getScheduleLabel,
  getStaffingColor,
  getStaffingLabel,
} from '../../components/theme';
import { api } from '../../components/api';

function formatIsoToNz(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function isTaskBlocked(task: any, taskMap: Record<string, any>) {
  const deps = task.dependencies || [];
  if (deps.length === 0) return false;
  return deps.some((depId: string) => {
    const dep = taskMap[depId];
    return !dep || dep.status !== 'completed';
  });
}

function isTaskReady(task: any, taskMap: Record<string, any>) {
  if ((task.status || 'not_started') !== 'not_started') return false;
  return !isTaskBlocked(task, taskMap);
}

function getTaskReadiness(task: any, taskMap: Record<string, any>) {
  const status = task.status || 'not_started';
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'active';
  if (isTaskBlocked(task, taskMap)) return 'blocked';
  if (isTaskReady(task, taskMap)) return 'ready';
  return 'ready';
}

function getReadinessColor(readiness: string) {
  switch (readiness) {
    case 'completed': return colors.green;
    case 'blocked': return colors.red;
    case 'ready': return colors.primary;
    case 'active': return colors.yellow;
    default: return colors.border;
  }
}

function getReadinessLabel(readiness: string) {
  switch (readiness) {
    case 'completed': return 'Done';
    case 'blocked': return 'Blocked';
    case 'ready': return 'Ready';
    case 'active': return 'Active';
    default: return 'Unknown';
  }
}

function isTaskLate(task: any) {
  return task?.schedule_conflict_status === 'late';
}

function isTaskStaffRisk(task: any) {
  return ['under', 'unassigned'].includes(task?.staffing_status);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTargetEndDate, setEditTargetEndDate] = useState('');
  const [editSaturdayEnabled, setEditSaturdayEnabled] = useState(false);

  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('5');
  const [newTaskQuotedHours, setNewTaskQuotedHours] = useState('0');
  const [newTaskAllocatedStaff, setNewTaskAllocatedStaff] = useState('0');
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskDeps, setNewTaskDeps] = useState<string[]>([]);

  const router = useRouter();

  const loadProject = async () => {
    try {
      const data = await api.getProject(id!);
      setProject(data);
    } catch (e) {
      console.error('Failed to load project', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    if (id) loadProject();
  }, [id]));

  const onRefresh = () => {
    setRefreshing(true);
    loadProject();
  };

  const openEditProject = () => {
    if (!project) return;
    setEditName(project.name || '');
    setEditDescription(project.description || '');
    setEditTargetEndDate(project.target_end_date || '');
    setEditSaturdayEnabled(!!project.saturday_enabled);
    setShowEditProject(true);
  };

  const openAddTask = () => {
    setNewTaskName('');
    setNewTaskDuration('5');
    setNewTaskQuotedHours('0');
    setNewTaskAllocatedStaff('0');
    setNewTaskStartDate('');
    setNewTaskDeps([]);
    setShowAddTask(true);
  };

  const toggleNewTaskDep = (taskId: string) => {
    setNewTaskDeps((prev) => prev.includes(taskId) ? prev.filter((d) => d !== taskId) : [...prev, taskId]);
  };

  const handleSaveProject = async () => {
    const cleanName = editName.trim();
    const cleanTarget = editTargetEndDate.trim();

    if (!cleanName) {
      Alert.alert('Error', 'Project name is required');
      return;
    }
    if (cleanTarget && !isValidDate(cleanTarget)) {
      Alert.alert('Error', 'Target finish must be YYYY-MM-DD');
      return;
    }
    if (cleanTarget && project?.start_date && cleanTarget < project.start_date) {
      Alert.alert('Error', 'Target finish cannot be earlier than project start');
      return;
    }

    setSaving(true);
    try {
      await api.updateProject(id!, {
        name: cleanName,
        description: editDescription.trim(),
        target_end_date: cleanTarget || null,
        saturday_enabled: editSaturdayEnabled,
      });
      setShowEditProject(false);
      loadProject();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async () => {
    const cleanName = newTaskName.trim();
    const duration = parseInt(newTaskDuration, 10);
    const quotedHours = parseFloat(newTaskQuotedHours || '0');
    const allocatedStaff = parseInt(newTaskAllocatedStaff || '0', 10);
    const cleanStart = newTaskStartDate.trim();

    if (!cleanName) {
      Alert.alert('Error', 'Task name is required');
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      Alert.alert('Error', 'Duration must be at least 1 working day');
      return;
    }
    if (!Number.isFinite(quotedHours) || quotedHours < 0) {
      Alert.alert('Error', 'Quoted hours cannot be negative');
      return;
    }
    if (!Number.isFinite(allocatedStaff) || allocatedStaff < 0) {
      Alert.alert('Error', 'Allocated staff cannot be negative');
      return;
    }
    if (cleanStart && !isValidDate(cleanStart)) {
      Alert.alert('Error', 'Manual start date must be YYYY-MM-DD');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: cleanName,
        duration_days: duration,
        quoted_hours: quotedHours,
        allocated_staff_count: allocatedStaff,
        order: (project?.tasks || []).length,
        dependencies: newTaskDeps,
      };
      if (cleanStart) {
        payload.start_date = cleanStart;
      }
      await api.createTask(id!, payload);

      setNewTaskName('');
      setNewTaskDuration('5');
      setNewTaskQuotedHours('0');
      setNewTaskAllocatedStaff('0');
      setNewTaskStartDate('');
      setNewTaskDeps([]);
      setShowAddTask(false);
      loadProject();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><Text style={{ color: colors.red }}>Project not found</Text></View>
      </SafeAreaView>
    );
  }

  const tasks = project.tasks || [];
  const taskMap = Object.fromEntries(tasks.map((t: any) => [t.id, t]));
  const indicatorColor = getStatusColor(project.overall_indicator);
  const scheduleColor = getScheduleColor(project.schedule_status);

  const blockedCount = tasks.filter((t: any) => getTaskReadiness(t, taskMap) === 'blocked').length;
  const readyCount = tasks.filter((t: any) => getTaskReadiness(t, taskMap) === 'ready').length;
  const activeCount = tasks.filter((t: any) => getTaskReadiness(t, taskMap) === 'active').length;
  const doneCount = tasks.filter((t: any) => getTaskReadiness(t, taskMap) === 'completed').length;
  const staffRiskCount = project.understaffed_tasks ?? tasks.filter((t: any) => isTaskStaffRisk(t)).length;
  const lateCount = project.late_tasks ?? tasks.filter((t: any) => isTaskLate(t)).length;

  const progressPct = project.total_quoted_hours > 0
    ? Math.min((project.total_logged_hours / project.total_quoted_hours) * 100, 100)
    : 0;

  const sortedTasks = [...tasks].sort((a: any, b: any) => {
    const weight = (t: any) => {
      const readiness = getTaskReadiness(t, taskMap);
      const late = isTaskLate(t);
      const staffRisk = isTaskStaffRisk(t);

      if (late || staffRisk) return 0;
      if (readiness === 'active') return 1;
      if (readiness === 'ready') return 2;
      if (readiness === 'blocked') return 3;
      if (readiness === 'completed') return 4;
      return 5;
    };
    return weight(a) - weight(b);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-from-project-btn" onPress={() => router.replace('/projects')}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity testID="edit-project-btn" onPress={openEditProject}>
            <Feather name="edit-2" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity testID="add-task-btn" onPress={openAddTask}>
            <Feather name="plus-circle" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={[styles.heroCard, { borderLeftColor: indicatorColor }]}>
          <Text style={styles.heroTitle}>{project.name}</Text>
          {!!project.description && <Text style={styles.heroDesc}>{project.description}</Text>}

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Feather name="calendar" size={15} color={colors.textSecondary} />
              <Text style={styles.heroMetaText}>{formatIsoToNz(project.start_date)} → {formatIsoToNz(project.forecast_end_date || project.end_date)}</Text>
            </View>
            <View style={[styles.inlineBadge, { backgroundColor: scheduleColor + '20' }]}>
              <Text style={[styles.inlineBadgeText, { color: scheduleColor }]}>{getScheduleLabel(project.schedule_status)}</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Feather name="target" size={15} color={scheduleColor} />
              <Text style={[styles.heroMetaText, { color: scheduleColor }]}>{project.target_end_date ? formatIsoToNz(project.target_end_date) : 'No target finish set'}</Text>
            </View>
            <View style={[styles.inlineBadge, { backgroundColor: indicatorColor + '20' }]}>
              <Text style={[styles.inlineBadgeText, { color: indicatorColor }]}>{getStatusLabel(project.overall_indicator)}</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Feather name="sun" size={15} color={colors.textSecondary} />
              <Text style={styles.heroMetaText}>{project.saturday_enabled ? 'Saturday work enabled' : 'Saturday work off'}</Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: indicatorColor }]} />
          </View>

          <Text style={styles.progressText}>
            {(project.total_logged_hours || 0).toFixed(1)} / {(project.total_quoted_hours || 0).toFixed(1)} hrs • {progressPct.toFixed(0)}%
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tasks</Text>
            <Text style={styles.summaryValue}>{tasks.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ready</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{readyCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Active</Text>
            <Text style={[styles.summaryValue, { color: colors.yellow }]}>{activeCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Done</Text>
            <Text style={[styles.summaryValue, { color: colors.green }]}>{doneCount}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Blocked</Text>
            <Text style={[styles.summaryValue, { color: blockedCount > 0 ? colors.red : colors.textPrimary }]}>{blockedCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Staff Risk</Text>
            <Text style={[styles.summaryValue, { color: staffRiskCount > 0 ? colors.red : colors.textPrimary }]}>{staffRiskCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Late</Text>
            <Text style={[styles.summaryValue, { color: lateCount > 0 ? colors.red : colors.textPrimary }]}>{lateCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Alloc Staff</Text>
            <Text style={styles.summaryValue}>{project.total_allocated_staff || 0}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>TASKS</Text>
            <TouchableOpacity style={styles.sectionAddBtn} onPress={openAddTask}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.sectionAddText}>Add Task</Text>
            </TouchableOpacity>
          </View>

          {sortedTasks.length === 0 ? (
            <Text style={styles.emptyText}>No tasks yet</Text>
          ) : (
            sortedTasks.map((task: any) => {
              const readiness = getTaskReadiness(task, taskMap);
              const readinessColor = getReadinessColor(readiness);
              const staffingColor = getStaffingColor(task.staffing_status);
              const depsCount = (task.dependencies || []).length;
              const late = isTaskLate(task);
              const staffRisk = isTaskStaffRisk(task);

              return (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.taskCard,
                    late && styles.taskCardLate,
                    staffRisk && styles.taskCardRisk,
                  ]}
                  onPress={() => router.push(`/task/${task.id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.taskTopRow}>
                    <Text style={styles.taskTitle} numberOfLines={1}>{task.name}</Text>
                    <Feather name="chevron-right" size={18} color={colors.textSecondary} />
                  </View>

                  <View style={styles.taskMetaRow}>
                    <View style={styles.taskMetaItem}>
                      <Feather name="calendar" size={14} color={colors.textSecondary} />
                      <Text style={styles.taskMetaText}>{formatIsoToNz(task.start_date)} → {formatIsoToNz(task.end_date)}</Text>
                    </View>
                    <View style={[styles.inlineBadge, { backgroundColor: readinessColor + '20' }]}>
                      <Text style={[styles.inlineBadgeText, { color: readinessColor }]}>
                        {getReadinessLabel(readiness)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.taskMetaRow}>
                    <View style={styles.taskMetaItem}>
                      <Feather name="git-merge" size={14} color={colors.textSecondary} />
                      <Text style={styles.taskMetaText}>{depsCount} predecessor{depsCount === 1 ? '' : 's'}</Text>
                    </View>
                    <View style={[styles.inlineBadge, { backgroundColor: staffingColor + '20' }]}>
                      <Text style={[styles.inlineBadgeText, { color: staffingColor }]}>
                        {getStaffingLabel(task.staffing_status)}
                      </Text>
                    </View>
                  </View>

                  {(late || staffRisk) && (
                    <View style={styles.riskRow}>
                      {late && (
                        <View style={[styles.riskBadge, { backgroundColor: colors.red + '20' }]}>
                          <Text style={[styles.riskBadgeText, { color: colors.red }]}>Schedule At Risk</Text>
                        </View>
                      )}
                      {staffRisk && (
                        <View style={[styles.riskBadge, { backgroundColor: colors.yellow + '20' }]}>
                          <Text style={[styles.riskBadgeText, { color: colors.yellow }]}>Staff At Risk</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.taskBottomRow}>
                    <Text style={styles.taskHours}>{(task.logged_hours || 0).toFixed(1)} / {task.quoted_hours || 0} hrs</Text>
                    <Text style={styles.taskStaff}>Req {task.required_staff || 0} • Alloc {task.allocated_staff_count || 0}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={showEditProject} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Project</Text>

            <Text style={styles.inputLabel}>Project Name</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Project name" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput style={[styles.input, styles.multiline]} value={editDescription} onChangeText={setEditDescription} multiline placeholder="Description" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Target Finish</Text>
            <TextInput style={styles.input} value={editTargetEndDate} onChangeText={setEditTargetEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Saturday Work</Text>
              <Switch
                value={editSaturdayEnabled}
                onValueChange={setEditSaturdayEnabled}
                trackColor={{ false: colors.border, true: colors.primary + '88' }}
                thumbColor={editSaturdayEnabled ? colors.primary : '#fff'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowEditProject(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveProject} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAddTask} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Task</Text>

              <Text style={styles.inputLabel}>Task Name</Text>
              <TextInput style={styles.input} value={newTaskName} onChangeText={setNewTaskName} placeholder="Task name" placeholderTextColor={colors.textSecondary} />

              <Text style={styles.inputLabel}>Duration (working days)</Text>
              <TextInput style={styles.input} value={newTaskDuration} onChangeText={setNewTaskDuration} keyboardType="number-pad" placeholder="5" placeholderTextColor={colors.textSecondary} />

              <Text style={styles.inputLabel}>Quoted Hours</Text>
              <TextInput style={styles.input} value={newTaskQuotedHours} onChangeText={setNewTaskQuotedHours} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textSecondary} />

              <Text style={styles.inputLabel}>Allocated Staff</Text>
              <TextInput style={styles.input} value={newTaskAllocatedStaff} onChangeText={setNewTaskAllocatedStaff} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} />

              <Text style={styles.inputLabel}>Manual Start Override</Text>
              <TextInput style={styles.input} value={newTaskStartDate} onChangeText={setNewTaskStartDate} placeholder="YYYY-MM-DD optional" placeholderTextColor={colors.textSecondary} />

              <Text style={styles.inputLabel}>Predecessors (Finish-to-Start)</Text>
              <View style={styles.depList}>
                {tasks.length === 0 ? (
                  <Text style={styles.emptyText}>No existing tasks to link yet</Text>
                ) : (
                  tasks.map((t: any) => {
                    const selected = newTaskDeps.includes(t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.depItem, selected && styles.depItemSelected]}
                        onPress={() => toggleNewTaskDep(t.id)}
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
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowAddTask(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleAddTask} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Task</Text>}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  content: { padding: spacing.md, paddingBottom: 80, gap: spacing.md },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 6,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  heroTitle: { ...typography.h2, color: colors.textPrimary },
  heroDesc: { ...typography.body, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.sm },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  heroMetaText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginTop: spacing.sm },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: '23%',
    flex: 1,
    ...shadows.subtle,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  summaryValue: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 6 },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.caption, color: colors.textSecondary },
  sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionAddText: { color: colors.primary, fontWeight: '700' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  taskCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.sm,
  },
  taskCardLate: {
    borderColor: colors.red,
  },
  taskCardRisk: {
    borderColor: colors.yellow,
  },
  taskTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  taskMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  taskMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  taskMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  riskRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  riskBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  taskBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  taskHours: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  taskStaff: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', textAlign: 'right' },
  inlineBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
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
  toggleRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
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
