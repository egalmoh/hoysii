import { useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function SearchFilters({ value, amenities, onApply, onClose }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState({
      min: "",
      max: "",
      sort: "recommended",
      verified: false,
      amenities: [],
      ...value,
    }),
    [error, setError] = useState("");
  const apply = () => {
    if (
      [draft.min, draft.max].some(
        (v) => v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0),
      ) ||
      (draft.min !== "" &&
        draft.max !== "" &&
        Number(draft.min) > Number(draft.max))
    ) {
      setError("Enter a valid minimum and maximum nightly price.");
      return;
    }
    onApply(draft);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.row}>
            <Text style={styles.title}>Filters and sorting</Text>
            <TouchableOpacity
              accessibilityLabel="Close filters"
              onPress={onClose}
            >
              <Text style={styles.link}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Sort by</Text>
          <View style={styles.row}>
            {[
              ["recommended", "Recommended"],
              ["price_low", "Lowest price"],
              ["price_high", "Highest price"],
              ["name", "Hotel name"],
            ].map(([sort, label]) => (
              <TouchableOpacity
                key={sort}
                onPress={() => setDraft({ ...draft, sort })}
                style={[styles.chip, draft.sort === sort && styles.selected]}
              >
                <Text style={styles.text}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Price per night · USD</Text>
          <View style={styles.row}>
            {["min", "max"].map((key) => (
              <TextInput
                key={key}
                accessibilityLabel={
                  key === "min"
                    ? "Minimum nightly price"
                    : "Maximum nightly price"
                }
                placeholder={key === "min" ? "Minimum" : "Maximum"}
                keyboardType="decimal-pad"
                style={styles.input}
                value={draft[key]}
                onChangeText={(text) => setDraft({ ...draft, [key]: text })}
              />
            ))}
          </View>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: draft.verified }}
            onPress={() => setDraft({ ...draft, verified: !draft.verified })}
            style={styles.chip}
          >
            <Text style={styles.text}>
              {draft.verified ? "☑" : "☐"} Verified hotels only
            </Text>
          </TouchableOpacity>
          {amenities.length > 0 && (
            <>
              <Text style={styles.label}>Amenities</Text>
              <View style={styles.row}>
                {amenities.map((amenity) => (
                  <TouchableOpacity
                    key={amenity}
                    style={[
                      styles.chip,
                      draft.amenities.includes(amenity) && styles.selected,
                    ]}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        amenities: draft.amenities.includes(amenity)
                          ? draft.amenities.filter((a) => a !== amenity)
                          : [...draft.amenities, amenity],
                      })
                    }
                  >
                    <Text style={styles.text}>{amenity}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: "#B42318" }}>
              {error}
            </Text>
          ) : null}
          <View style={styles.row}>
            <TouchableOpacity
              onPress={() => {
                setDraft({
                  min: "",
                  max: "",
                  sort: "recommended",
                  verified: false,
                  amenities: [],
                });
                setError("");
              }}
            >
              <Text style={styles.link}>Clear filters</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={apply} style={styles.button}>
              <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold" }}>
                Show hotels
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    maxWidth: 640,
    width: "100%",
    flexGrow: 0,
  },
  content: { padding: 24, gap: 20 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#111827" },
  label: { fontFamily: "Inter_500Medium", fontSize: 17, color: "#111827" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  chip: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selected: { borderColor: "#489CFC", backgroundColor: "#EFF7FF" },
  text: { fontSize: 14, color: "#374151", fontFamily: "Inter_400Regular" },
  input: {
    flex: 1,
    minWidth: 110,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#111827",
  },
  link: {
    color: "#216FC4",
    fontFamily: "Inter_500Medium",
    paddingVertical: 10,
  },
  button: { backgroundColor: "#489CFC", borderRadius: 14, padding: 16 },
});
