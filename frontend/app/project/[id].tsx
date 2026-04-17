import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
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

function isTaskLate(task: any, project: any) {
  if (!project?.target_end_date || !task?.end_date) return false;
  return String(task.end_date) > String(project.target_end_date);
}

function isTaskStaffRisk(task: any) {
  return ['under', 'unassigned'].includes(task.staffing_status);
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const staffRiskCount = tasks.filter((t: any) => isTaskStaffRisk(t)).length;
  const lateCount = tasks.filter((t: any) => isTaskLate(t, project)).length;

  const progressPct = project.total_quoted_hours > 0
    ? Math.min((project.total_logged_hours / project.total_quoted_hours) * 100, 100)
    : 0;

  const sortedTasks = [...tasks].sort((a: any, b: any) => {
    const weight = (t: any) => {
      const readiness = getTaskReadiness(t, taskMap);
      const late = isTaskLate(t, project);
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
        <TouchableOpacity testID="back-from-project-btn" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
        <View style={{ width: 24 }} />
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
              <Text style={styles.heroMetaText}>{project.start_date} → {project.forecast_end_date || project.end_date}</Text>
            </View>
            <View style={[styles.inlineBadge, { backgroundColor: scheduleColor + '20' }]}>
              <Text style={[styles.inlineBadgeText, { color: scheduleColor }]}>{getScheduleLabel(project.schedule_status)}</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Feather name="target" size={15} color={scheduleColor} />
              <Text style={[styles.heroMetaText, { color: scheduleColor }]}>{project.target_end_date || 'No target finish set'}</Text>
            </View>
            <View style={[styles.inlineBadge, { backgroundColor: indicatorColor + '20' }]}>
              <Text style={[styles.inlineBadgeText, { color: indicatorColor }]}>{getStatusLabel(project.overall_indicator)}</Text>
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
          <Text style={styles.sectionTitle}>TASKS</Text>

          {sortedTasks.length === 0 ? (
            <Text style={styles.emptyText}>No tasks yet</Text>
          ) : (
            sortedTasks.map((task: any) => {
              const readiness = getTaskReadiness(task, taskMap);
              const readinessColor = getReadinessColor(readiness);
              const staffingColor = getStaffingColor(task.staffing_status);
              const depsCount = (task.dependencies || []).length;
              const late = isTaskLate(task, project);
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
                      <Text style={styles.taskMetaText}>{task.start_date} → {task.end_date}</Text>
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
  sectionTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
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
});
