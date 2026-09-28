// ESP32 SCEAS Firmware - Compliance Verified Version
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>
#include <HardwareSerial.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
// ==========================================
// 1. Hardware Pin Definitions
// ==========================================
#define PIR_PIN 13
#define TRIG_PIN 12
#define ECHO_PIN 14
#define RELAY_PIN 27
#define PZEM_RX_PIN 16
#define PZEM_TX_PIN 17

// Relay state logic (Active-LOW: isyarat LOW untuk hidupkan lampu, HIGH untuk matikan)
#define RELAY_ACTIVE_LOW false

#if RELAY_ACTIVE_LOW
  #define RELAY_ON LOW
  #define RELAY_OFF HIGH
#else
  #define RELAY_ON HIGH
  #define RELAY_OFF LOW
#endif

// Threshold Jarak Sensor Ultrasonic (dalam cm)
#define MAX_DISTANCE_CM 30.0

// ==========================================
// 2. Wi-Fi Configuration
// ==========================================
const char* ssid = "Dania";            // <-- Tukar nama Wi-Fi / Hotspot di sini
const char* password = "password123";  // <-- Tukar kata laluan Wi-Fi di sini

// ==========================================
// 3. Supabase Configuration
// ==========================================
const String supabaseUrl = "https://yemzvtsuefaqwbazflqc.supabase.co";
const String supabaseApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbXp2dHN1ZWZhcXdiYXpmbHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTY0NDMsImV4cCI6MjA5Njk5MjQ0M30.uTzz39jVnZNIXnSPCPvCPKCIlYX-EFQuWQBrl0TR47Q";
String roomId = "65f75b06-1b35-45de-acaf-f94c09b426ce"; // Default: Makmal Fotogrametri (Tukar kepada '4b3d2863-2de4-47bb-ac1d-31bf0950d575' untuk Makmal Kartografi)

// ==========================================
// 3. State Machine & Timing Variables
// ==========================================
enum RoomState { VACANT, OCCUPIED };
RoomState currentState = VACANT;

bool manualOverride = false;
String overrideStatus = "VACANT";

// Timers for state machine debouncing (non-blocking)
unsigned long presenceTimerStart = 0;
unsigned long vacancyTimerStart = 0;

// Polling, Telemetry, and Wi-Fi reconnection timers
unsigned long lastPollTime = 0;
unsigned long lastTelemetryTime = 0;
unsigned long lastWifiRetryTime = 0;
unsigned long lastHeartbeatTime = 0;

const unsigned long POLL_INTERVAL = 1500;       // Fast poll override/settings every 1500 ms (<2s response)
const unsigned long TELEMETRY_INTERVAL = 10000;  // Post telemetry every 10000 ms
const unsigned long WIFI_RETRY_INTERVAL = 15000; // Wi-Fi retry every 15000 ms
const unsigned long HEARTBEAT_INTERVAL = 5000;  // Send heartbeat ping every 5000 ms (5s)

// BLE Scan and Beacon Sync Timers
unsigned long lastBleScanTime = 0;
unsigned long lastBeaconSyncTime = 0;
const unsigned long BLE_SCAN_INTERVAL = 30000;      // Scan every 30 seconds
const unsigned long BEACON_SYNC_INTERVAL = 300000;  // Sync beacons every 5 minutes
const int BLE_SCAN_DURATION = 2;                    // 2 seconds scan

// BLE Presence State
bool blePresenceDetected = false;

// Beacon cache
const int MAX_BEACONS = 10;
String authorizedMacs[MAX_BEACONS];
int authorizedBeaconCount = 0;


// Offline status queue
bool statusUpdatePending = false;
String pendingStatus = "";

// PZEM Instance (Serial2, RX=16, TX=17)
PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);

// ==========================================
// 4. Helper Functions
// ==========================================

// BLE Advertised Device Callbacks
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
        String rawAddr = advertisedDevice.getAddress().toString().c_str();
        String address = rawAddr;
        address.toUpperCase();
        address.replace(":", "");
        address.replace("-", "");
        
        Serial.print("[BLE-FOUND] Device Scanned: ");
        Serial.println(rawAddr);
        
        for (int i = 0; i < authorizedBeaconCount; i++) {
            if (address.equals(authorizedMacs[i])) {
                blePresenceDetected = true;
                Serial.print("  >>> MATCH FOUND! Authorized Device: ");
                Serial.println(rawAddr);
                break;
            }
        }
    }
};

