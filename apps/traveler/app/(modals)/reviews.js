import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
export default function MyReviews() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const { isSignedIn, userId } = useAuth();
  const [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (isSignedIn)
      apiFetch("/v1/me/reviews")
        .then((data) => {
          if (active) setRows(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [isSignedIn, userId]);
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 30 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
        style={styles.back}
      >
        <Feather name="arrow-left" size={24} color="#111827" />
        <Text style={styles.text}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Your reviews</Text>
      <Text style={styles.text}>
        Share your experience of a confirmed or completed stay.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {!isSignedIn ? (
        <Text style={styles.text}>Sign in to review your stays.</Text>
      ) : rows === null ? (
        !error && <ActivityIndicator color="#489CFC" />
      ) : rows.length === 0 ? (
        <Text style={styles.text}>
          Your paid, confirmed stays will appear here.
        </Text>
      ) : (
        rows.map((row) => <ReviewForm key={row.booking_id} row={row} />)
      )}
    </ScrollView>
  );
}
function ReviewForm({ row }) {
  const [rating, setRating] = useState(row.rating || 0),
    [comment, setComment] = useState(row.comment || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await apiFetch(
        `/v1/bookings/${encodeURIComponent(row.booking_id)}/review`,
        { method: "POST", body: JSON.stringify({ rating, comment }) },
      );
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{row.hotel_name}</Text>
      {Boolean(row.is_test) && <Text style={styles.hint}>Stakeholder test review · excluded from public ratings</Text>}
      <Text style={styles.hint}>
        {row.check_in_date} – {row.check_out_date} · {row.reference}
      </Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} stars`}
            accessibilityState={{ selected: rating === n }}
            disabled={busy}
            onPress={() => {
              setRating(n);
              setSaved(false);
            }}
            style={{ padding: 9 }}
          >
            <Feather
              name="star"
              size={28}
              color={n <= rating ? "#C57A0A" : "#9CA3AF"}
            />
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        accessibilityLabel={`Review of ${row.hotel_name}`}
        value={comment}
        onChangeText={(value) => {
          setComment(value);
          setSaved(false);
        }}
        placeholder="How was your stay?"
        maxLength={1000}
        multiline
        editable={!busy}
        textAlignVertical="top"
        style={styles.input}
      />
      <Text style={styles.hint}>
        {comment.length}/1,000 · at least 10 characters
      </Text>
      {Boolean(row.hidden) && (
        <Text style={styles.hint}>
          This review is hidden following moderation. Editing does not change
          its visibility.
        </Text>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {saved && (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          Review saved.
        </Text>
      )}
      <TouchableOpacity
        onPress={save}
        disabled={busy || !rating || comment.trim().length < 10}
        accessibilityRole="button"
        style={[
          styles.button,
          (busy || !rating || comment.trim().length < 10) && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.buttonText}>
          {busy ? "Saving…" : "Save review"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { backgroundColor: "#FAFAFA" },
  content: {
    paddingHorizontal: 20,
    gap: 18,
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 10,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#111827" },
  text: {
    fontFamily: "Inter_400Regular",
    color: "#374151",
    fontSize: 16,
    lineHeight: 24,
  },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, gap: 12 },
  heading: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#111827" },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },
  stars: { flexDirection: "row", flexWrap: "wrap" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    fontSize: 16,
    color: "#111827",
    fontFamily: "Inter_400Regular",
  },
  button: {
    backgroundColor: "#489CFC",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 16 },
  error: { color: "#B42318" },
  success: { color: "#16723D" },
});
