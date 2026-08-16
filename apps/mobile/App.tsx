import { useEffect, useMemo, useState } from "react";
import {
  Alert, Pressable, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, View, StatusBar, Image, Platform
} from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import * as Application from "expo-application";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initDatabase, listQueuedScans, queueScan, syncQueuedScans } from "./src/offline-checkin";
import { DEFAULT_API_URL, MobileUser, fetchCurrentUser, loginWithPassword, normalizeApiUrl, registerMobileDevice } from "./src/mobile-auth";

const ORANGE = "#F97316";
const ORANGE_DARK = "#EA6C0A";
const ORANGE_LIGHT = "#FFF7ED";
const GRAY_BG = "#F5F5F5";
const DARK_TEXT = "#1C1917";
const MID_TEXT = "#78716C";
const BORDER = "#E7E5E4";
const ACCESS_TOKEN_KEY = "eventflow.mobile.accessToken";
const API_URL_KEY = "eventflow.mobile.apiUrl";
const EVENT_ID_KEY = "eventflow.mobile.eventId";
const DEVICE_ID_KEY = "eventflow.mobile.deviceId";

// ── Tela ativa (bottom nav) ─────────────────────────────────
type Tab = "home" | "check-in" | "sync" | "perfil";

type LoginScreenProps = {
  apiUrl: string;
  setApiUrl: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  loading: boolean;
  onLogin: () => void;
};

type CheckInTabProps = {
  apiUrl: string;
  setApiUrl: (value: string) => void;
  eventId: string;
  setEventId: (value: string) => void;
  deviceId: string;
  setDeviceId: (value: string) => void;
  queue: number;
  online: boolean;
  cameraAllowed: boolean;
  scanning: boolean;
  lastScan?: string;
  ready: boolean;
  onStartScan: () => void;
  onBarCodeScanned: (event: { data: string }) => void;
};

type SyncTabProps = {
  queue: number;
  online: boolean;
  ready: boolean;
  onSync: () => void;
};