// Static BLE callback to eliminate heap fragmentation and memory leaks
static MyAdvertisedDeviceCallbacks bleCallbacks;

void runBleScan() {
    Serial.println("[BLE] Starting scan...");
    blePresenceDetected = false; // Reset before scan
    
    BLEScan* pBLEScan = BLEDevice::getScan();
    pBLEScan->start(BLE_SCAN_DURATION, false);
    pBLEScan->clearResults(); // free memory
    
    Serial.print("[BLE] Scan complete. Presence detected: ");
    Serial.println(blePresenceDetected ? "YES" : "NO");
}

void fetchAuthorizedBeacons() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    WiFiClientSecure client;
    client.setInsecure();
    
    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/authorized_beacons?room_id=eq." + roomId + "&select=mac_address";
    http.begin(client, url);
    setHttpHeaders(http);
    http.setTimeout(5000);
    
    int httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        StaticJsonDocument<1024> doc;
        DeserializationError error = deserializeJson(doc, payload);
        if (!error) {
            int count = doc.size();
            if (count > MAX_BEACONS) count = MAX_BEACONS;
            authorizedBeaconCount = count;
            for (int i = 0; i < count; i++) {
                String mac = doc[i]["mac_address"].as<String>();
                mac.toUpperCase();
                mac.replace(":", "");
                mac.replace("-", "");
                authorizedMacs[i] = mac;
            }
            Serial.print("[BLE] Synced ");
            Serial.print(authorizedBeaconCount);
            Serial.println(" authorized beacon(s) from Supabase:");
            for (int i = 0; i < authorizedBeaconCount; i++) {
                Serial.print("  -> Authorized MAC #");
                Serial.print(i + 1);
                Serial.print(": ");
                Serial.println(authorizedMacs[i]);
            }
        }
    } else {
        Serial.print("[BLE] Failed to sync beacons. HTTP code: ");
        Serial.println(httpCode);
    }
    http.end();
}

bool isNumericStr(String str) {
  if (str.length() == 0) return false;
  for (unsigned int i = 0; i < str.length(); i++) {
    if (!isDigit(str[i])) return false;
  }
  return true;
}

void setHttpHeaders(HTTPClient &http) {
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", "Bearer " + supabaseApiKey);
  http.addHeader("Content-Type", "application/json");
}

float readUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout (~5m)
  if (duration == 0) return 999.0;
  return duration * 0.0343 / 2.0;
}

void sendRoomStatusPatch(String status) {
  if (WiFi.status() != WL_CONNECTED) {
    statusUpdatePending = true;
    pendingStatus = status;
    return;
  }
  
  WiFiClientSecure client;
  client.setInsecure();
  
  HTTPClient http;
  String url = supabaseUrl + "/rest/v1/rooms?id=eq." + roomId;
  http.begin(client, url);
  setHttpHeaders(http);
  http.setTimeout(5000);
  
  StaticJsonDocument<128> doc;
  doc["status"] = status;
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.PATCH(payload);
  Serial.print("[SUPABASE] Update status to '");
  Serial.print(status);
  Serial.print("', HTTP Response: ");
  Serial.println(httpCode);
  
  if (httpCode >= 200 && httpCode < 300) {
    statusUpdatePending = false;
  } else {
    statusUpdatePending = true;
    pendingStatus = status;
  }
  http.end();
}

void sendHeartbeatPing(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL || lastHeartbeatTime == 0) {
    lastHeartbeatTime = now;
    
    WiFiClientSecure client;
    client.setInsecure();
    
    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/rpc/fn_heartbeat";
    http.begin(client, url);
    setHttpHeaders(http);
    http.setTimeout(4000);
    
    StaticJsonDocument<128> doc;
    doc["p_room_id"] = roomId;
    String payload;
    serializeJson(doc, payload);
    
    int httpCode = http.POST(payload);
    if (httpCode >= 200 && httpCode < 300) {
      Serial.println("[HEARTBEAT] ESP32 Hardware Ping Sent to Supabase OK");
    } else {
      Serial.print("[HEARTBEAT] Ping failed, HTTP: ");
      Serial.println(httpCode);
    }
    http.end();
  }
}

