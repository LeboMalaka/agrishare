import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  getApiErrorMessage,
  getEquipmentAvailability,
  setEquipmentAvailability,
  type EquipmentAvailabilityCalendar as AvailabilityData,
} from '@/lib/api';
import { getLocalDateString } from '@/lib/dates';

type CalendarMode = 'booking' | 'manage';

export function EquipmentAvailabilityCalendar({
  equipmentId,
  mode,
  selectedDate,
  onSelectDate,
}: {
  equipmentId: string;
  mode: CalendarMode;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const date = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [data, setData] = useState<AvailabilityData>({ windows: [], bookedDates: [] });
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getEquipmentAvailability(equipmentId, monthKey));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [equipmentId, monthKey]);

  useEffect(() => {
    let active = true;
    void getEquipmentAvailability(equipmentId, monthKey)
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(getApiErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [equipmentId, monthKey]);

  const availabilityByDate = useMemo(
    () => new Map(data.windows.map((window) => [window.date, window])),
    [data.windows],
  );
  const blockedDates = useMemo(() => new Set(data.bookedDates), [data.bookedDates]);
  const days = useMemo(() => {
    const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
        return { date, key: getLocalDateString(date), label: String(index + 1) };
      }),
    ];
  }, [month]);

  const moveMonth = (delta: number) => {
    setSelectedDates([]);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const markSelection = async (isAvailable: boolean) => {
    if (selectedDates.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await setEquipmentAvailability(equipmentId, selectedDates, isAvailable);
      setSelectedDates([]);
      await refresh();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const today = getLocalDateString();
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} style={styles.monthButton}>
          <ThemedText type="smallBold" style={styles.monthArrow}>‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{monthLabel}</ThemedText>
        <Pressable accessibilityLabel="Next month" onPress={() => moveMonth(1)} style={styles.monthButton}>
          <ThemedText type="smallBold" style={styles.monthArrow}>›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
          <View key={weekday} style={styles.cell}>
            <ThemedText type="small" style={styles.weekday}>{weekday}</ThemedText>
          </View>
        ))}
        {days.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.cell} />;
          const window = availabilityByDate.get(day.key);
          const isBooked = blockedDates.has(day.key);
          const isUnavailable = window?.isAvailable === false;
          const isPast = day.key < today;
          const disabled = isPast || isBooked || (mode === 'booking' && isUnavailable);
          const selected = mode === 'booking'
            ? selectedDate === day.key
            : selectedDates.includes(day.key);
          return (
            <View key={day.key} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${day.key}${isBooked ? ', booked' : isUnavailable ? ', unavailable' : ', available'}`}
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                onPress={() => {
                  if (mode === 'booking') {
                    onSelectDate?.(day.key);
                  } else {
                    setSelectedDates((current) =>
                      current.includes(day.key)
                        ? current.filter((date) => date !== day.key)
                        : [...current, day.key].sort(),
                    );
                  }
                }}
                style={[
                  styles.dayButton,
                  isUnavailable && styles.unavailableDay,
                  isBooked && styles.bookedDay,
                  selected && styles.selectedDay,
                  isPast && styles.pastDay,
                ]}>
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.dayLabel,
                    selected && styles.selectedDayLabel,
                    disabled && !selected && styles.disabledLabel,
                  ]}>
                  {day.label}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </View>

      <ScrollView horizontal contentContainerStyle={styles.legend} showsHorizontalScrollIndicator={false}>
        <Legend color="#e6f4e4" label="Available" />
        <Legend color="#fff2f0" label="Unavailable" />
        <Legend color="#e7e9e5" label="Booked" />
        <Legend color="#1f5d3f" label="Selected" />
      </ScrollView>

      {mode === 'manage' ? (
        <View style={styles.manageActions}>
          <ThemedText type="small" themeColor="textSecondary">
            {selectedDates.length} date{selectedDates.length === 1 ? '' : 's'} selected
          </ThemedText>
          <View style={styles.actionRow}>
            <Pressable
              disabled={saving || selectedDates.length === 0}
              onPress={() => void markSelection(true)}
              style={[styles.availableAction, (saving || selectedDates.length === 0) && styles.disabledButton]}>
              <ThemedText type="smallBold" style={styles.availableText}>
                {saving ? 'Saving…' : 'Mark available'}
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={saving || selectedDates.length === 0}
              onPress={() => void markSelection(false)}
              style={[styles.unavailableAction, (saving || selectedDates.length === 0) && styles.disabledButton]}>
              <ThemedText type="smallBold" style={styles.unavailableText}>Mark unavailable</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
      {loading ? <ThemedText type="small" themeColor="textSecondary">Loading availability…</ThemedText> : null}
      {error ? (
        <View style={styles.errorRow}>
          <ThemedText type="small" style={styles.errorText}>{error}</ThemedText>
          <Pressable onPress={() => void refresh()}>
            <ThemedText type="smallBold" style={styles.retryText}>Retry</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <ThemedText type="small">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5ebdf',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  monthArrow: {
    fontSize: 24,
    color: '#173f2d',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    color: '#748071',
  },
  dayButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#e6f4e4',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unavailableDay: {
    backgroundColor: '#fff2f0',
  },
  bookedDay: {
    backgroundColor: '#e7e9e5',
  },
  selectedDay: {
    backgroundColor: '#1f5d3f',
    borderColor: '#173f2d',
  },
  pastDay: {
    opacity: 0.45,
  },
  dayLabel: {
    color: '#173f2d',
  },
  selectedDayLabel: {
    color: '#ffffff',
  },
  disabledLabel: {
    color: '#748071',
  },
  legend: {
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  manageActions: {
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availableAction: {
    flex: 1,
    alignItems: 'center',
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#e6f4e4',
  },
  availableText: {
    color: '#173f2d',
  },
  unavailableAction: {
    flex: 1,
    alignItems: 'center',
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#fff2f0',
  },
  unavailableText: {
    color: '#9b2c2c',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorRow: {
    gap: 6,
  },
  errorText: {
    color: '#9b2c2c',
  },
  retryText: {
    color: '#1f5d3f',
  },
});
