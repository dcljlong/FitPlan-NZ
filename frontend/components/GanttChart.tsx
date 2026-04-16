import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography, getStatusColor } from './theme';

const DAY_WIDTH = 32;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 140;

interface Task {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  quoted_hours: number;
  logged_hours: number;
  required_staff: number;
  progress_indicator: string;
  status: string;
}

interface Props {
  tasks: Task[];
  projectStart: string;
  projectEnd: string;
  onTaskPress: (taskId: string) => void;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.max(0, Math.ceil((db.getTime() - da.getTime()) / 86400000));
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDay(d: Date): string {
  return String(d.getDate());
}

function formatMonth(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()];
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export default function GanttChart({ tasks, projectStart, projectEnd, onTaskPress }: Props) {
  const totalDays = useMemo(() => {
    if (!projectStart || !projectEnd) return 30;
    return Math.max(daysBetween(projectStart, projectEnd) + 7, 14);
  }, [projectStart, projectEnd]);

  const days = useMemo(() => {
    const result = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(projectStart, i);
      result.push({
        date: d,
        label: formatDay(d),
        month: formatMonth(d),
        isWeekend: isWeekend(d),
        isToday: d.toDateString() === new Date().toDateString(),
      });
    }
    return result;
  }, [projectStart, totalDays]);

  const monthHeaders = useMemo(() => {
    const headers: { month: string; startIndex: number; span: number }[] = [];
    let current = '';
    for (let i = 0; i < days.length; i++) {
      const m = days[i].month;
      if (m !== current) {
        current = m;
        headers.push({ month: m, startIndex: i, span: 1 });
      } else {
        headers[headers.length - 1].span++;
      }
    }
    return headers;
  }, [days]);

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Add tasks to see the Gantt chart</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.chartArea}>
        {/* Fixed left labels */}
        <View style={styles.labelColumn}>
          <View style={[styles.labelHeaderRow, { height: 50 }]}>
            <Text style={styles.labelHeaderText}>Task</Text>
          </View>
          {tasks.map((task) => {
            const indicatorColor = getStatusColor(task.progress_indicator);
            return (
              <TouchableOpacity
                testID={`gantt-task-label-${task.id}`}
                key={task.id}
                style={styles.labelRow}
                onPress={() => onTaskPress(task.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.labelDot, { backgroundColor: indicatorColor }]} />
                <Text style={styles.labelText} numberOfLines={1}>{task.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Scrollable timeline */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
          <View>
            {/* Month + Day headers */}
            <View style={{ height: 50 }}>
              <View style={styles.monthHeaderRow}>
                {monthHeaders.map((mh, i) => (
                  <View key={i} style={[styles.monthHeaderCell, { width: mh.span * DAY_WIDTH }]}>
                    <Text style={styles.monthHeaderText}>{mh.month}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.dayHeaderRow}>
                {days.map((d, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dayHeaderCell,
                      d.isWeekend && styles.weekendCell,
                      d.isToday && styles.todayHeaderCell,
                    ]}
                  >
                    <Text style={[styles.dayHeaderText, d.isToday && styles.todayText]}>{d.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Task bars */}
            {tasks.map((task) => {
              const startOffset = daysBetween(projectStart, task.start_date);
              const duration = daysBetween(task.start_date, task.end_date) + 1;
              const indicatorColor = getStatusColor(task.progress_indicator);
              const progressPct = task.quoted_hours > 0
                ? Math.min(task.logged_hours / task.quoted_hours, 1)
                : 0;

              return (
                <TouchableOpacity
                  testID={`gantt-bar-${task.id}`}
                  key={task.id}
                  style={[styles.taskRow, { width: totalDays * DAY_WIDTH }]}
                  onPress={() => onTaskPress(task.id)}
                  activeOpacity={0.7}
                >
                  {/* Weekend stripes */}
                  {days.map((d, i) => (
                    d.isWeekend ? (
                      <View key={i} style={[styles.weekendStripe, { left: i * DAY_WIDTH }]} />
                    ) : null
                  ))}
                  {/* Today line */}
                  {days.map((d, i) => (
                    d.isToday ? (
                      <View key={`today-${i}`} style={[styles.todayLine, { left: i * DAY_WIDTH + DAY_WIDTH / 2 }]} />
                    ) : null
                  ))}
                  {/* Bar */}
                  <View
                    style={[
                      styles.taskBar,
                      {
                        left: startOffset * DAY_WIDTH + 2,
                        width: Math.max(duration * DAY_WIDTH - 4, DAY_WIDTH - 4),
                        backgroundColor: indicatorColor + '30',
                        borderColor: indicatorColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.taskBarFill,
                        {
                          width: `${progressPct * 100}%`,
                          backgroundColor: indicatorColor,
                        },
                      ]}
                    />
                    <Text style={styles.taskBarText} numberOfLines={1}>
                      {task.required_staff > 0 ? `${task.required_staff}p` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl,
  },
  emptyText: { ...typography.body, color: colors.textSecondary },
  chartArea: { flex: 1, flexDirection: 'row' },
  labelColumn: {
    width: LABEL_WIDTH, borderRightWidth: 1, borderRightColor: colors.border,
    backgroundColor: colors.surface, zIndex: 10,
  },
  labelHeaderRow: {
    justifyContent: 'flex-end', paddingHorizontal: spacing.sm, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  labelHeaderText: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
  labelRow: {
    height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  labelDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  labelText: { fontSize: 12, color: colors.textPrimary, fontWeight: '500', flex: 1 },
  monthHeaderRow: { flexDirection: 'row', height: 22 },
  monthHeaderCell: {
    justifyContent: 'center', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    borderRightWidth: 1, borderRightColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  monthHeaderText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  dayHeaderRow: { flexDirection: 'row', height: 28 },
  dayHeaderCell: {
    width: DAY_WIDTH, justifyContent: 'center', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    borderRightWidth: 1, borderRightColor: colors.border,
  },
  weekendCell: { backgroundColor: colors.surfaceSecondary },
  todayHeaderCell: { backgroundColor: colors.primary + '20' },
  dayHeaderText: { fontSize: 10, color: colors.textSecondary },
  todayText: { color: colors.primary, fontWeight: '700' },
  taskRow: {
    height: ROW_HEIGHT, borderBottomWidth: 1, borderBottomColor: colors.border,
    position: 'relative',
  },
  weekendStripe: {
    position: 'absolute', top: 0, width: DAY_WIDTH, height: ROW_HEIGHT,
    backgroundColor: colors.surfaceSecondary,
  },
  todayLine: {
    position: 'absolute', top: 0, width: 2, height: ROW_HEIGHT,
    backgroundColor: colors.primary,
  },
  taskBar: {
    position: 'absolute', top: 8, height: ROW_HEIGHT - 16,
    borderRadius: radius.sm, borderWidth: 1.5, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
  },
  taskBarFill: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    borderRadius: radius.sm - 1, opacity: 0.6,
  },
  taskBarText: {
    fontSize: 10, fontWeight: '700', color: colors.textPrimary,
    paddingHorizontal: 4, zIndex: 1,
  },
});
