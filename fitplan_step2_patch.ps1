$ErrorActionPreference = "Stop"

cd "D:\FitPlanNZ"

@'
import React, { useState, useCallback } from 'react';
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
  getScheduleColor,
  getScheduleLabel,
  getStaffingColor,
  getStaffingLabel,
} from '../../components/theme';
import { api } from '../../components/api';
import GanttChart from '../../components/GanttChart';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDuration, setTaskDuration] = useState('5');
  const [taskQuotedHours, setTaskQuotedHours] = useState('0');
  const [taskAllocatedStaff, setTaskAllocatedStaff] = useState('0');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDeps, setTaskDeps] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [editProjectStartDate, setEditProjectStartDate] = useState('');
  const [editProjectTargetDate, setEditProjectTargetDate] = useState('');
  const [editProjectSaturdayEnabled, setEditProjectSaturdayEnabled] = useState(false);
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

  useFocusEffect(useCallback(() => {
    if (id) loadProject();
  }, [id]));

  const openAddTask = () => {
    setTaskName('');
    setTaskDuration('5');
    setTaskQuotedHours('0');
    setTaskAllocatedStaff('0');
    setTaskStartDate('');
    setTaskDeps([]);
    setShowAddTask(true);
  };

  const openEditProject = () => {
    if (!project) return;
    setEditProjectName(project.name || '');
    setEditProjectDescription(project.description || '');
    setEditProjectStartDate(project.start_date || '');
    setEditProjectTargetDate(project.target_end_date || '');
    setEditProjectSaturdayEnabled(!!project.saturday_enabled);
    setShowEditProject(true);
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
        allocated_staff_count: parseInt(taskAllocatedStaff) || 0,
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

  const handleEditProject = async () => {
    if (!editProjectName.trim()) {
      Alert.alert('Error', 'Project name is required');
      return;
    }
    if (!editProjectStartDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Error', 'Please enter a valid project start date (YYYY-MM-DD)');
      return;
    }
    if (editProjectTargetDate && !editProjectTargetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Error', 'Please enter a valid target finish date (YYYY-MM-DD)');
      return;
    }

    setSaving(true);
    try {
      await api.updateProject(id!, {
        name: editProjectName.trim(),
        description: editProjectDescription.trim(),
        start_date: editProjectStartDate,
        target_end_date: editProjectTargetDate || null,
        saturday_enabled: editProjectSaturdayEnabled,
      });
      setShowEditProject(false);
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
    setTaskDeps(prev => prev.includes(depId) ? prev.filter(d => d !== depId) : [...prev, depId]);
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
  const scheduleColor = getScheduleColor(project.schedule_status);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-to-projects-btn" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity testID="edit-project-btn" onPress={openEditProject}>
            <Feather name="edit-2" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity testID="project-menu-btn" onPress={handleDeleteProject}>
            <Feather name="trash-2" size={20} color={colors.red} />
          </TouchableOpacity>
        </View>
      </View>

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
          <Text style={[styles.statValue, { color: project.understaffed_tasks > 0 ? colors.red : colors.textPrimary }]}>
            {project.understaffed_tasks || 0}
          </Text>
          <Text style={styles.statLabel}>Staff Risk</Text>
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

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeaderRow}>
          <Text style={styles.summaryTitle}>Programme Summary</Text>
          <View style={[styles.summaryPill, { backgroundColor: scheduleColor + '20' }]}>
            <Text style={[styles.summaryPillText, { color: scheduleColor }]}>{getScheduleLabel(project.schedule_status)}</Text>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Start</Text>
            <Text style={styles.summaryValue}>{project.start_date}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Forecast Finish</Text>
            <Text style={styles.summaryValue}>{project.forecast_end_date || project.end_date}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Target Finish</Text>
            <Text style={[styles.summaryValue, !project.target_end_date && styles.summaryMuted]}>
              {project.target_end_date || 'Not set'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Saturday Work</Text>
            <Text style={styles.summaryValue}>{project.saturday_enabled ? 'On' : 'Off'}</Text>
          </View>
        </View>
      </View>

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
              const staffingColor = getStaffingColor(task.staffing_status);
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
                    <View style={styles.taskFooterWrap}>
                      <Text style={styles.taskHours}>
                        {task.logged_hours?.toFixed(1) || 0} / {task.quoted_hours} hrs
                      </Text>
                      <View style={styles.footerBadgeRow}>
                        <View style={styles.staffBadge}>
                          <Feather name="briefcase" size={12} color={colors.textSecondary} />
                          <Text style={styles.staffText}>Alloc {task.allocated_staff_count || 0}</Text>
                        </View>
                        <View style={styles.staffBadge}>
                          <Feather name="users" size={12} color={colors.secondary} />
                          <Text style={styles.staffText}>Req {task.required_staff || 0}</Text>
                        </View>
                        <View style={[styles.indicatorBadge, { backgroundColor: staffingColor + '20' }]}>
                          <Text style={[styles.indicatorText, { color: staffingColor }]}>
                            {getStaffingLabel(task.staffing_status)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
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

      <TouchableOpacity
        testID="add-task-btn"
        style={styles.fab}
        onPress={openAddTask}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>

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

              <Text style={styles.label}>Allocated Staff</Text>
              <TextInput
                testID="new-task-allocated-staff-input"
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={taskAllocatedStaff}
                onChangeText={setTaskAllocatedStaff}
                keyboardType="number-pad"
              />

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

      <Modal visible={showEditProject} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Project</Text>
                <TouchableOpacity testID="close-edit-project-btn" onPress={() => setShowEditProject(false)}>
                  <Feather name="x" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Project Name *</Text>
              <TextInput
                testID="edit-project-name-input"
                style={styles.input}
                value={editProjectName}
                onChangeText={setEditProjectName}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                testID="edit-project-description-input"
                style={[styles.input, styles.textArea]}
                value={editProjectDescription}
                onChangeText={setEditProjectDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Project Start Date</Text>
              <TextInput
                testID="edit-project-start-date-input"
                style={styles.input}
                value={editProjectStartDate}
                onChangeText={setEditProjectStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>Target Finish Date</Text>
              <TextInput
                testID="edit-project-target-date-input"
                style={styles.input}
                value={editProjectTargetDate}
                onChangeText={setEditProjectTargetDate}
                placeholder="YYYY-MM-DD or blank"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
              />

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.label}>Saturday Work</Text>
                  <Text style={styles.hint}>6 hours per Saturday</Text>
                </View>
                <TouchableOpacity
                  testID="edit-project-saturday-toggle"
                  style={[styles.toggle, editProjectSaturdayEnabled && styles.toggleActive]}
                  onPress={() => setEditProjectSaturdayEnabled(!editProjectSaturdayEnabled)}
                >
                  <View style={[styles.toggleKnob, editProjectSaturdayEnabled && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                testID="submit-edit-project-btn"
                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                onPress={handleEditProject}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Project</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  summaryCard: {
    margin: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  summaryTitle: { ...typography.h3, fontSize: 16, color: colors.textPrimary },
  summaryPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  summaryPillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  summaryItem: { width: '50%' },
  summaryLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  summaryMuted: { color: colors.textSecondary },
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
  taskFooterWrap: { gap: spacing.xs },
  footerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  taskHours: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  staffBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.surfaceSecondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill,
  },
  staffText: { fontSize: 11, color: colors.secondary, fontWeight: '600' },
  indicatorBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
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
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
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
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
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
  submitBtn: {
    height: 52, backgroundColor: colors.primary, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg,
  },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: colors.primaryForeground },
});

'@ | Set-Content -LiteralPath "D:\FitPlanNZ\frontend\app\project\[id].tsx" -Encoding UTF8

@'
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
  const [editAllocatedStaff, setEditAllocatedStaff] = useState('');
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
      if (editAllocatedStaff) updates.allocated_staff_count = parseInt(editAllocatedStaff);
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
  const staffingColor = getStaffingColor(task.staffing_status);
  const progressPct = task.quoted_hours > 0 ? Math.min((task.logged_hours / task.quoted_hours) * 100, 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-from-task-btn" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{task.name}</Text>
        <TouchableOpacity testID="edit-task-btn" onPress={() => {
          setEditName(task.name);
          setEditDuration(String(task.duration_days));
          setEditQuotedHours(String(task.quoted_hours));
          setEditAllocatedStaff(String(task.allocated_staff_count || 0));
          setEditStartDate(task.start_date || '');
          setEditDeps(task.dependencies || []);
          setShowEditTask(true);
        }}>
          <Feather name="edit-2" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
            <Feather name="briefcase" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Allocated Staff</Text>
            <Text style={styles.detailValue}>{task.allocated_staff_count || 0} people</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="shield" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Staffing</Text>
            <View style={[styles.smallBadge, { backgroundColor: staffingColor + '20' }]}>
              <Text style={[styles.smallBadgeText, { color: staffingColor }]}>{getStaffingLabel(task.staffing_status)}</Text>
            </View>
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

        <TouchableOpacity
          testID="delete-task-btn"
          style={styles.deleteBtn}
          onPress={handleDeleteTask}
        >
          <Feather name="trash-2" size={18} color={colors.red} />
          <Text style={styles.deleteBtnText}>Delete Task</Text>
        </TouchableOpacity>
      </ScrollView>

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
              <Text style={styles.label}>Allocated Staff</Text>
              <TextInput
                testID="edit-task-allocated-staff-input"
                style={styles.input}
                value={editAllocatedStaff}
                onChangeText={setEditAllocatedStaff}
                keyboardType="number-pad"
              />
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
                          setEditDeps(prev => prev.includes(t.id) ? prev.filter(d => d !== t.id) : [...prev, t.id]);
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
  smallBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, marginLeft: 'auto' },
  smallBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
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
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
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

'@ | Set-Content -LiteralPath "D:\FitPlanNZ\frontend\app\task\[id].tsx" -Encoding UTF8

cd "D:\FitPlanNZ\frontend"

npx tsc --noEmit

npx expo export --platform web

Write-Host "step2 patch green"