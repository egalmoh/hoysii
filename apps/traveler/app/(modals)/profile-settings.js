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
export default function ProfileSettings() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const [profile, setProfile] = useState(null),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (isSignedIn)
      apiFetch("/v1/me")
        .then((data) => {
          if (active) {
            setProfile(data);
            setName(data.profile.full_name || data.user.name);
            setPhone(data.profile.phone_number || "");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [isSignedIn]);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: name, phone_number: phone }),
      });
      setNotice("Profile updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      style={{ backgroundColor: "#FAFAFA" }}
      contentContainerStyle={[
        styles.page,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 30 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.back}
      >
        <Feather name="arrow-left" size={24} color="#111827" />
        <Text style={styles.label}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Profile settings</Text>
      {!isSignedIn ? (
        <Text style={styles.label}>Sign in to edit your profile.</Text>
      ) : (
        <>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={styles.success}>
              {notice}
            </Text>
          ) : null}
          {!profile ? (
            !error && <ActivityIndicator color="#489CFC" />
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                accessibilityLabel="Full name"
                style={styles.input}
                value={name}
                onChangeText={setName}
                maxLength={120}
                autoComplete="name"
                editable={!busy}
              />
              <Text style={styles.label}>Email</Text>
              <Text style={[styles.input, { color: "#6B7280" }]}>
                {profile.user.email}
              </Text>
              <Text style={styles.hint}>Your verified sign-in email.</Text>
              <Text style={styles.label}>Phone number (optional)</Text>
              <TextInput
                accessibilityLabel="Phone number"
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                maxLength={50}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="+252…"
                editable={!busy}
              />
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy || !name.trim()}
                onPress={save}
                style={[
                  styles.button,
                  (busy || !name.trim()) && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.buttonText}>
                  {busy ? "Saving…" : "Save changes"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    gap: 20,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 10,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#111827" },
  form: { gap: 12 },
  label: { fontFamily: "Inter_500Medium", fontSize: 16, color: "#111827" },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#111827",
  },
  hint: { fontSize: 14, color: "#6B7280", marginBottom: 12 },
  button: {
    backgroundColor: "#489CFC",
    padding: 17,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  error: { color: "#B42318", fontSize: 16 },
  success: { color: "#16723D", fontSize: 16 },
});