void pollRoomSettings(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  if (now - lastPollTime >= POLL_INTERVAL) {
    lastPollTime = now;
    
    WiFiClientSecure client;
    client.setInsecure();
    
    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/rooms?id=eq." + roomId + "&select=manual_override,status";
    http.begin(client, url);
    setHttpHeaders(http);
    http.setTimeout(5000);
    
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error && doc.size() > 0) {
        JsonObject room = doc[0].as<JsonObject>();
        
        bool prevOverride = manualOverride;
        manualOverride = room["manual_override"].as<bool>();
        String dbStatus = room["status"].as<String>();
        overrideStatus = dbStatus;
        
        if (prevOverride && !manualOverride) {
          // Manual to Auto transition: Perform immediate sensor evaluation and state transition
          float distance = readUltrasonicDistance();
          bool pirActive = (digitalRead(PIR_PIN) == HIGH);
          bool presenceDetected = pirActive && (distance < MAX_DISTANCE_CM);
          
          currentState = presenceDetected ? OCCUPIED : VACANT;
          digitalWrite(RELAY_PIN, (currentState == OCCUPIED) ? RELAY_ON : RELAY_OFF);
          presenceTimerStart = 0;
          vacancyTimerStart = 0;
          
          String targetStatus = (currentState == OCCUPIED) ? "OCCUPIED" : "VACANT";
          sendRoomStatusPatch(targetStatus);
        } else if (manualOverride) {
          // In manual override mode, Relay must follow the status (OCCUPIED = ON, VACANT = OFF)
          currentState = (overrideStatus == "OCCUPIED") ? OCCUPIED : VACANT;
          digitalWrite(RELAY_PIN, (currentState == OCCUPIED) ? RELAY_ON : RELAY_OFF);
        }
      }
    }
    http.end();
  }
}

void updateStateMachine(unsigned long now) {
  if (manualOverride) {
    // Suspend sensor state machine
    presenceTimerStart = 0;
    vacancyTimerStart = 0;
    return;
  }
  
  bool pirActive = (digitalRead(PIR_PIN) == HIGH);
  float distance = readUltrasonicDistance();
  bool presenceDetected = (pirActive && (distance < MAX_DISTANCE_CM)) || blePresenceDetected;
  
  if (currentState == VACANT) {
    if (presenceDetected) {
      if (presenceTimerStart == 0) {
        presenceTimerStart = now;
      } else if (now - presenceTimerStart >= 5000) {
        currentState = OCCUPIED;
        digitalWrite(RELAY_PIN, RELAY_ON);
        presenceTimerStart = 0;
        sendRoomStatusPatch("OCCUPIED");
      }
    } else {
      presenceTimerStart = 0;
    }
    vacancyTimerStart = 0;
  } else { // currentState == OCCUPIED
    if (!presenceDetected) {
      if (vacancyTimerStart == 0) {
        vacancyTimerStart = now;
      } else if (now - vacancyTimerStart >= 15000) {
        currentState = VACANT;
        digitalWrite(RELAY_PIN, RELAY_OFF);
        vacancyTimerStart = 0;
        sendRoomStatusPatch("VACANT");
      }
    } else {
      vacancyTimerStart = 0;
    }
    presenceTimerStart = 0;
  }
}

void postEnergyTelemetry(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = now;
    
    float voltage = pzem.voltage();
    float current = pzem.current();
    float power = pzem.power();
    float energy = pzem.energy();
    
    // Check for invalid/NaN/negative values and send 0 if invalid
    if (isnan(voltage) || voltage < 0) voltage = 0.0;
    if (isnan(current) || current < 0) current = 0.0;
    if (isnan(power) || power < 0) power = 0.0;
    if (isnan(energy) || energy < 0) energy = 0.0;
    
    WiFiClientSecure client;
    client.setInsecure();
    
    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/energy_readings";
    http.begin(client, url);
    setHttpHeaders(http);
    http.setTimeout(5000);
    
    StaticJsonDocument<256> doc;
    if (isNumericStr(roomId)) {
      doc["room_id"] = roomId.toInt();
    } else {
      doc["room_id"] = roomId;
    }
    doc["voltage"] = voltage;
    doc["current"] = current;
    doc["power"] = power;
    doc["energy"] = energy;
    
    String payload;
    serializeJson(doc, payload);
    
    int httpCode = http.POST(payload);
    http.end();
  }
}

