import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import MapView, { Marker, Polygon, Callout, Circle } from "react-native-maps";
import * as Location from "expo-location";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../../firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { showNotificationNow } from "../../notifications";
import {
  SEARCH_RADIUS_METRES,
  distanceInMetres,
  fetchNearbyCrime,
  formatMonth,
} from "../../policeData";

import { useTheme } from "../../theme";

const defaultRegion = {
  latitude: 51.5,
  longitude: -0.12,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

// Traffic-light colours for risk levels. These mean the same thing in both
// themes, so they don't change with the light/dark setting.
const colorMap = {
  green: "#4caf50",
  amber: "#ff9800",
  red: "#f44336",
};

// Colour used when an area has a risk level the app doesn't recognise
const UNKNOWN_COLOR = "#9e9e9e";

// How the "recorded crime nearby" level is shown on the summary card
const LEVELS = {
  low: { label: "Low", color: colorMap.green },
  medium: { label: "Medium", color: colorMap.amber },
  high: { label: "High", color: colorMap.red },
};

const MAX_HOTSPOTS_ON_MAP = 40;
const MAX_REPORTS_ON_MAP = 50;
const REPORT_WINDOW_DAYS = 30;

// How far the map has to move before "Search this area" is offered
const SEARCH_AGAIN_METRES = 800;

function toRegion(coords) {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };
}

// Resolves with the promise's value, or with null if it takes longer than `ms`
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Firestore timestamps are null for a moment while a new report is being saved
function formatTimestamp(timestamp) {
  return timestamp && typeof timestamp.toDate === "function"
    ? timestamp.toDate().toLocaleString()
    : "Just now";
}

// Reports are visible to other users, so their location is rounded to roughly
// 100 metres. The exact spot is often the reporter's own front door.
function roundCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}

// Hotspot circles grow and turn redder with the number of crimes recorded there
function hotspotStyle(count) {
  const color = count >= 6 ? colorMap.red : count >= 3 ? colorMap.amber : "#ffd54f";
  return {
    radius: Math.min(40 + 18 * Math.sqrt(count), 160),
    fillColor: color + "55",
    strokeColor: color,
  };
}