export default function App() {
  const [tab, setTab] = useState<Tab>("check-in");
  const [apiUrl, setApiUrlState] = useState(DEFAULT_API_URL);
  const [token, setToken] = useState("");
  const [user, setUser] = useState<MobileUser>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [eventId, setEventId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [queue, setQueue] = useState(0);
  const [online, setOnline] = useState(false);
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string>();

  const ready = useMemo(() => Boolean(token && eventId && deviceId), [deviceId, eventId, token]);

  useEffect(() => {
    void bootstrap();
    void BarCodeScanner.requestPermissionsAsync().then((result) => setCameraAllowed(result.status === "granted"));
    void Network.getNetworkStateAsync().then((state) => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false)));
  }, []);

  async function bootstrap() {
    await initDatabase();
    await refreshQueue();

    const [storedToken, storedApiUrl, storedEventId, storedDeviceId] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      AsyncStorage.getItem(API_URL_KEY),
      AsyncStorage.getItem(EVENT_ID_KEY),
      AsyncStorage.getItem(DEVICE_ID_KEY)
    ]);
    const normalizedApiUrl = normalizeApiUrl(storedApiUrl);
    const resolvedDeviceId = storedDeviceId || Application.applicationId || "eventflow-mobile";

    setApiUrlState(normalizedApiUrl);
    setEventId(storedEventId ?? "");
    setDeviceId(resolvedDeviceId);

    if (storedToken) {
      try {
        const currentUser = await fetchCurrentUser(normalizedApiUrl, storedToken);
        setToken(storedToken);
        setUser(currentUser);
      } catch {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      }
    }

    setLoadingSession(false);
  }

  async function refreshQueue() {
    const queued = await listQueuedScans();
    setQueue(queued.length);
  }

  async function handleScan(data: string) {
    if (!ready || !scanning) return;
    setScanning(false);
    const ticketUuid = parseTicketUuid(data);
    await queueScan({ eventId, ticketUuid, deviceId, scannedAt: new Date().toISOString(), rawPayload: data });
    setLastScan(ticketUuid);
    await refreshQueue();
  }

  async function sync() {
    if (!ready) {
      Alert.alert("Configuração incompleta", "Entre na conta e informe evento/device antes de sincronizar.");
      return;
    }
    const result = await syncQueuedScans({ apiUrl: normalizeApiUrl(apiUrl), token, eventId, deviceId });
    await refreshQueue();
    Alert.alert("Sincronização concluída", `${result.acceptedScans ?? 0} entradas aceitas, ${result.conflictScans ?? 0} conflitos.`);
  }

  async function login() {
    setLoginLoading(true);
    try {
      const result = await loginWithPassword(apiUrl, { email, password });
      await registerMobileDevice(apiUrl, result.accessToken, {
        id: deviceId,
        platform: Platform.OS,
        deviceName: Application.applicationName ?? "Event Flow Check-in",
        appVersion: Application.nativeApplicationVersion ?? "0.1.0"
      });
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, result.accessToken);
      await AsyncStorage.setItem(API_URL_KEY, normalizeApiUrl(apiUrl));
      setToken(result.accessToken);
      setUser(result.user);
      setPassword("");
    } catch (error) {
      Alert.alert("Falha ao entrar", error instanceof Error ? error.message : "Confira e-mail, senha e ambiente.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    setToken("");
    setUser(undefined);
    setPassword("");
    setTab("check-in");
  }

  function setApiUrl(value: string) {
    setApiUrlState(value);
    void AsyncStorage.setItem(API_URL_KEY, normalizeApiUrl(value));
  }

  function persistEventId(value: string) {
    setEventId(value);
    void AsyncStorage.setItem(EVENT_ID_KEY, value);
  }

  function persistDeviceId(value: string) {
    setDeviceId(value);
    void AsyncStorage.setItem(DEVICE_ID_KEY, value);
  }

  if (loadingSession) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar backgroundColor={ORANGE} barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>EVENTFLOW</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.emptyScannerEmoji}>🔒</Text>
          <Text style={styles.emptyScannerText}>Carregando sessão segura...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar backgroundColor={ORANGE} barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ENTRAR</Text>
        </View>
        <LoginScreen
          apiUrl={apiUrl}
          setApiUrl={setApiUrl}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          loading={loginLoading}
          onLogin={() => void login()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={ORANGE} barStyle="light-content" />

      {/* ── HEADER ───────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {tab === "home" ? "HOME" :
           tab === "check-in" ? "CHECK-IN" :
           tab === "sync" ? "SINCRONIZAR" : "PERFIL"}
        </Text>
      </View>

      {/* ── CONTEÚDO ─────────────────────────────────────── */}
      {tab === "home" && <HomeTab />}
      {tab === "check-in" && (
        <CheckInTab
          apiUrl={apiUrl} setApiUrl={setApiUrl}
          eventId={eventId} setEventId={persistEventId}
          deviceId={deviceId} setDeviceId={persistDeviceId}
          queue={queue} online={online} cameraAllowed={cameraAllowed}
          scanning={scanning} lastScan={lastScan}
          ready={ready}
          onStartScan={() => setScanning(true)}
          onBarCodeScanned={(event: { data: string }) => void handleScan(event.data)}
        />
      )}
      {tab === "sync" && (
        <SyncTab queue={queue} online={online} ready={ready} onSync={() => void sync()} />
      )}
      {tab === "perfil" && <PerfilTab user={user} deviceId={deviceId} apiUrl={apiUrl} onLogout={() => void logout()} />}

      {/* ── BOTTOM NAV ───────────────────────────────────── */}
      <View style={styles.bottomNav}>
        {[
          { id: "home", label: "Home", emoji: "🏠" },
          { id: "check-in", label: "Check-in", emoji: "📷" },
          { id: "sync", label: "Sync", emoji: "🔄" },
          { id: "perfil", label: "Perfil", emoji: "👤" },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              style={styles.navItem}
              onPress={() => setTab(item.id as Tab)}
            >
              <View style={[styles.navIconBg, active && styles.navIconBgActive]}>
                <Text style={styles.navEmoji}>{item.emoji}</Text>
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ── TELA: LOGIN ───────────────────────────────────────────────
function LoginScreen({
  apiUrl, setApiUrl, email, setEmail, password, setPassword, loading, onLogin
}: LoginScreenProps) {
  const canSubmit = Boolean(normalizeApiUrl(apiUrl) && email.trim() && password.length >= 8 && !loading);

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔒  Acesso do operador</Text>
        <Field label="Ambiente da API">
          <TextInput
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://api.seudominio.com/api"
            style={styles.input}
            placeholderTextColor={MID_TEXT}
          />
        </Field>
        <Field label="E-mail">
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="operador@evento.com"
            style={styles.input}
            placeholderTextColor={MID_TEXT}
          />
        </Field>
        <Field label="Senha">
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="mínimo 8 caracteres"
            style={styles.input}
            placeholderTextColor={MID_TEXT}
          />
        </Field>
      </View>

      <Pressable
        style={[styles.btnPrimary, !canSubmit && styles.btnDisabled]}
        disabled={!canSubmit}
        onPress={onLogin}
      >
        <Text style={styles.btnPrimaryText}>{loading ? "Entrando..." : "Entrar"}</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── TAB: HOME ─────────────────────────────────────────────────
function HomeTab() {
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionTitle}>Bem-vindo ao Event Flow</Text>
      <Text style={styles.sectionSubtitle}>App de check-in offline para organizadores</Text>

      <View style={styles.featureCard}>
        <Text style={styles.featureEmoji}>📷</Text>
        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>Check-in por QR Code</Text>
          <Text style={styles.featureDesc}>Leia QR Codes dos ingressos mesmo sem internet</Text>
        </View>
      </View>

      <View style={styles.featureCard}>
        <Text style={styles.featureEmoji}>🔄</Text>
        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>Sincronização inteligente</Text>
          <Text style={styles.featureDesc}>Os dados ficam em fila e sincronizam quando a rede retornar</Text>
        </View>
      </View>

      <View style={styles.featureCard}>
        <Text style={styles.featureEmoji}>📊</Text>
        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>Relatórios em tempo real</Text>
          <Text style={styles.featureDesc}>Acompanhe entradas e vendas pelo painel web</Text>
        </View>
      </View>

      <View style={styles.featureCard}>
        <Text style={styles.featureEmoji}>🔒</Text>
        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>Seguro e confiável</Text>
          <Text style={styles.featureDesc}>Detecção de duplicatas e conflitos automáticos</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ── TAB: CHECK-IN ─────────────────────────────────────────────
function CheckInTab({
  apiUrl, setApiUrl, eventId, setEventId, deviceId, setDeviceId,
  queue, online, cameraAllowed, scanning, lastScan, ready,
  onStartScan, onBarCodeScanned
}: CheckInTabProps) {
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Status cards */}
      <View style={styles.metricsRow}>
        <MetricChip label="Fila" value={String(queue)} warn={queue > 0} />
        <MetricChip label="Rede" value={online ? "Online" : "Offline"} warn={!online} />
        <MetricChip label="Câmera" value={cameraAllowed ? "OK" : "Negada"} warn={!cameraAllowed} />
        <MetricChip label="Status" value={ready ? "Pronto" : "Setup"} warn={!ready} />
      </View>

      {/* Configuração */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️  Configuração</Text>
        <Field label="Ambiente da API">
          <TextInput
            value={apiUrl} onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://api.seudominio.com/api"
            style={styles.input}
            placeholderTextColor={MID_TEXT}
          />
        </Field>
        <Field label="ID do Evento">
          <TextInput
            value={eventId} onChangeText={setEventId}
            placeholder="eventId" style={styles.input}
            placeholderTextColor={MID_TEXT}
          />
        </Field>
        <Field label="Device ID">
          <TextInput
            value={deviceId} onChangeText={setDeviceId}
            placeholder="deviceId" style={styles.input}
            placeholderTextColor={MID_TEXT}
          />
        </Field>
      </View>

      {/* Scanner */}
      {scanning && cameraAllowed ? (
        <View style={styles.scanner}>
          <BarCodeScanner
            onBarCodeScanned={onBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerHint}>Aponte para o QR Code do ingresso</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyScanner}>
          <Text style={styles.emptyScannerEmoji}>📷</Text>
          <Text style={styles.emptyScannerText}>
            {lastScan ? `Último scan: ${lastScan.slice(0, 8).toUpperCase()}` : "Scanner pausado"}
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.btnPrimary, !ready && styles.btnDisabled]}
        disabled={!ready}
        onPress={onStartScan}
      >
        <Text style={styles.btnPrimaryText}>📷  Ler QR Code</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── TAB: SYNC ─────────────────────────────────────────────────
function SyncTab({ queue, online, ready, onSync }: SyncTabProps) {
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄  Status de Sincronização</Text>
        <View style={styles.syncRow}>
          <Text style={styles.syncLabel}>Scans na fila</Text>
          <View style={[styles.syncBadge, queue > 0 && styles.syncBadgeWarn]}>
            <Text style={[styles.syncBadgeText, queue > 0 && styles.syncBadgeTextWarn]}>
              {queue}
            </Text>
          </View>
        </View>
        <View style={styles.syncRow}>
          <Text style={styles.syncLabel}>Conexão</Text>
          <View style={[styles.syncBadge, !online && styles.syncBadgeWarn]}>
            <Text style={[styles.syncBadgeText, !online && styles.syncBadgeTextWarn]}>
              {online ? "Online ✓" : "Offline ✗"}
            </Text>
          </View>
        </View>
      </View>

      {queue > 0 && (
        <View style={[styles.card, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
          <Text style={{ color: ORANGE, fontWeight: "700", marginBottom: 4 }}>⚠️  Sincronização pendente</Text>
          <Text style={{ color: ORANGE_DARK, fontSize: 13 }}>
            Há {queue} scan(s) aguardando para ser enviado(s) ao servidor.
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.btnPrimary, (!ready || !online) && styles.btnDisabled]}
        disabled={!ready || !online}
        onPress={onSync}
      >
        <Text style={styles.btnPrimaryText}>🔄  Sincronizar agora</Text>
      </Pressable>

      {!online && (
        <Text style={styles.hintText}>Conecte-se à internet para sincronizar.</Text>
      )}
    </ScrollView>
  );
}

// ── TAB: PERFIL ───────────────────────────────────────────────
function PerfilTab({ user, deviceId, apiUrl, onLogout }: { user?: MobileUser; deviceId: string; apiUrl: string; onLogout: () => void }) {
  const menuItems = [
    { emoji: "🔗", label: normalizeApiUrl(apiUrl), onPress: () => {} },
    { emoji: "📱", label: deviceId, onPress: () => {} },
    { emoji: "🚪", label: "Sair", onPress: () => Alert.alert("Sair", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: onLogout }
    ]) },
  ];

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Avatar + saudação */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>EH</Text>
        </View>
        <View>
          <Text style={styles.profileGreeting}>Olá,</Text>
          <Text style={styles.profileName}>{user?.name || "Operador Event Flow"}</Text>
          <Text style={styles.profileGreeting}>{user?.role || "CHECK-IN"}</Text>
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.menuList}>
        {menuItems.map((item, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [
              styles.menuItem,
              idx < menuItems.length - 1 && styles.menuItemBorder,
              pressed && { backgroundColor: ORANGE_LIGHT }
            ]}
            onPress={item.onPress}
          >
            <Text style={styles.menuEmoji}>{item.emoji}</Text>
            <Text style={[styles.menuLabel, item.label === "Sair" && { color: "#EF4444" }]}>
              {item.label}
            </Text>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.versionText}>versão: {Application.nativeApplicationVersion ?? "1.0.0"}</Text>
    </ScrollView>
  );
}

// ── Componentes auxiliares ────────────────────────────────────
function MetricChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={[styles.metricChip, warn && styles.metricChipWarn]}>
      <Text style={[styles.metricValue, warn && styles.metricValueWarn]}>{value}</Text>
      <Text style={[styles.metricLabel, warn && styles.metricLabelWarn]}>{label}</Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function parseTicketUuid(data: string) {
  try {
    const parsed = JSON.parse(data);
    return String(parsed.uuid ?? parsed.ticketUuid ?? data);
  } catch {
    return data;
  }
}

// ── ESTILOS ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GRAY_BG },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  // Header
  header: {
    backgroundColor: ORANGE, paddingVertical: 16, paddingHorizontal: 20,
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 1.5 },

  // Tab content
  tabContent: { padding: 16, gap: 14, paddingBottom: 24 },

  // Bottom nav
  bottomNav: {
    flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1,
    borderTopColor: BORDER, paddingBottom: 6, paddingTop: 6,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  navIconBgActive: { backgroundColor: ORANGE_LIGHT },
  navEmoji: { fontSize: 18 },
  navLabel: { fontSize: 10, color: MID_TEXT, fontWeight: "500" },
  navLabelActive: { color: ORANGE, fontWeight: "700" },

  // Cards
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: DARK_TEXT, marginBottom: 14 },

  // Metrics row
  metricsRow: { flexDirection: "row", gap: 8 },
  metricChip: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 10,
    alignItems: "center", borderWidth: 1, borderColor: BORDER,
  },
  metricChipWarn: { borderColor: "#FED7AA", backgroundColor: "#FFF7ED" },
  metricValue: { fontSize: 14, fontWeight: "800", color: DARK_TEXT },
  metricValueWarn: { color: ORANGE },
  metricLabel: { fontSize: 10, color: MID_TEXT, marginTop: 2, fontWeight: "500" },
  metricLabelWarn: { color: ORANGE_DARK },

  // Fields
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: MID_TEXT, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: GRAY_BG, borderColor: BORDER, borderRadius: 10, borderWidth: 1,
    padding: 12, fontSize: 14, color: DARK_TEXT,
  },

  // Scanner
  scanner: { borderRadius: 16, height: 280, overflow: "hidden", backgroundColor: "#000" },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center",
  },
  scannerFrame: {
    width: 180, height: 180, borderWidth: 3, borderColor: ORANGE,
    borderRadius: 16, shadowColor: ORANGE, shadowOpacity: 0.8, shadowRadius: 12,
  },
  scannerHint: { color: "#fff", fontSize: 12, marginTop: 16, fontWeight: "600", textAlign: "center" },
  emptyScanner: {
    alignItems: "center", backgroundColor: "#fff", borderRadius: 16, height: 160,
    justifyContent: "center", borderWidth: 1, borderColor: BORDER, borderStyle: "dashed",
  },
  emptyScannerEmoji: { fontSize: 40, marginBottom: 8 },
  emptyScannerText: { color: MID_TEXT, fontSize: 13, fontWeight: "500" },

  // Buttons
  btnPrimary: {
    alignItems: "center", backgroundColor: ORANGE, borderRadius: 14, padding: 16,
    shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.45, shadowOpacity: 0 },

  // Sync
  syncRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  syncLabel: { fontSize: 14, color: DARK_TEXT, fontWeight: "500" },
  syncBadge: { backgroundColor: "#F0FDF4", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: "#BBF7D0" },
  syncBadgeWarn: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
  syncBadgeText: { fontSize: 12, fontWeight: "700", color: "#16A34A" },
  syncBadgeTextWarn: { color: ORANGE },

  hintText: { fontSize: 12, color: MID_TEXT, textAlign: "center", marginTop: 8 },

  // Profile
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: ORANGE_LIGHT,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ORANGE,
  },
  avatarText: { fontSize: 20, fontWeight: "800", color: ORANGE },
  profileGreeting: { fontSize: 13, color: MID_TEXT },
  profileName: { fontSize: 18, fontWeight: "800", color: DARK_TEXT },

  menuList: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  menuEmoji: { fontSize: 20, width: 28, textAlign: "center" },
  menuLabel: { flex: 1, fontSize: 15, color: DARK_TEXT, fontWeight: "500" },
  menuChevron: { fontSize: 20, color: MID_TEXT },

  versionText: { textAlign: "center", fontSize: 12, color: MID_TEXT, marginTop: 8 },

  // Home features
  sectionTitle: { fontSize: 22, fontWeight: "800", color: DARK_TEXT },
  sectionSubtitle: { fontSize: 14, color: MID_TEXT, marginBottom: 4 },
  featureCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, flexDirection: "row",
    alignItems: "center", gap: 14, borderWidth: 1, borderColor: BORDER,
  },
  featureEmoji: { fontSize: 28 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: "700", color: DARK_TEXT },
  featureDesc: { fontSize: 13, color: MID_TEXT, marginTop: 2 },
});
