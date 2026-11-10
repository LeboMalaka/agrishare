import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EquipmentAvailabilityCalendar } from '@/components/equipment-availability-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { createBooking, getApiErrorMessage, getEquipmentById, type Equipment } from '@/lib/api';

export default function BookingRequestScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const equipmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [requestedDate, setRequestedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    if (!equipmentId) {
      return;
    }

    void getEquipmentById(equipmentId)
      .then((result) => {
        if (active) setEquipment(result);
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
  }, [equipmentId]);

  const submit = async () => {
    setError(null);
    setSuccess(false);
    if (!equipment) return;
    if (!requestedDate) {
      setError('Choose an available date on the calendar.');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking({ equipmentId: equipment.id, requestedDate, notes });
      setSuccess(true);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && equipmentId) {
    return <ThemedView style={styles.emptyState}><ThemedText>Loading booking details…</ThemedText></ThemedView>;
  }

  if (!equipment) {
    return (
      <ThemedView style={styles.emptyState}>
        <ThemedText type="subtitle">Could not load equipment</ThemedText>
        {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
        <Link href="/equipment" asChild>
          <Pressable style={styles.secondaryButton}><ThemedText type="smallBold">Browse equipment</ThemedText></Pressable>
        </Link>
      </ThemedView>
    );
  }

  if (!user || user.role !== 'FARMER') {
    return (
      <ThemedView style={styles.emptyState}>
        <ThemedText type="subtitle">Farmer account required</ThemedText>
        <ThemedText themeColor="textSecondary">
          Sign in with a farmer account to request this equipment.
        </ThemedText>
        <Link href={{ pathname: '/auth', params: { mode: 'login' } }} asChild>
          <Pressable style={styles.submitButton}>
            <ThemedText type="smallBold" style={styles.buttonText}>Sign in to book</ThemedText>
          </Pressable>
        </Link>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <ThemedView style={styles.card}>
        <ThemedText type="title" style={styles.titleText}>Request booking</ThemedText>
        <Text style={styles.equipmentName}>{equipment.name}</Text>
        <ThemedText themeColor="textSecondary">{equipment.location}</ThemedText>

        <View style={styles.fieldGroup}>
          <ThemedText type="smallBold">Choose an available date</ThemedText>
          <EquipmentAvailabilityCalendar
            equipmentId={equipment.id}
            mode="booking"
            selectedDate={requestedDate || undefined}
            onSelectDate={setRequestedDate}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {requestedDate ? `Selected: ${requestedDate}` : 'Select a green date to continue.'}
          </ThemedText>
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText type="smallBold">Booking notes (optional)</ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={1000}
            style={[styles.input, styles.textArea]}
            placeholder="Describe what you need the equipment for"
          />
        </View>

        <View style={styles.summaryRow}>
          <ThemedText type="small">Owner</ThemedText>
          <ThemedText type="smallBold">{equipment.owner.name}</ThemedText>
        </View>
        <View style={styles.summaryRow}>
          <ThemedText type="small">Daily rate</ThemedText>
          <ThemedText type="smallBold">R{Number(equipment.pricePerDay).toFixed(2)}</ThemedText>
        </View>

        {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        {success ? (
          <ThemedView style={styles.successCard}>
            <ThemedText type="smallBold" style={styles.successText}>Request sent to the equipment owner.</ThemedText>
            <ThemedText themeColor="textSecondary">Your booking is pending owner approval.</ThemedText>
            <Pressable onPress={() => router.replace('/farmer/bookings')} style={styles.secondaryButton}>
              <ThemedText type="smallBold">View my bookings</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        <Pressable
          disabled={submitting || !requestedDate}
          style={[styles.submitButton, submitting && styles.disabledButton]}
          onPress={() => void submit()}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            {submitting ? 'Sending request…' : 'Send booking request'}
          </ThemedText>
        </Pressable>
        <Link href={{ pathname: '/equipment/[id]', params: { id: equipment.id } }} asChild>
          <Pressable style={styles.secondaryButton}>
            <ThemedText type="smallBold">Back to details</ThemedText>
          </Pressable>
        </Link>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f1',
  },
  container: {
    padding: 18,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: '#e5ebdf',
  },
  titleText: {
    fontSize: 34,
    lineHeight: 42,
  },
  equipmentName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#173f2d',
  },
  fieldGroup: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dce7db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8faf7',
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#173f2d',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.6,
  },
  secondaryButton: {
    backgroundColor: '#edf6ee',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  errorText: {
    color: '#9b2c2c',
  },
  successCard: {
    backgroundColor: '#edf6ee',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  successText: {
    color: '#173f2d',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f7f1',
    padding: 24,
    gap: 18,
  },
});