void handleWifiReconnection(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiRetryTime >= WIFI_RETRY_INTERVAL) {
      lastWifiRetryTime = now;
      Serial.println("[WIFI] Reconnecting to Wi-Fi...");
      WiFi.disconnect();
      WiFi.begin(ssid, password);
    }
  } else {
    lastWifiRetryTime = now;
  }
}

void bootRecovery() {
  bool getSuccess = false;
  
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    
    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/rooms?id=eq." + roomId + "&select=manual_override,status";
    http.begin(client, url);
    setHttpHeaders(http);
    http.setTimeout(5000);
    
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error && doc.size() > 0) {
        getSuccess = true;
        JsonObject room = doc[0].as<JsonObject>();
        manualOverride = room["manual_override"].as<bool>();
        String dbStatus = room["status"].as<String>();
        overrideStatus = dbStatus;
        
        if (manualOverride) {
          currentState = (overrideStatus == "OCCUPIED") ? OCCUPIED : VACANT;
          digitalWrite(RELAY_PIN, (currentState == OCCUPIED) ? RELAY_ON : RELAY_OFF);
        } else {
          // If auto, immediately evaluate sensors and sync database state if different
          float distance = readUltrasonicDistance();
          bool pirActive = (digitalRead(PIR_PIN) == HIGH);
          bool presenceDetected = (pirActive && (distance < MAX_DISTANCE_CM)) || blePresenceDetected;
          
          currentState = presenceDetected ? OCCUPIED : VACANT;
          digitalWrite(RELAY_PIN, (currentState == OCCUPIED) ? RELAY_ON : RELAY_OFF);
          
          String targetStatus = (currentState == OCCUPIED) ? "OCCUPIED" : "VACANT";
          if (dbStatus != targetStatus) {
            sendRoomStatusPatch(targetStatus);
          }
        }
      }
    }
    http.end();
  }
  
  if (!getSuccess) {
    // Fallback to local sensors if GET fails
    float distance = readUltrasonicDistance();
    bool pirActive = (digitalRead(PIR_PIN) == HIGH);
    bool presenceDetected = (pirActive && (distance < MAX_DISTANCE_CM)) || blePresenceDetected;
    
    currentState = presenceDetected ? OCCUPIED : VACANT;
    digitalWrite(RELAY_PIN, (currentState == OCCUPIED) ? RELAY_ON : RELAY_OFF);
    statusUpdatePending = true;
    pendingStatus = (currentState == OCCUPIED) ? "OCCUPIED" : "VACANT";
  }
}

// ==========================================
// 5. Main Setup & Loop
// ==========================================
void setup() {
  Serial.begin(115200);
  
  pinMode(PIR_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  
  digitalWrite(RELAY_PIN, RELAY_OFF);
  
  // Initialize BLE Device & Scan once
  BLEDevice::init("");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(&bleCallbacks);
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
  
  // Connect to Wi-Fi
  Serial.print("[WIFI] Connecting to ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  unsigned long startWifiWait = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startWifiWait < 12000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Connected to Wi-Fi successfully!");
    Serial.print("[WIFI] IP Address: ");
    Serial.println(WiFi.localIP());
    fetchAuthorizedBeacons();
    runBleScan();
  } else {
    Serial.println("[WIFI] Initial connection timed out. Will retry in background.");
  }
  
  bootRecovery();
}

void loop() {
  unsigned long now = millis();
  
  handleWifiReconnection(now);
  sendHeartbeatPing(now);
  
  if (WiFi.status() == WL_CONNECTED && statusUpdatePending) {
    sendRoomStatusPatch(pendingStatus);
  }
  
  // Sync beacons from Supabase every 5 minutes
  if (WiFi.status() == WL_CONNECTED && (now - lastBeaconSyncTime >= BEACON_SYNC_INTERVAL || lastBeaconSyncTime == 0)) {
    lastBeaconSyncTime = now;
    fetchAuthorizedBeacons();
  }

  // Run BLE scan every 30 seconds
  if (now - lastBleScanTime >= BLE_SCAN_INTERVAL || lastBleScanTime == 0) {
    lastBleScanTime = now;
    runBleScan();
  }
  
  pollRoomSettings(now);
  updateStateMachine(now);
  postEnergyTelemetry(now);
  
  delay(50);
}
