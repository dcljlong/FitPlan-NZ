from pathlib import Path

path = Path(r"D:\FitPlanNZ\frontend\app\task\[id].tsx")
text = path.read_text(encoding="utf-8")

# 1) Add date helper functions after formatIsoToNz
old = """function formatIsoToNz(value?: string | null) {
  if (!value || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}"""
new = """function formatIsoToNz(value?: string | null) {
  if (!value || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function partsToIso(day: number, month: number, year: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isoToParts(iso?: string | null) {
  if (!iso || !/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)) {
    const today = new Date();
    return {
      day: today.getDate(),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    };
  }
  const [year, month, day] = iso.split('-').map(Number);
  return { day, month, year };
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function clampDateParts(day: number, month: number, year: number) {
  let m = Math.min(12, Math.max(1, month));
  let y = Math.min(2100, Math.max(2020, year));
  let d = Math.min(daysInMonth(m, y), Math.max(1, day));
  return { day: d, month: m, year: y };
}"""
if old not in text:
    raise SystemExit("Could not find formatIsoToNz block")
text = text.replace(old, new, 1)

# 2) Add modal state after editStartDate
old = """  const [editStartDate, setEditStartDate] = useState('');
  const [editDeps, setEditDeps] = useState<string[]>([]);"""
new = """  const [editStartDate, setEditStartDate] = useState('');
  const [editDeps, setEditDeps] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);"""
if old not in text:
    raise SystemExit("Could not find editStartDate state block")
text = text.replace(old, new, 1)

# 3) Back button should return to project detail
text = text.replace(
    """<TouchableOpacity testID="back-from-task-btn" onPress={() => router.replace('/projects')}>""",
    """<TouchableOpacity testID="back-from-task-btn" onPress={() => router.replace(`/project/${task.project_id}`)}>""",
    1
)

# 4) Delete should return to project detail
text = text.replace(
    """            await api.deleteTask(id!);
            router.back();""",
    """            await api.deleteTask(id!);
            router.replace(`/project/${task.project_id}`);""",
    1
)

# 5) Replace manual start TextInput with simple picker button
old = """              <Text style={styles.inputLabel}>Manual Start Override</Text>
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
              </TouchableOpacity>"""
new = """              <Text style={styles.inputLabel}>Manual Start Override</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Feather name="calendar" size={18} color={colors.primary} />
                <Text style={[styles.dateButtonText, !editStartDate && styles.placeholderText]}>
                  {editStartDate ? formatIsoToNz(editStartDate) : 'Select simple start date (optional)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.clearOverrideBtn} onPress={handleClearManualDate}>
                <Feather name="rotate-ccw" size={16} color={colors.secondary} />
                <Text style={styles.clearOverrideText}>Clear manual date and auto-schedule from predecessors</Text>
              </TouchableOpacity>"""
if old not in text:
    raise SystemExit("Could not find manual start override input block")
text = text.replace(old, new, 1)

# 6) Insert date picker modal before closing SafeAreaView
old = """      </Modal>
    </SafeAreaView>"""
new = """      </Modal>

      <Modal visible={showDatePicker} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Manual Start</Text>
            <TaskDatePicker
              initialIso={editStartDate}
              onCancel={() => setShowDatePicker(false)}
              onConfirm={(iso) => {
                setEditStartDate(iso);
                setShowDatePicker(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>"""
if old not in text:
    raise SystemExit("Could not insert date picker modal")
text = text.replace(old, new, 1)

# 7) Insert TaskDatePicker component before styles
old = """const styles = StyleSheet.create({"""
new = """function TaskDatePicker({
  initialIso,
  onCancel,
  onConfirm,
}: {
  initialIso?: string | null;
  onCancel: () => void;
  onConfirm: (iso: string) => void;
}) {
  const initial = isoToParts(initialIso);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  useEffect(() => {
    const next = isoToParts(initialIso);
    setDay(next.day);
    setMonth(next.month);
    setYear(next.year);
  }, [initialIso]);

  const update = (nextDay: number, nextMonth: number, nextYear: number) => {
    const clamped = clampDateParts(nextDay, nextMonth, nextYear);
    setDay(clamped.day);
    setMonth(clamped.month);
    setYear(clamped.year);
  };

  return (
    <>
      <Text style={styles.modalPreview}>{formatIsoToNz(partsToIso(day, month, year))}</Text>

      <View style={styles.pickerGrid}>
        <View style={styles.pickerCol}>
          <Text style={styles.pickerLabel}>Day</Text>
          <TouchableOpacity style={styles.spinBtn} onPress={() => update(day + 1, month, year)}>
            <Feather name="chevron-up" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.spinValue}>{pad2(day)}</Text>
          <TouchableOpacity style={styles.spinBtn} onPress={() => update(day - 1, month, year)}>
            <Feather name="chevron-down" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.pickerCol}>
          <Text style={styles.pickerLabel}>Month</Text>
          <TouchableOpacity style={styles.spinBtn} onPress={() => update(day, month + 1, year)}>
            <Feather name="chevron-up" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.spinValue}>{pad2(month)}</Text>
          <TouchableOpacity style={styles.spinBtn} onPress={() => update(day, month - 1, year)}>
            <Feather name="chevron-down" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.pickerCol}>
          <Text style={styles.pickerLabel}>Year</Text>
          <TouchableOpacity style={styles.spinBtn} onPress={() => update(day, month, year + 1)}>
            <Feather name="chevron-up" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.spinValue}>{year}</Text>
          <TouchableOpacity style={styles.spinBtn} onPress={() => update(day, month, year - 1)}>
            <Feather name="chevron-down" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.modalActions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => onConfirm(partsToIso(day, month, year))}>
          <Text style={styles.primaryBtnText}>Use Date</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({"""
if old not in text:
    raise SystemExit("Could not insert TaskDatePicker component")
text = text.replace(old, new, 1)

# 8) Add styles
old = """  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    color: colors.textPrimary,
    fontSize: 16,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },"""
new = """  input: {
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
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  placeholderText: {
    color: colors.textSecondary,
  },"""
if old not in text:
    raise SystemExit("Could not add date button styles")
text = text.replace(old, new, 1)

old = """  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});"""
new = """  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalPreview: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  pickerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pickerCol: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  spinBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  spinValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: spacing.xs,
  },
});"""
if old not in text:
    raise SystemExit("Could not add picker styles")
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("task screen patch applied")
