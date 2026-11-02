import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
export default function HotelReviews({ hotelId }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch(`/v1/hotels/${encodeURIComponent(hotelId)}/reviews`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [hotelId]);
  const more = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await apiFetch(
        `/v1/hotels/${encodeURIComponent(hotelId)}/reviews?offset=${data?.next_offset || 0}`,
      );
      setData((previous) => ({
        ...next,
        reviews: data?.next_offset
          ? [...previous.reviews, ...next.reviews]
          : next.reviews,
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Guest reviews</Text>
      {error ? (
        <TouchableOpacity onPress={more}>
          <Text style={styles.text}>Reviews unavailable. Tap to retry.</Text>
        </TouchableOpacity>
      ) : data === null ? (
        <ActivityIndicator color="#489CFC" />
      ) : (
        <>
          {data.count > 0 ? (
            <Text style={styles.text}>
              {data.average} / 5 · {data.count}{" "}
              {data.count === 1 ? "review" : "reviews"} from booked guests
            </Text>
          ) : (
            <Text style={styles.text}>No guest reviews yet.</Text>
          )}
          {data.reviews.map((r) => (
            <View key={r.id} style={styles.review}>
              <Text style={styles.author}>
                {r.author} · {r.rating}/5
              </Text>
              <Text style={styles.text}>{r.comment}</Text>
              <Text style={styles.date}>{r.created_at.slice(0, 10)}</Text>
            </View>
          ))}
          {data.next_offset !== null && (
            <TouchableOpacity disabled={busy} onPress={more}>
              <Text style={styles.link}>
                {busy ? "Loading…" : "Show more reviews"}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 24,
    gap: 12,
  },
  heading: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#111827" },
  review: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 8,
  },
  author: { fontFamily: "Inter_500Medium", fontSize: 16, color: "#111827" },
  text: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: "#4B5563",
  },
  date: { fontSize: 12, color: "#6B7280" },
  link: {
    fontFamily: "Inter_500Medium",
    color: "#216FC4",
    paddingVertical: 12,
  },
});