// Point-in-polygon ray-casting function
function pointInPolygon(point, polygon) {
  let x = point.longitude;
  let y = point.latitude;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].longitude,
      yi = polygon[i].latitude;
    let xj = polygon[j].longitude,
      yj = polygon[j].latitude;

    let intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function AwarenessMap() {
  const { colors: COLORS, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [userLocation, setUserLocation] = useState(defaultRegion);
  const [riskAreas, setRiskAreas] = useState([]);
  const [areaPolygons, setAreaPolygons] = useState({});
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [areaReports, setAreaReports] = useState([]);
  const [user, setUser] = useState(null);

  // Modal & Report form state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Police data: the point it was fetched for, and the result
  const [searchCentre, setSearchCentre] = useState(null);
  const [police, setPolice] = useState({ status: "idle", data: null, error: null });
  const [policeRetry, setPoliceRetry] = useState(0);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Community reports shown as pins, and where the map is currently centred
  const [recentReports, setRecentReports] = useState([]);
  const [mapCentre, setMapCentre] = useState(null);

  const mapRef = useRef(null);
  const lastAlertTimeRef = useRef(0);

  // The user's postcode area, used for nearby alerts. Not set yet: it still
  // has to come from reverse geocoding the user's location.
  const userPostcode = null;

  // Track auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribeAuth();
  }, []);

  // Request user location and centre the map on it
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (status !== "granted") {
          setModalMessage("Location permission was not granted, so the map is showing the default area.");
          setModalVisible(true);
          return;
        }

        // A fresh GPS fix can take a long time indoors (or never arrive), so
        // start from the last known position and give the live fix a time limit.
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (cancelled) return;

        if (lastKnown) {
          setUserLocation(toRegion(lastKnown.coords));
          setLoading(false);
        }

        const current = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          10000
        );
        if (cancelled) return;

        if (current) {
          setUserLocation(toRegion(current.coords));
        } else if (!lastKnown) {
          setModalMessage("Couldn't get your location in time, so the map is showing the default area.");
          setModalVisible(true);
        }
      } catch (error) {
        if (cancelled) return;
        setModalMessage("Error getting location: " + error.message);
        setModalVisible(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Once the location is settled, move the map there and use it as the centre
  // for police data. A small change (last known position -> live fix) does not
  // trigger a second download.
  useEffect(() => {
    if (loading) return;

    if (mapRef.current) {
      mapRef.current.animateToRegion(userLocation, 800);
    }

    setSearchCentre((previous) =>
      !previous || distanceInMetres(previous, userLocation) > 300
        ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
        : previous
    );
  }, [loading, userLocation]);

  // Load police-recorded crime around the search centre
  useEffect(() => {
    if (!user || !searchCentre) return;

    let cancelled = false;
    setPolice({ status: "loading", data: null, error: null });

    fetchNearbyCrime(searchCentre.latitude, searchCentre.longitude)
      .then((data) => {
        if (!cancelled) setPolice({ status: "ready", data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setPolice({ status: "error", data: null, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [user, searchCentre, policeRetry]);

  // Load polygons dynamically from Firestore
  useEffect(() => {
    if (!user) {
      setRiskAreas([]);
      setAreaPolygons({});
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, "area_risk_scores"),
      (snap) => {
        const areas = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRiskAreas(areas);

        const polygons = {};
        areas.forEach((area) => {
          polygons[area.id] = Array.isArray(area.polygonCoords) ? area.polygonCoords : [];
        });
        setAreaPolygons(polygons);
      },
      (error) => {
        console.warn("Risk areas listener failed:", error.message);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Live feed of the most recent community reports, shown as pins on the map
  useEffect(() => {
    if (!user) {
      setRecentReports([]);
      return;
    }
    const q = query(
      collection(db, "awarenessReports"),
      orderBy("timestamp", "desc"),
      limit(MAX_REPORTS_ON_MAP)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setRecentReports(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.warn("Community reports listener failed:", error.message);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Load recent reports for selected area
  useEffect(() => {
    if (!user || !selectedAreaId) {
      setAreaReports([]);
      return;
    }
    const q = query(
      collection(db, "awarenessReports"),
      where("location.areaId", "==", selectedAreaId),
      orderBy("timestamp", "desc"),
      limit(5)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const reports = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAreaReports(reports);
      },
      (error) => {
        // "failed-precondition" here means the Firestore index for this query
        // has not been created yet (see firestore.indexes.json).
        console.warn("Area reports listener failed:", error.message);
      }
    );
    return () => unsubscribe();
  }, [selectedAreaId, user]);

  // Alert for new reports in user's postcode area with a local notification.
  // Stays switched off until userPostcode is set (see the TODO above).
  useEffect(() => {
    if (!user || !userPostcode) return;

    const q = query(
      collection(db, "awarenessReports"),
      where("location.postcode", "==", userPostcode),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    // The first snapshot is the report that already existed when the map
    // opened, so only alert for reports that arrive after it.
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }

        snap.docChanges().forEach((change) => {
          const isOwnReport = change.doc.data().userId === user.uid;
          if (change.type === "added" && !isOwnReport) {
            const now = Date.now();
            if (now - lastAlertTimeRef.current > 60000) {
              showNotificationNow({
                title: "Suspicious Activity Alert",
                body: "New suspicious activity reported in your area!",
                sound: true,
              }).catch((error) => {
                console.warn("Could not show alert notification:", error.message);
              });
              lastAlertTimeRef.current = now;
            }
          }
        });
      },
      (error) => {
        console.warn("Postcode alerts listener failed:", error.message);
      }
    );

    return () => unsubscribe();
  }, [user, userPostcode]);

  // Reports that have a position, ready to draw as pins
  const reportPins = useMemo(
    () =>
      recentReports
        .filter(
          (report) =>
            report.location &&
            typeof report.location.latitude === "number" &&
            typeof report.location.longitude === "number"
        )
        .map((report) => ({
          id: report.id,
          description: report.description || "No description",
          when: formatTimestamp(report.timestamp),
          color: colorMap[report.aiRiskScore] || COLORS.primary,
          timestamp: report.timestamp,
          coordinate: {
            latitude: roundCoordinate(report.location.latitude),
            longitude: roundCoordinate(report.location.longitude),
          },
        })),
    [recentReports, COLORS]
  );

  // How many community reports were made near the search centre recently
  const nearbyReportCount = useMemo(() => {
    if (!searchCentre) return 0;
    const cutoff = Date.now() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    return reportPins.filter((pin) => {
      const time =
        pin.timestamp && typeof pin.timestamp.toDate === "function"
          ? pin.timestamp.toDate().getTime()
          : Date.now(); // still saving, so it was made just now
      return time >= cutoff && distanceInMetres(searchCentre, pin.coordinate) <= SEARCH_RADIUS_METRES;
    }).length;
  }, [reportPins, searchCentre]);

  const hotspots = police.data ? police.data.hotspots.slice(0, MAX_HOTSPOTS_ON_MAP) : [];

  // Offer "Search this area" once the map has been moved well away from the
  // point the police data was loaded for
  const canSearchHere =
    police.status !== "loading" &&
    mapCentre &&
    searchCentre &&
    distanceInMetres(mapCentre, searchCentre) > SEARCH_AGAIN_METRES;

  async function submitReport() {
    if (!reportDescription.trim()) {
      setModalMessage("Please enter a description for your report.");
      setModalVisible(true);
      return;
    }

    setReportSubmitting(true);

    try {
      // Find areaId by checking which polygon contains the user's location
      let areaId = null;
      for (const area of riskAreas) {
        const polygon = areaPolygons[area.id] || [];
        if (polygon.length > 2 && pointInPolygon(userLocation, polygon)) {
          areaId = area.id;
          break;
        }
      }

      const reportsRef = collection(db, "awarenessReports");
      await addDoc(reportsRef, {
        description: reportDescription.trim(),
        timestamp: serverTimestamp(),
        location: {
          // Rounded to roughly 100 metres so the exact address is not shared
          latitude: roundCoordinate(userLocation.latitude),
          longitude: roundCoordinate(userLocation.longitude),
          areaId: areaId, // could be null if outside polygons
        },
        userId: user.uid,
      });
      setModalMessage("Report submitted successfully!");
      setReportDescription("");
      setModalVisible(true);
    } catch (error) {
      setModalMessage("Error submitting report: " + error.message);
      setModalVisible(true);
    } finally {
      setReportSubmitting(false);
    }
  }

  const selectedArea = riskAreas.find((a) => a.id === selectedAreaId);

  if (!user) {
    return (
      <View style={styles.centeredView}>
        <Text style={styles.centeredText}>Please sign in to view the awareness map.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centeredView}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.centeredText, { marginTop: 10 }]}>Loading your location...</Text>
      </View>
    );
  }

  const level = police.data ? LEVELS[police.data.level] : null;
  const monthLabel = police.data ? formatMonth(police.data.month) : "";

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={userLocation}
        showsUserLocation={true}
        showsMyLocationButton={true}
        userInterfaceStyle={isDark ? "dark" : "light"}
        onRegionChangeComplete={(region) =>
          setMapCentre({ latitude: region.latitude, longitude: region.longitude })
        }
      >
        {riskAreas
          // A polygon needs at least three points to be drawn
          .filter((area) => (areaPolygons[area.id] || []).length > 2)
          .map((area) => {
            const areaColor = colorMap[area.color] || UNKNOWN_COLOR;
            return (
              <Polygon
                key={area.id}
                coordinates={areaPolygons[area.id]}
                fillColor={areaColor + "66"} // 40% opacity
                strokeColor={areaColor}
                strokeWidth={2}
                tappable
                onPress={() => setSelectedAreaId(area.id)}
              />
            );
          })}

        {/* Police-recorded crime: one circle per street point, busiest first */}
        {hotspots.map((hotspot) => {
          const style = hotspotStyle(hotspot.count);
          return (
            <Circle
              key={"hotspot-" + hotspot.id}
              center={{ latitude: hotspot.latitude, longitude: hotspot.longitude }}
              radius={style.radius}
              fillColor={style.fillColor}
              strokeColor={style.strokeColor}
              strokeWidth={1}
            />
          );
        })}

        {/* Community reports: tap a pin to read the report */}
        {reportPins.map((pin) => (
          <Marker
            key={"report-" + pin.id}
            coordinate={pin.coordinate}
            pinColor={pin.color}
            title="Community report"
            description={`${pin.description} (${pin.when})`}
          />
        ))}

        {selectedArea && (
          <Marker
            coordinate={(areaPolygons[selectedArea.id] || [])[0] || userLocation}
            pinColor={colorMap[selectedArea.color] || UNKNOWN_COLOR}
          >
            <Callout onPress={() => setSelectedAreaId(null)} style={styles.callout}>
              <View style={{ maxWidth: 250 }}>
                <Text style={styles.title}>Area: {selectedArea.id}</Text>
                <Text>
                  Risk Level: <Text style={{ fontWeight: "bold" }}>{selectedArea.color}</Text>
                </Text>
                <Text>Reason: {selectedArea.reason || "No details"}</Text>
                <Text style={styles.subtitle}>Recent Reports:</Text>
                {areaReports.length === 0 ? (
                  <Text>No recent reports.</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 100 }}>
                    {areaReports.map((r) => (
                      <Text key={r.id} style={styles.reportText}>
                        • {r.description} —{" "}
                        {formatTimestamp(r.timestamp)}
                      </Text>
                    ))}
                  </ScrollView>
                )}
                <Text style={styles.closeText}>(Tap here to close)</Text>
              </View>
            </Callout>
          </Marker>
        )}
      </MapView>

      {/* Summary card: police data and community reports for this area */}
      <TouchableOpacity
        style={styles.summaryCard}
        activeOpacity={0.85}
        onPress={() => {
          if (police.status === "error") setPoliceRetry((count) => count + 1);
          else if (police.status === "ready") setDetailsVisible(true);
        }}
      >
        {(police.status === "idle" || police.status === "loading") && (
          <View style={styles.summaryRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={[styles.summaryText, { marginLeft: 8 }]}>Loading police data for this area...</Text>
          </View>
        )}

        {police.status === "error" && (
          <>
            <Text style={styles.summaryTitle}>Couldn't load police data</Text>
            <Text style={styles.summaryText}>{police.error} Tap to try again.</Text>
          </>
        )}

        {police.status === "ready" && (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.levelDot, { backgroundColor: level.color }]} />
              <Text style={styles.summaryTitle}>Recorded crime nearby: {level.label}</Text>
            </View>
            <Text style={styles.summaryText}>
              {police.data.total === 0
                ? `No doorstep-related crimes recorded within 1 mile in ${monthLabel}`
                : `${police.data.total} doorstep-related crimes within 1 mile in ${monthLabel}`}
            </Text>
            {police.data.categories.length > 0 && (
              <Text style={styles.summaryText}>
                {police.data.categories
                  .slice(0, 3)
                  .map((category) => `${category.label} ${category.count}`)
                  .join(" · ")}
              </Text>
            )}
            <Text style={styles.summaryText}>
              Community reports nearby ({REPORT_WINDOW_DAYS} days): {nearbyReportCount}
            </Text>
            <Text style={styles.summaryHint}>Tap for details</Text>
          </>
        )}
      </TouchableOpacity>

      {canSearchHere && (
        <TouchableOpacity style={styles.searchHereButton} onPress={() => setSearchCentre(mapCentre)}>
          <Text style={styles.searchHereText}>Search this area</Text>
        </TouchableOpacity>
      )}

      {/* Make Report Button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => {
          setModalMessage("");
          setModalVisible(true);
        }}
      >
        <Text style={styles.reportButtonText}>Make a Report</Text>
      </TouchableOpacity>

      {/* Details behind the summary card */}
      <Modal
        visible={detailsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {police.data && (
              <ScrollView style={{ maxHeight: 420, width: "100%" }}>
                <Text style={[styles.modalText, { fontWeight: "bold", fontSize: 16 }]}>
                  Recorded crime within 1 mile
                </Text>
                <Text style={styles.detailText}>{monthLabel}, doorstep-related types only</Text>

                {police.data.categories.length === 0 ? (
                  <Text style={styles.detailText}>Nothing recorded.</Text>
                ) : (
                  police.data.categories.map((category) => (
                    <View key={category.key} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{category.label}</Text>
                      <Text style={styles.detailValue}>{category.count}</Text>
                    </View>
                  ))
                )}

                {police.data.hotspots.length > 0 && (
                  <>
                    <Text style={styles.detailHeading}>Busiest locations</Text>
                    {police.data.hotspots.slice(0, 5).map((hotspot) => (
                      <View key={hotspot.id} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{hotspot.street}</Text>
                        <Text style={styles.detailValue}>{hotspot.count}</Text>
                      </View>
                    ))}
                  </>
                )}

                <Text style={styles.detailHeading}>Community reports</Text>
                <Text style={styles.detailText}>
                  {nearbyReportCount} within 1 mile in the last {REPORT_WINDOW_DAYS} days
                </Text>

                <Text style={styles.detailSource}>
                  Crime data from data.police.uk under the Open Government Licence v3.0. Locations are
                  approximate, and the level shown is a rough guide based on the number of crimes
                  recorded, not an official rating.
                </Text>
              </ScrollView>
            )}

            <TouchableOpacity onPress={() => setDetailsVisible(false)} style={styles.modalButton}>
              <Text style={{ color: COLORS.primary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal for error/info messages and reporting */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* If modalMessage is set, show it, else show form */}
            {modalMessage ? (
              <>
                <Text style={styles.modalText}>{modalMessage}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setModalMessage("");
                    setModalVisible(false);
                  }}
                  style={styles.modalButton}
                >
                  <Text style={{ color: COLORS.primary }}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.modalText, { fontWeight: "bold" }]}>New Report</Text>

                <TextInput
                  style={styles.textInput}
                  placeholder="Describe the suspicious activity"
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  editable={!reportSubmitting}
                />

                <Text style={styles.privacyNote}>
                  Your report appears on the map for other users, placed to within about 100 metres.
                </Text>

                <TouchableOpacity
                  onPress={submitReport}
                  style={[styles.modalButton, { opacity: reportSubmitting ? 0.6 : 1 }]}
                  disabled={reportSubmitting}
                >
                  <Text style={{ color: COLORS.primary }}>
                    {reportSubmitting ? "Submitting..." : "Submit"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={[styles.modalButton, { marginTop: 10 }]}
                  disabled={reportSubmitting}
                >
                  <Text style={{ color: COLORS.danger }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  map: {
    flex: 1,
  },
  callout: {
    width: 250,
  },
  title: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 4,
  },
  subtitle: {
    marginTop: 8,
    fontWeight: "bold",
  },
  reportText: {
    fontSize: 14,
  },
  closeText: {
    marginTop: 8,
    fontSize: 12,
    color: "grey",
    fontStyle: "italic",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  centeredText: {
    color: COLORS.textSecondary,
  },
  summaryCard: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: COLORS.background + "EE",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    elevation: 5,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  levelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  summaryTitle: {
    color: COLORS.textPrimary,
    fontWeight: "bold",
    fontSize: 15,
  },
  summaryText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  summaryHint: {
    color: COLORS.primary,
    fontSize: 12,
    marginTop: 4,
  },
  searchHereButton: {
    position: "absolute",
    bottom: 30,
    left: 20,
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.primary,
    elevation: 5,
  },
  searchHereText: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    padding: 20,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
  },
  modalText: {
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  detailHeading: {
    color: COLORS.textPrimary,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  detailLabel: {
    color: COLORS.textSecondary,
    flex: 1,
    paddingRight: 10,
  },
  detailValue: {
    color: COLORS.textPrimary,
    fontWeight: "bold",
  },
  detailText: {
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  detailSource: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 16,
  },
  privacyNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  modalButton: {
    marginTop: 20,
  },
  textInput: {
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    minHeight: 80,
    width: "100%",
    color: COLORS.textPrimary,
    backgroundColor: COLORS.card,
  },
  reportButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 5,
  },
  reportButtonText: {
    color: COLORS.onPrimary,
    fontWeight: "bold",
  },
});
