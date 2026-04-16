import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows, getStatusColor, getStatusLabel } from '../../components/theme';
import { api } from '../../components/api';
import GanttChart from '../../components/GanttChart';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  // Add task form
  const [taskName, setTaskName] = useState('');
  const [taskDuration, setTaskDuration] = useState('5');
  const [taskQuotedHours, setTaskQuotedHours] = useState('0');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDeps, setTaskDeps] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const loadProject = async () => {
    try {
      const data = await api.getProject(id!);
      setProject(data);
    } catch (e) {
      console.error('Failed to load project', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { if (id) loadProject(); }, [id]));

  const openAddTask = () => {
    setTaskName('');
    setTaskDuration('5');
    setTaskQuotedHours('0');
    setTaskStartDate('');
    setTaskDeps([]);
    setShowAddTask(true);
  };

  const handleAddTask = async () => {
    if (!taskName.trim()) return;
    setSaving(true);
    try {
      const maxOrder = project.tasks?.length || 0;
      await api.createTask(id!, {
        name: taskName.trim(),
        duration_days: parseInt(taskDuration) || 5,
        quoted_hours: parseFloat(taskQuotedHours) || 0,
        order: maxOrder,
        dependencies: taskDeps,
        start_date: taskStartDate || null,
        assigned_to: [],
      });
      setShowAddTask(false);
      loadProject();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      await api.saveAsTemplate({
        name: templateName.trim(),
        description: `Template from ${project.name}`,
        project_id: id!,
      });
      setTemplateName('');
      setShowSaveTemplate(false);
      Alert.alert('Success', 'Template saved!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = () => {
    Alert.alert('Delete Project', 'This will permanently delete the project and all its tasks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteProject(id!);
            router.replace('/(tabs)/projects');
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const moveTask = async (taskId: string, direction: 'up' | 'down') => {
    const tasks = project.tasks || [];
    const idx = tasks.findIndex((t: any) => t.id === taskId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tasks.length) return;
    const newOrder = tasks.map((t: any) => t.id);
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    try {
      await api.reorderTasks(id!, newOrder);
      loadProject();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSortByDate = async () => {
    try {
      await api.sortTasksByDate(id!);
      loadProject();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const toggleDep = (depId: string) => {
    setTaskDeps(prev =>
      prev.includes(depId) ? prev.filter(d => d !== depId) : [...prev, depId]
    );
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
        <View style={styles.center}><Text style={styles.errorText}>Project not found</Text></View>
      </SafeAreaView>
    );
  }

  const tasks = project.tasks || [];
  const indicatorColor = getStatusColor(project.overall_indicator);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-to-projects-btn" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
        <TouchableOpacity testID="project-menu-btn" onPress={handleDeleteProject}>
          <Feather name="trash-2" size={20} color={colors.red} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{tasks.length}</Text>
          <Text style={styles.statLabel}>Tasks</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{project.total_quoted_hours?.toFixed(0) || 0}</Text>
          <Text style={styles.statLabel}>Quoted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: indicatorColor }]}>
            {project.total_logged_hours?.toFixed(1) || 0}
          </Text>
          <Text style={styles.statLabel}>Logged</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={[styles.statusBadge, { backgroundColor: indicatorColor + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: indicatorColor }]}>
              {getStatusLabel(project.overall_indicator)}
            </Text>
          </View>
        </View>
      </View>

      {/* View Toggle + Actions */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          testID="gantt-view-btn"
          style={[styles.viewBtn, viewMode === 'gantt' && styles.viewBtnActive]}
          onPress={() => setViewMode('gantt')}
        >
          <Feather name="bar-chart-2" size={16} color={viewMode === 'gantt' ? colors.primaryForeground : colors.textSecondary} />
          <Text style={[styles.viewBtnText, viewMode === 'gantt' && styles.viewBtnTextActive]}>Gantt</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="list-view-btn"
          style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
          onPress={() => setViewMode('list')}
        >
          <Feather name="list" size={16} color={viewMode === 'list' ? colors.primaryForeground : colors.textSecondary} />
          <Text style={[styles.viewBtnText, viewMode === 'list' && styles.viewBtnTextActive]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="sort-by-date-btn" style={styles.actionBtn} onPress={handleSortByDate}>
          <Feather name="arrow-down" size={14} color={colors.primary} />
          <Text style={styles.actionBtnText}>Sort by Date</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="save-template-btn" style={styles.actionBtn} onPress={() => setShowSaveTemplate(true)}>
          <Feather name="save" size={14} color={colors.primary} />
          <Text style={styles.actionBtnText}>Template</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'gantt' ? (
        <GanttChart
          tasks={tasks}
          projectStart={project.start_date}
          projectEnd={project.end_date}
          onTaskPress={(taskId: string) => router.push(`/task/${taskId}`)}
        />
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: 100 }}>
          {tasks.length === 0 ? (
            <View style={styles.emptyTasks}>
              <Feather name="inbox" size={40} color={colors.border} />
              <Text style={styles.emptyText}>No tasks yet. Tap + to add.</Text>
            </View>
          ) : (
            tasks.map((task: any, idx: number) => {
              const taskColor = getStatusColor(task.progress_indicator);
              const depNames = task.dependencies?.map((depId: string) => {
                const dep = tasks.find((t: any) => t.id === depId);
                return dep?.name || '';
              }).filter(Boolean);
              return (
                <View key={task.id} style={styles.taskCard}>
                  <TouchableOpacity
                    testID={`task-item-${task.id}`}
                    style={styles.taskContent}
                    onPress={() => router.push(`/task/${task.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.taskHeader}>
                      <View style={[styles.taskDot, { backgroundColor: taskColor }]} />
                      <Text style={styles.taskName} numberOfLines={1}>{task.name}</Text>
                    </View>
                    <View style={styles.taskDates}>
                      <View style={styles.dateChip}>
                        <Feather name="play" size={10} color={colors.green} />
                        <Text style={styles.dateText}>{task.start_date}</Text>
                      </View>
                      <Feather name="arrow-right" size={12} color={colors.textSecondary} />
                      <View style={styles.dateChip}>
                        <Feather name="square" size={10} color={colors.red} />
                        <Text style={styles.dateText}>{task.end_date}</Text>
                      </View>
                      <Text style={styles.durationChip}>{task.duration_days}d</Text>
                    </View>
                    {depNames && depNames.length > 0 && (
                      <View style={styles.depRow}>
                        <Feather name="link" size={12} color={colors.textSecondary} />
                        <Text style={styles.depText}>After: {depNames.join(', ')}</Text>
                      </View>
                    )}
                    <View style={styles.taskFooter}>
                      <Text style={styles.taskHours}>
                        {task.logged_hours?.toFixed(1) || 0} / {task.quoted_hours} hrs
                      </Text>
                      {task.required_staff > 0 && (
                        <View style={styles.staffBadge}>
                          <Feather name="users" size={12} color={colors.secondary} />
                          <Text style={styles.staffText}>{task.required_staff}p</Text>
                        </View>
                      )}
                      <View style={[styles.indicatorBadge, { backgroundColor: taskColor + '20' }]}>
                        <Text style={[styles.indicatorText, { color: taskColor }]}>
                          {getStatusLabel(task.progress_indicator)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {/* Reorder buttons */}
                  <View style={styles.reorderCol}>
                    <TouchableOpacity
                      testID={`move-up-${task.id}`}
                      style={[styles.reorderBtn, idx === 0 && styles.reorderBtnDisabled]}
                      onPress={() => moveTask(task.id, 'up')}
                      disabled={idx === 0}
                    >
                      <Feather name="chevron-up" size={18} color={idx === 0 ? colors.border : colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.orderNum}>{idx + 1}</Text>
                    <TouchableOpacity
                      testID={`move-down-${task.id}`}
                      style={[styles.reorderBtn, idx === tasks.length - 1 && styles.reorderBtnDisabled]}
                      onPress={() => moveTask(task.id, 'down')}
                      disabled={idx === tasks.length - 1}
                    >
                      <Feather name="chevron-down" size={18} color={idx === tasks.length - 1 ? colors.border : colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        testID="add-task-btn"
        style={styles.fab}
        onPress={openAddTask}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal visible={showAddTask} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Task</Text>
                <TouchableOpacity testID="close-add-task-btn" onPress={() => setShowAddTask(false)}>
                  <Feather name="x" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Task Name *</Text>
              <TextInput
                testID="new-task-name-input"
                style={styles.input}
                placeholder="e.g. Steel Partitions"
                placeholderTextColor={colors.textSecondary}
                value={taskName}
                onChangeText={setTaskName}
              />

              <Text style={styles.label}>Start Date (leave blank for auto from dependencies)</Text>
              <TextInput
                testID="new-task-start-date-input"
                style={styles.input}
                placeholder="YYYY-MM-DD or leave blank"
                placeholderTextColor={colors.textSecondary}
                value={taskStartDate}
                onChangeText={setTaskStartDate}
                keyboardType="numbers-and-punctuation"
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Duration (days)</Text>
                  <TextInput
                    testID="new-task-duration-input"
                    style={styles.input}
                    placeholder="5"
                    placeholderTextColor={colors.textSecondary}
                    value={taskDuration}
                    onChangeText={setTaskDuration}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ width: spacing.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Quoted Hours</Text>
                  <TextInput
                    testID="new-task-hours-input"
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    value={taskQuotedHours}
                    onChangeText={setTaskQuotedHours}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Dependencies */}
              {tasks.length > 0 && (
                <>
                  <Text style={styles.label}>Link After (Dependencies)</Text>
                  <Text style={styles.hint}>This task starts after selected tasks finish</Text>
                  <View style={styles.depSelectContainer}>
                    {tasks.map((t: any) => (
                      <TouchableOpacity
                        testID={`dep-select-${t.id}`}
                        key={t.id}
                        style={[styles.depChip, taskDeps.includes(t.id) && styles.depChipActive]}
                        onPress={() => toggleDep(t.id)}
                      >
                        {taskDeps.includes(t.id) && <Feather name="check" size={12} color={colors.primaryForeground} />}
                        <Text style={[styles.depChipText, taskDeps.includes(t.id) && styles.depChipTextActive]}>
                          {t.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                testID="submit-add-task-btn"
                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                onPress={handleAddTask}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Task</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Save Template Modal */}
      <Modal visible={showSaveTemplate} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save as Template</Text>
              <TouchableOpacity testID="close-save-template-btn" onPress={() => setShowSaveTemplate(false)}>
                <Feather name="x" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              Save this project's task structure as a reusable template. Hours, dates and assignments will be stripped.
            </Text>
            <Text style={styles.label}>Template Name *</Text>
            <TextInput
              testID="template-name-input"
              style={styles.input}
              placeholder="e.g. My Custom Fitout"
              placeholderTextColor={colors.textSecondary}
              value={templateName}
              onChangeText={setTemplateName}
            />
            <TouchableOpacity
              testID="submit-save-template-btn"
              style={[styles.submitBtn, saving && { opacity: 0.7 }]}
              onPress={handleSaveAsTemplate}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Template</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { ...typography.h3, color: colors.red },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.textPrimary, flex: 1, marginHorizontal: spacing.md },
  statsBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  viewToggle: {
    flexDirection: 'row', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    gap: spacing.xs, backgroundColor: colors.surfaceSecondary, flexWrap: 'wrap',
  },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  viewBtnActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  viewBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  viewBtnTextActive: { color: colors.primaryForeground },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.primary + '40',
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  listContainer: { flex: 1, padding: spacing.sm },
  emptyTasks: { alignItems: 'center', paddingTop: 60 },
  emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  taskCard: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radius.lg, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...shadows.subtle, overflow: 'hidden',
  },
  taskContent: { flex: 1, padding: spacing.md },
  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  taskDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  taskName: { ...typography.h3, fontSize: 15, color: colors.textPrimary, flex: 1 },
  taskDates: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginBottom: spacing.xs, flexWrap: 'wrap',
  },
  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.surfaceSecondary, paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: radius.sm,
  },
  dateText: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  durationChip: {
    fontSize: 12, fontWeight: '700', color: colors.primary,
    backgroundColor: colors.primary + '10', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: radius.sm,
  },
  depRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: spacing.xs,
  },
  depText: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic' },
  taskFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  taskHours: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  staffBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.surfaceSecondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill,
  },
  staffText: { fontSize: 11, color: colors.secondary, fontWeight: '600' },
  indicatorBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, marginLeft: 'auto' },
  indicatorText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  reorderCol: {
    width: 44, alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  reorderBtn: { padding: 6 },
  reorderBtnDisabled: { opacity: 0.3 },
  orderNum: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.primary, justifyContent: 'center',
    alignItems: 'center', ...shadows.medium,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  modalDesc: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.sm },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    height: 48, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontSize: 16, color: colors.textPrimary, backgroundColor: colors.background,
  },
  rowInputs: { flexDirection: 'row' },
  depSelectContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  depChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  depChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  depChipText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  depChipTextActive: { color: colors.primaryForeground },
  submitBtn: {
    height: 52, backgroundColor: colors.primary, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg,
  },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: colors.primaryForeground },
});
