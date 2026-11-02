import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
export default function SavedHotels() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const { isSignedIn, userId } = useAuth();
  const [rows, setRows] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (isSignedIn)
      apiFetch("/v1/me/saved-hotels")
        .then((r) => {
          if (active) setRows(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [isSignedIn, userId]);
  const remove = async (id) => {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/v1/me/saved-hotels/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setRows((list) => list.filter((h) => h.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      style={{ backgroundColor: "#FAFAFA" }}
      contentContainerStyle={{
        padding: 24,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 30,
        width: "100%",
        maxWidth: 700,
        alignSelf: "center",
        gap: 20,
      }}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ color: "#216FC4", fontSize: 16 }}>← Back</Text>
      </TouchableOpacity>
      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 28 }}>
        Saved hotels
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: "#B42318" }}>
          {error}
        </Text>
      ) : null}
      {!isSignedIn ? (
        <Text>Sign in to see your saved hotels.</Text>
      ) : rows === null ? (
        !error && <ActivityIndicator color="#489CFC" />
      ) : !rows.length ? (
        <Text>Save hotels from their details page to find them here.</Text>
      ) : (
        rows.map((h) => (
          <View
            key={h.id}
            style={{
              padding: 16,
              borderRadius: 18,
              backgroundColor: "#FFFFFF",
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => router.push(`/listingDetails/${h.id}`)}
            >
              {h.images[0] && (
                <Image
                  source={{ uri: h.images[0] }}
                  style={{ width: "100%", height: 180, borderRadius: 14 }}
                />
              )}
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 20,
                  marginTop: 12,
                }}
              >
                {h.name}
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 8 }}>{h.city}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={() => remove(h.id)}>
              <Text style={{ color: "#B42318", paddingVertical: 10 }}>
                Remove from saved hotels
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}
