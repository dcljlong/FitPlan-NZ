import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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
} from '../../components/theme';
import { api } from '../../components/api';
import { useUser } from '../../contexts/UserContext';

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { userName } = useUser();

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (e) {
      console.error('Failed to load projects', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadProjects(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    loadProjects();
  };

  const totalProjects = projects.length;
  const lateProjects = projects.filter((p: any) => (p.late_tasks || 0) > 0).length;
  const staffRiskProjects = projects.filter((p: any) => (p.understaffed_tasks || 0) > 0).length;
  const activeRiskProjects = projects.filter((p: any) =>
    (p.late_tasks || 0) > 0 || (p.understaffed_tasks || 0) > 0
  ).length;
  const readyProjects = projects.filter((p: any) =>
    (p.task_count || 0) > 0 && (p.completed_tasks || 0) < (p.task_count || 0)
  ).length;

  const renderProject = ({ item }: { item: any }) => {
    const indicatorColor = getStatusColor(item.overall_indicator);
    const scheduleColor = getScheduleColor(item.schedule_status);
    const progress = item.task_count > 0 ? item.completed_tasks / item.task_count : 0;
    const lateTasks = item.late_tasks || 0;
    const staffRisk = item.understaffed_tasks || 0;

    return (
      <TouchableOpacity
        testID={`project-card-${item.id}`}
        style={styles.card}
        onPress={() => router.push(`/project/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: indicatorColor }]} />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </View>

        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{item.start_date} → {item.forecast_end_date || item.end_date}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="list" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{item.completed_tasks}/{item.task_count} tasks</Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="target" size={14} color={scheduleColor} />
            <Text style={[styles.metaText, { color: scheduleColor }]}>{item.target_end_date || 'No target finish'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="users" size={14} color={staffRisk > 0 ? colors.red : colors.textSecondary} />
            <Text style={[styles.metaText, staffRisk > 0 && { color: colors.red }]}>{staffRisk} staff risk</Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="alert-triangle" size={14} color={lateTasks > 0 ? colors.red : colors.textSecondary} />
            <Text style={[styles.metaText, lateTasks > 0 && { color: colors.red }]}>{lateTasks} late task{lateTasks === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="briefcase" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{item.total_allocated_staff || 0} alloc staff</Text>
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: indicatorColor }]} />
        </View>

        <View style={styles.hoursRow}>
          <Text style={styles.hoursLabel}>
            {item.total_logged_hours?.toFixed(1) || '0'} / {item.total_quoted_hours?.toFixed(1) || '0'} hrs
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: scheduleColor + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: scheduleColor }]}>
                {getScheduleLabel(item.schedule_status)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: indicatorColor + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: indicatorColor }]}>
                {getStatusLabel(item.overall_indicator)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>G'day, {userName} 👋</Text>
          <Text style={styles.headerTitle}>Projects</Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Projects</Text>
          <Text style={styles.summaryValue}>{totalProjects}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>At Risk</Text>
          <Text style={[styles.summaryValue, activeRiskProjects > 0 && { color: colors.red }]}>
            {activeRiskProjects}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Late</Text>
          <Text style={[styles.summaryValue, lateProjects > 0 && { color: colors.red }]}>
            {lateProjects}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Staff Risk</Text>
          <Text style={[styles.summaryValue, staffRiskProjects > 0 && { color: colors.red }]}>
            {staffRiskProjects}
          </Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryWideCard}>
          <View style={styles.summaryWideTop}>
            <Text style={styles.summaryWideTitle}>Quick View</Text>
            <Feather name="activity" size={16} color={colors.primary} />
          </View>
          <Text style={styles.summaryWideText}>
            {readyProjects} active project{readyProjects === 1 ? '' : 's'} in progress or ready to move.
          </Text>
          <Text style={styles.summaryWideSubtext}>
            Focus first on late tasks and staff risk to keep target finish dates realistic.
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          testID="projects-list"
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProject}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<ListHeader />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="clipboard" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No projects yet</Text>
              <Text style={styles.emptySubtext}>Tap + to create your first project</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        testID="create-project-btn"
        style={styles.fab}
        onPress={() => router.push('/project/create')}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  greeting: {
    ...typography.body,
    color: colors.textSecondary,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: 2,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.md, paddingBottom: 100 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
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
  summaryWideCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    ...shadows.subtle,
  },
  summaryWideTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryWideTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  summaryWideText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  summaryWideSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  cardDesc: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: { height: 6, borderRadius: 3 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  hoursLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md },
  emptySubtext: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
});
