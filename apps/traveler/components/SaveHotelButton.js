import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
export default function SaveHotelButton({ hotelId }) {
  const { isSignedIn, userId } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setSaved(false);
    if (isSignedIn)
      apiFetch("/v1/me/saved-hotels")
        .then((rows) => {
          if (active) {
            setSaved(rows.some((h) => h.id === hotelId));
            setLoaded(true);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [hotelId, userId, isSignedIn]);
  const toggle = async () => {
    if (!isSignedIn) {
      router.push("/(modals)/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!loaded) {
        const rows = await apiFetch("/v1/me/saved-hotels");
        setSaved(rows.some((h) => h.id === hotelId));
        setLoaded(true);
      } else {
        await apiFetch(`/v1/me/saved-hotels/${encodeURIComponent(hotelId)}`, {
          method: saved ? "DELETE" : "POST",
        });
        setSaved(!saved);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ alignSelf: "center", marginVertical: 16 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={saved ? "Remove saved hotel" : "Save hotel"}
        disabled={busy}
        onPress={toggle}
        style={{
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          padding: 12,
        }}
      >
        <Feather name="heart" size={22} color={saved ? "#D92D50" : "#216FC4"} />
        <Text style={{ color: "#216FC4", fontFamily: "Inter_500Medium" }}>
          {busy
            ? "Saving…"
            : saved
              ? "Hotel saved"
              : !loaded && error
                ? "Retry saved hotel status"
                : "Save hotel"}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={{ color: "#B42318" }}>{error}</Text> : null}
    </View>
  );
}
