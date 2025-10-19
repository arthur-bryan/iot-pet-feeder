#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <MQTTClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HX711.h>
#include <Preferences.h>
#include <time.h>

// Configuration
const char* WIFI_SSID = "Arthur Bryan";
const char* WIFI_PASSWORD = "cama#17220321";
const char* API_BASE_URL = "https://hkwon40nol.execute-api.us-east-2.amazonaws.com/dev/api/v1/config";
const int API_PORT = 443;
const char* AWS_IOT_ENDPOINT = "a1mm0cek76sanp-ats.iot.us-east-2.amazonaws.com";
const int AWS_IOT_PORT = 8883;
const char* MQTT_CLIENT_ID = "iot-pet-feeder-device-dev";
const char* MQTT_SUBSCRIBE_TOPIC = "petfeeder/commands";
const char* MQTT_PUBLISH_TOPIC = "petfeeder/status";
const char* MQTT_FEED_EVENT_TOPIC = "petfeeder/feed_event";
const char* MQTT_CONFIG_TOPIC = "petfeeder/config";

// Pin Configuration
const int BUTTON_PIN = 27;
const int SERVO_PIN = 25;
const int GREEN_LED_PIN = 32;
const int RED_LED_PIN = 33;
const int LOADCELL_DOUT_PIN = 13;
const int LOADCELL_SCK_PIN = 14;

// Hardware Settings
const int SERVO_ANGLE_OPEN = 60;
const int SERVO_ANGLE_CLOSED = 0;
const unsigned long SERVO_SWEEP_DURATION_MS = 150;
unsigned long SERVO_OPEN_HOLD_DURATION_MS = 3000;
float WEIGHT_THRESHOLD_G = 350.0;
int DEFAULT_FEED_CYCLES = 1;

// Network & Timing
const unsigned long WIFI_RECONNECT_DELAY_MS = 5000;
const unsigned long AWS_RECONNECT_DELAY_MS = 5000;
const unsigned long STATUS_HEARTBEAT_INTERVAL_MS = 600000; // 10 min
const float WEIGHT_CHANGE_THRESHOLD_G = 5.0;
const unsigned long MIN_WEIGHT_PUBLISH_INTERVAL_MS = 5000;
const float CALIBRATION_FACTOR = -1093.94;
const float MINIMAL_FOOD_WEIGHT_G = 10.0;
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 0;
const int DAYLIGHT_OFFSET_SEC = 0;

// Certificates
const char* AWS_ROOT_CA = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
b3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj
ca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM
9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw
IFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6
VOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L
93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm
jgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC
AYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA
A4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI
U5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs
N+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv
o/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU
5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy
rqXRfboQnoZsG4q5WTP468SQvvG5
-----END CERTIFICATE-----
)EOF";

const char* AWS_CLIENT_CERT = R"KEY(
-----BEGIN CERTIFICATE-----
MIIDWTCCAkGgAwIBAgIUYhZX0yWOat9nqwF4inBPk2So/hQwDQYJKoZIhvcNAQEL
BQAwTTFLMEkGA1UECwxCQW1hem9uIFdlYiBTZXJ2aWNlcyBPPUFtYXpvbi5jb20g
SW5jLiBMPVNlYXR0bGUgU1Q9V2FzaGluZ3RvbiBDPVVTMB4XDTI1MDcyNTE5Mjky
NFoXDTQ5MTIzMTIzNTk1OVowHjEcMBoGA1UEAwwTQVdTIElvVCBDZXJ0aWZpY2F0
ZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOAca/8g+ZI09mQ0nrL3
hqhHXQNzRdcU52S8QDE3R9jJf5Wv/eNtmQCuR6dqcXWzfZbLvy4M13KXNmrLp2I1
Ydd3v57zyyhp0F5sx8j8yxYH1aziFBOl/mqL0kL5k7pklK81CvpxLogdy/GxrIYm
6BAnWq4xwha5GC+hrUjXyNouwHM/LT2al5121IIYNBkf9ssToJqyOplNswtxDORG
MqphQTy3zbaC5HCrYgdJhhK2utFa6WhFogQrqIzJ1Y1QsPEK7pTxU8hKkjGfIFB9
LhRtQcCK8+pZOHR8+tjxzjMfDTkLVlfQ7safywTMf1FIJz3EG+LIqYXk9YCgsoei
XlcCAwEAAaNgMF4wHwYDVR0jBBgwFoAUwBh4Ln3RnThx3vpQOXRkEFu+9ZEwHQYD
VR0OBBYEFOAx7VPUiRh5HnP0OQ19lQSAu4LvMAwGA1UdEwEB/wQCMAAwDgYDVR0P
AQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4IBAQAqTrN6eWvdTnlLprGVItdFQzRO
/CLvbEvBFxB92HhWtc7XwttOdPPnMzueCbc4OQYC4OGzkxQVqQW+sQHyik5XtiKc
e0hZc2tRtfru0f1752eyIDjoqFGBrIBAPe6Z1A4bxOtpnKPh92JLUqGK4w4OD/oR
abrzkKKRhCUXWVw12acaZmRXlvMsfWt1ydbcnKAKv2pjzNd1SW6prdWuvTj6MeIe
GHycqXBoLMkxzKp1i+kjHtxeuKMF6FbLcchRmcg2rQq1QmGUKVnyLLphXTVQmcGI
IkQKPIN2dXEmr1QcPQYDrxkq05ym/2uzSdjCf15XLI20CbhoxkkqfuMyBMCR
-----END CERTIFICATE-----
)KEY";

const char* AWS_PRIVATE_KEY = R"KEY(
-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA4Bxr/yD5kjT2ZDSesveGqEddA3NF1xTnZLxAMTdH2Ml/la/9
422ZAK5Hp2pxdbN9lsu/LgzXcpc2asunYjVh13e/nvPLKGnQXmzHyPzLFgfVrOIU
E6X+aovSQvmTumSUrzUK+nEuiB3L8bGshiboECdarjHCFrkYL6GtSNfI2i7Acz8t
PZqXnXbUghg0GR/2yxOgmrI6mU2zC3EM5EYyqmFBPLfNtoLkcKtiB0mGEra60Vrp
aEWiBCuojMnVjVCw8QrulPFTyEqSMZ8gUH0uFG1BwIrz6lk4dHz62PHOMx8NOQtW
V9Duxp/LBMx/UUgnPcQb4sipheT1gKCyh6JeVwIDAQABAoIBAQC9o08/dAe7UFWu
NViU2B96BekPIlvWxDmJZEJtYvnI17i+UU3lRLhTeyXm5ItdraR4FbCQpw0oSgwi
EnJxB/ri+NGND365k9BeFm54BHFVEwwcXrHebnf6cJZbVhVLhBDMsXW4tk1JoO0S
d+YlHocAJEz3WeOClt2AcK7RFMdA1vliHxV4CfBWxb6K9Sau3WwY1z9NrpFm/Njl
DX3MMheuaqeL5icggVb/fzAlFY3f17s+T1OvEXj5V4rNCT15xnEcV3fXQYPemmuB
LuUPeL+wT1scZOolFoeiYQdf5v+9xgBwQUIIu+d9ddSQv6q5lfQjAVzTPltwDc08
jui3A/wBAoGBAPEIVyogrt5SszQjS3rBQXLZHGHNRFYNHmTQOgibacXoU/UU/kOa
c9xqYLGMguZlZGKwMZP3So8jkPVX6Jzkem86ZZaz1sakDRsLyweulhy4LVxASB+E
Bvd56VtgXhVdBUgG/rWrY596D/7pUTG85tDqKtJ1R9K7nw3kZAeeKEwRAoGBAO4H
FPVEqRAmBwlSmH9FPMjT9osA63WoVWsHMA+KYCx/RXpJoyVVVdQrtdzGrZJIjN1F
mYS4KIjbNcmjk+o0tdsI4v9TnjFoDUMFzIicvhRF39NG8f8LeE6aEzVnOjR037ls
PlM4xWyUEibHCit8veUOqWOgfTnYHby5NUHa8QvnAoGAegtfF1W1NZ1qX9v/PAje
uuh0FpF5KJk76pAE0pbe1/brjA01McXjJJg4na4oGcD9M3tDn0h32EKKA7Cfd9G4
rNlE1yn4dlxaxncSNrGQELqxPSTPYCXZ4TU5k6sX+HlBU1c3YYWGzBliQBCjrCua
M+5eAHKiC3I09zPN8o2CmgECgYEAnen23o1xuDPyYR357B2sKPRu0WOH0uQd30bC
fNzp1zuMhYfLA96sdXmWSuVIjA8z3Szqn6Fpyvnbom2ymSPlLm6j4o7AGbkVa0yy
mEOc22hMCSg9Ll6Wr1cKvVhBxkFvl92XL7EvUUyfCjjsp1M3zHpAqMb1rWWSvP0G
ty0g1CsCgYEAyNYljyWMqA25zTETEe9EqJbxRam/YUIGxtSTpeUrQCnJ0heReBaD
vjU1MwazgkKvWJ1k2Ubs3NvcXj/HIFCkCVN2APx7L2yasxBHOvfjsyJoxiOhZ4hp
mADSyOUTbuEoM087hEIQdK/1DTolyPvnj2hkzsGseEZaeSEQ0dBbfyw=
-----END RSA PRIVATE KEY-----
)KEY";

// Global Objects
WiFiClientSecure netMqtt, netHttp;
MQTTClient mqttClient(256);
HX711 scale;
Servo myServo;
Preferences preferences;

// State Machine
enum ServoState { IDLE, OPENING, OPEN, CLOSING, CLOSED };
ServoState servoState = CLOSED;
ServoState lastPublishedServoState = CLOSED;

// State Variables
unsigned long servoMoveStartTime = 0;
bool buttonPressed = false;
float lastValidWeight = 0.0;
float lastPublishedWeight = 0.0;
unsigned long lastScaleReadTime = 0;
unsigned long lastWeightPublishTime = 0;
const unsigned long MIN_SCALE_READ_INTERVAL_MS = 1000;
bool scaleInitialized = false;
bool lastWiFiStatus = false;
bool lastMQTTStatus = false;
unsigned long lastWiFiAttemptTime = 0;
unsigned long lastAWSAttemptTime = 0;
unsigned long lastHeartbeatPublishTime = 0;
int currentFeedCycle = 0;
int totalFeedCycles = 0;
const char* activeFeedTrigger = nullptr;
char currentFeedId[37] = {0};
float weightBeforeFeed = -1.0;
float pendingWeightBefore = -1.0;
unsigned long pendingWeightStartTime = 0;
bool waitingForWeightStabilization = false;
const unsigned long WEIGHT_STABILIZATION_DELAY_MS = 3000;

// Function Prototypes
void loadConfigFromNVS();
void saveConfigToNVS();
void handleConfigUpdate(const char* payload);
void onMqttMessage(String &topic, String &payload);
void publishDeviceStatus(const char* msg, const char* trigger = nullptr);
void publishFeedEvent(const char* trigger, const char* status);
void activateFeeder(const char* trigger = nullptr);
bool canFeed();
void updateServoState();
void handleButtonPress();
void updateLEDs();
void checkAndPublishStatusChanges();
void monitorWeightChanges();
void generateFeedId(char* buffer);
float getWeight();
float getMedianWeight(int samples);

void generateFeedId(char* buffer) {
    sprintf(buffer, "%08x-%04x-4%03x-%04x-%012x",
            esp_random(), esp_random() & 0xFFFF, esp_random() & 0xFFF,
            (esp_random() & 0x3FFF) | 0x8000, esp_random());
}

void loadConfigFromNVS() {
    preferences.begin("feeder-config", true);
    SERVO_OPEN_HOLD_DURATION_MS = preferences.getULong("servo_duration", 3000);
    WEIGHT_THRESHOLD_G = preferences.getFloat("weight_thresh", 450.0);
    DEFAULT_FEED_CYCLES = preferences.getInt("feed_cycles", 1);
    preferences.end();
    Serial.printf("Config loaded: servo=%lums, thresh=%.1fg, cycles=%d\n", SERVO_OPEN_HOLD_DURATION_MS, WEIGHT_THRESHOLD_G, DEFAULT_FEED_CYCLES);
}

void saveConfigToNVS() {
    preferences.begin("feeder-config", false);
    preferences.putULong("servo_duration", SERVO_OPEN_HOLD_DURATION_MS);
    preferences.putFloat("weight_thresh", WEIGHT_THRESHOLD_G);
    preferences.putInt("feed_cycles", DEFAULT_FEED_CYCLES);
    preferences.end();
    Serial.println("Config saved to NVS");
}

void handleConfigUpdate(const char* payload) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload)) {
        Serial.println("Config parse error");
        return;
    }

    bool changed = false;
    if (doc.containsKey("SERVO_OPEN_HOLD_DURATION_MS")) {
        unsigned long val = doc["SERVO_OPEN_HOLD_DURATION_MS"];
        if (val >= 1000) { SERVO_OPEN_HOLD_DURATION_MS = val; changed = true; }
    }
    if (doc.containsKey("WEIGHT_THRESHOLD_G")) {
        float val = doc["WEIGHT_THRESHOLD_G"];
        if (val >= 50.0) { WEIGHT_THRESHOLD_G = val; changed = true; }
    }
    if (doc.containsKey("DEFAULT_FEED_CYCLES")) {
        int val = doc["DEFAULT_FEED_CYCLES"];
        if (val >= 1 && val <= 10) { DEFAULT_FEED_CYCLES = val; changed = true; }
    }
    if (changed) {
        saveConfigToNVS();
        Serial.println("Config updated via MQTT");
    }
}

float getMedianWeight(int samples) {
    float readings[samples];
    int valid = 0;
    for (int i = 0; i < samples && valid < samples; i++) {
        if (scale.wait_ready_timeout(2000)) {
            readings[valid++] = scale.get_units(1);
        }
        delay(10);
    }
    if (valid < 3) return -1.0f;

    for (int i = 0; i < valid - 1; i++) {
        for (int j = 0; j < valid - i - 1; j++) {
            if (readings[j] > readings[j + 1]) {
                float temp = readings[j];
                readings[j] = readings[j + 1];
                readings[j + 1] = temp;
            }
        }
    }
    return readings[valid / 2];
}

float getWeight() {
    if (!scaleInitialized) return -1.0f;

    unsigned long now = millis();
    if (now - lastScaleReadTime < MIN_SCALE_READ_INTERVAL_MS) {
        return lastValidWeight;
    }
    lastScaleReadTime = now;

    delay(50);
    float weight = getMedianWeight(5);

    if (weight == -1.0f) {
        scale.power_down();
        delay(200);
        scale.power_up();
        delay(200);
        weight = getMedianWeight(5);
        if (weight == -1.0f) return -1.0f;
    }

    float finalWeight = max(0.0f, weight);
    lastValidWeight = finalWeight;
    return finalWeight;
}

void setup() {
    Serial.begin(115200);
    while (!Serial && millis() < 5000) delay(1);
    Serial.println("\n=== Pet Feeder Setup ===");

    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(RED_LED_PIN, OUTPUT);
    myServo.attach(SERVO_PIN);
    myServo.write(SERVO_ANGLE_CLOSED);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, HIGH);

    netHttp.setCACert(AWS_ROOT_CA);
    netMqtt.setCACert(AWS_ROOT_CA);
    netMqtt.setCertificate(AWS_CLIENT_CERT);
    netMqtt.setPrivateKey(AWS_PRIVATE_KEY);

    mqttClient.begin(AWS_IOT_ENDPOINT, AWS_IOT_PORT, netMqtt);
    mqttClient.onMessage(onMqttMessage);
    mqttClient.setKeepAlive(30);
    mqttClient.setTimeout(10000);

    loadConfigFromNVS();

    Serial.println("Initializing HX711...");
    scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
    delay(500);
    scale.power_up();
    delay(100);

    int retries = 0;
    while (!scale.wait_ready_timeout(1000) && retries < 20) {
        Serial.print(".");
        retries++;
        delay(100);
    }

    if (retries >= 20) {
        Serial.println("\nHX711 init failed");
        scaleInitialized = false;
    } else {
        Serial.println("\nHX711 ready");
        scale.set_scale(CALIBRATION_FACTOR);
        scale.tare(20);
        scaleInitialized = true;
    }

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(false);  // We'll handle reconnection manually
    WiFi.setSleep(false);
    WiFi.disconnect(true);
    delay(100);

    Serial.printf("WiFi connecting to: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int wifiRetries = 0;
    while (WiFi.status() != WL_CONNECTED && wifiRetries < 40) {
        delay(500);
        Serial.print(".");
        wifiRetries++;

        // Check for connection failures
        wl_status_t status = WiFi.status();
        if (status == WL_CONNECT_FAILED || status == WL_NO_SSID_AVAIL) {
            Serial.printf("\nWiFi connection failed (status: %d), retrying...\n", status);
            WiFi.disconnect(true);
            delay(1000);
            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
            wifiRetries = 0;
        }
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nWiFi OK: %s (%ddBm)\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());

        // Configure NTP time
        configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
        Serial.println("Waiting for NTP time sync...");

        int ntpRetries = 0;
        time_t now = time(nullptr);
        while (now < 1000000000 && ntpRetries < 10) {
            delay(500);
            now = time(nullptr);
            ntpRetries++;
            Serial.print(".");
        }

        if (now > 1000000000) {
            struct tm t;
            localtime_r(&now, &t);
            Serial.printf("\nTime synced: %04d-%02d-%02d %02d:%02d:%02d UTC\n",
                         t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                         t.tm_hour, t.tm_min, t.tm_sec);
        } else {
            Serial.println("\nNTP sync timeout, will retry later");
        }
    } else {
        Serial.printf("\nWiFi connection failed after %d retries (status: %d)\n", wifiRetries, WiFi.status());
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("MQTT connecting");
        int mqttRetries = 0;
        bool mqttConnected = false;

        while (!mqttConnected && mqttRetries < 5) {
            if (mqttClient.connect(MQTT_CLIENT_ID)) {
                mqttConnected = true;
                Serial.println("\nMQTT OK");
                mqttClient.subscribe(MQTT_SUBSCRIBE_TOPIC);
                mqttClient.subscribe(MQTT_CONFIG_TOPIC);
                delay(500);
                publishDeviceStatus("Ready", "system");
            } else {
                int err = mqttClient.lastError();
                Serial.printf(".");
                mqttRetries++;
                if (mqttRetries < 5) {
                    delay(2000);
                }
            }
        }

        if (!mqttConnected) {
            Serial.printf("\nMQTT connection failed after %d retries\n", mqttRetries);
        }
    }

    lastWiFiAttemptTime = millis();
    lastAWSAttemptTime = millis();
    lastHeartbeatPublishTime = millis();
    Serial.println("=== Setup Complete ===");
}

void loop() {
    unsigned long now = millis();

    // Handle WiFi reconnection with proper state checking
    wl_status_t wifiStatus = WiFi.status();
    if (wifiStatus != WL_CONNECTED) {
        // Only attempt reconnect if not already connecting and enough time has passed
        if (wifiStatus != WL_DISCONNECTED && wifiStatus != WL_CONNECT_FAILED && wifiStatus != WL_CONNECTION_LOST) {
            // WiFi is in connecting state, just wait
        } else if (now - lastWiFiAttemptTime >= WIFI_RECONNECT_DELAY_MS) {
            Serial.printf("WiFi disconnected (status: %d), attempting reconnect...\n", wifiStatus);
            WiFi.disconnect(true);
            delay(100);
            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
            lastWiFiAttemptTime = now;
        }
    } else if (!mqttClient.connected()) {
        if (now - lastAWSAttemptTime >= AWS_RECONNECT_DELAY_MS) {
            Serial.println("Attempting MQTT reconnect...");
            if (mqttClient.connect(MQTT_CLIENT_ID)) {
                Serial.println("MQTT reconnected");
                mqttClient.subscribe(MQTT_SUBSCRIBE_TOPIC);
                mqttClient.subscribe(MQTT_CONFIG_TOPIC);
                publishDeviceStatus("Reconnected", "system");
                lastHeartbeatPublishTime = now;
            } else {
                int err = mqttClient.lastError();
                Serial.printf("MQTT reconnect failed: err=%d\n", err);
            }
            lastAWSAttemptTime = now;
        }
    }

    // Only run MQTT loop if connected
    if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
        mqttClient.loop();
    }

    updateServoState();
    handleButtonPress();
    updateLEDs();
    checkAndPublishStatusChanges();

    if ((servoState == CLOSED || servoState == IDLE) && scaleInitialized) {
        monitorWeightChanges();
    }

    if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
        if (now - lastHeartbeatPublishTime >= STATUS_HEARTBEAT_INTERVAL_MS) {
            publishDeviceStatus("Heartbeat", "system");
            lastHeartbeatPublishTime = now;
        }
    }

    // Small delay to prevent watchdog timer issues and reduce CPU load
    delay(10);
}

bool isWiFiConnected() { return WiFi.status() == WL_CONNECTED; }
bool isAWSConnected() { return mqttClient.connected(); }

void onMqttMessage(String &topic, String &payload) {
    Serial.printf("MSG: %s -> %s\n", topic.c_str(), payload.c_str());

    if (topic == MQTT_SUBSCRIBE_TOPIC) {
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error && doc.containsKey("command")) {
            const char* cmd = doc["command"];
            if (strcmp(cmd, "FEED_NOW") == 0) {
                int cycles = doc.containsKey("cycles") ? doc["cycles"].as<int>() : DEFAULT_FEED_CYCLES;
                const char* trigger = doc.containsKey("trigger") ? doc["trigger"].as<const char*>() : "api";
                if (cycles < 1 || cycles > 10) cycles = DEFAULT_FEED_CYCLES;

                if (canFeed()) {
                    totalFeedCycles = cycles;
                    currentFeedCycle = 0;
                    activeFeedTrigger = trigger;
                    activateFeeder(trigger);
                } else {
                    publishDeviceStatus("Feed denied - threshold exceeded", trigger);
                }
            } else if (strcmp(cmd, "GET_STATUS") == 0) {
                publishDeviceStatus("Status requested", "system");
            }
        } else {
            if (payload == "FEED_NOW") {
                if (canFeed()) {
                    totalFeedCycles = DEFAULT_FEED_CYCLES;
                    currentFeedCycle = 0;
                    activeFeedTrigger = "api";
                    activateFeeder("api");
                } else {
                    publishDeviceStatus("Feed denied - threshold exceeded", "api");
                }
            } else if (payload == "GET_STATUS") {
                publishDeviceStatus("Status requested", "system");
            }
        }
    } else if (topic == MQTT_CONFIG_TOPIC) {
        handleConfigUpdate(payload.c_str());
    }
}

bool canFeed() {
    float w = getWeight();
    if (w < 0.0) return true;
    return w < WEIGHT_THRESHOLD_G;
}

void publishDeviceStatus(const char* msg, const char* trigger) {
    if (!mqttClient.connected()) return;

    StaticJsonDocument<256> doc;
    float w = lastValidWeight;

    bool shouldRead = (servoState == CLOSED || servoState == IDLE) && scaleInitialized;
    if (shouldRead) {
        float curr = getWeight();
        if (curr >= 0.0) {
            lastValidWeight = curr;
            w = curr;
        }
    }

    doc["current_weight_g"] = round(w * 10.0) / 10.0;

    switch (servoState) {
        case IDLE: doc["feeder_state"] = "IDLE"; break;
        case OPENING: doc["feeder_state"] = "OPENING"; break;
        case OPEN: doc["feeder_state"] = "OPEN"; break;
        case CLOSING: doc["feeder_state"] = "CLOSING"; break;
        case CLOSED: doc["feeder_state"] = "CLOSED"; break;
    }

    if (isWiFiConnected() && isAWSConnected()) {
        doc["network_status"] = "ONLINE";
    } else if (isWiFiConnected()) {
        doc["network_status"] = "WIFI_CONNECTED_MQTT_DISCONNECTED";
    } else {
        doc["network_status"] = "OFFLINE_WIFI_DISCONNECTED";
    }

    doc["message"] = msg;
    doc["trigger_method"] = trigger ? trigger : "unknown";

    char buf[256];
    serializeJson(doc, buf);
    mqttClient.publish(MQTT_PUBLISH_TOPIC, buf);

    lastPublishedServoState = servoState;
    lastPublishedWeight = w;
    lastWiFiStatus = isWiFiConnected();
    lastMQTTStatus = isAWSConnected();
}

void publishFeedEvent(const char* trigger, const char* status) {
    if (!mqttClient.connected()) return;

    StaticJsonDocument<256> doc;
    doc["feed_id"] = currentFeedId;

    if (strcmp(trigger, "button") == 0) {
        doc["mode"] = "manual";
        doc["requested_by"] = "physical_button";
        doc["event_type"] = "manual_feed";
    } else if (strcmp(trigger, "api") == 0) {
        doc["mode"] = "api";
        doc["requested_by"] = "api_user";
        doc["event_type"] = "manual_feed";
    } else if (strcmp(trigger, "scheduled") == 0) {
        doc["mode"] = "scheduled";
        doc["requested_by"] = "scheduler";
        doc["event_type"] = "scheduled_feed";
    } else {
        doc["mode"] = "unknown";
        doc["requested_by"] = "unknown";
        doc["event_type"] = "manual_feed";
    }

    doc["status"] = status;
    doc["trigger_method"] = trigger;

    if (strcmp(status, "initiated") == 0 && scaleInitialized) {
        float w = getWeight();
        if (w >= 0.0) {
            weightBeforeFeed = w;
            doc["weight_before_g"] = round(w * 10.0) / 10.0;
        }
    } else if (strcmp(status, "completed") == 0 && scaleInitialized) {
        float w = getWeight();
        if (w >= 0.0) {
            doc["weight_after_g"] = round(w * 10.0) / 10.0;
        }
    }

    if (totalFeedCycles > 1) {
        doc["cycles"] = totalFeedCycles;
    }

    char buf[256];
    serializeJson(doc, buf);
    mqttClient.publish(MQTT_FEED_EVENT_TOPIC, buf);
    Serial.printf("Feed event: %s\n", buf);
}

void activateFeeder(const char* trigger) {
    if (servoState == CLOSED) {
        generateFeedId(currentFeedId);
        Serial.printf("Feed ID: %s\n", currentFeedId);
        servoState = OPENING;
        servoMoveStartTime = millis();
        publishDeviceStatus("Feeder opening", trigger);
        publishFeedEvent(trigger, "initiated");
    } else {
        publishDeviceStatus("Feeder busy", trigger);
        if (strlen(currentFeedId) == 0) {
            generateFeedId(currentFeedId);
        }
        publishFeedEvent(trigger, "failed");
    }
}

void updateServoState() {
    unsigned long now = millis();

    switch (servoState) {
        case CLOSED:
            break;

        case OPENING: {
            long elapsed = now - servoMoveStartTime;
            if (elapsed < SERVO_SWEEP_DURATION_MS) {
                int angle = map(elapsed, 0, SERVO_SWEEP_DURATION_MS, SERVO_ANGLE_CLOSED, SERVO_ANGLE_OPEN);
                myServo.write(angle);
            } else {
                myServo.write(SERVO_ANGLE_OPEN);
                servoState = OPEN;
                servoMoveStartTime = now;
                publishDeviceStatus("Feeder open", "servo_event");
            }
            break;
        }

        case OPEN:
            if (now - servoMoveStartTime >= SERVO_OPEN_HOLD_DURATION_MS) {
                servoState = CLOSING;
                servoMoveStartTime = now;
                publishDeviceStatus("Feeder closing", "servo_event");
            }
            break;

        case CLOSING: {
            long elapsed = now - servoMoveStartTime;
            if (elapsed < SERVO_SWEEP_DURATION_MS) {
                int base = map(elapsed, 0, SERVO_SWEEP_DURATION_MS, SERVO_ANGLE_OPEN, SERVO_ANGLE_CLOSED);
                int offset = ((now / 25) % 2 == 0) ? 2 : -2;
                myServo.write(base + offset);
            } else {
                myServo.write(SERVO_ANGLE_CLOSED);
                servoState = CLOSED;

                if (totalFeedCycles > 0) {
                    currentFeedCycle++;
                    if (currentFeedCycle < totalFeedCycles) {
                        delay(500);
                        servoState = OPENING;
                        servoMoveStartTime = millis();
                        publishDeviceStatus("Multi-cycle feeding", activeFeedTrigger);
                    } else {
                        publishDeviceStatus("Feed completed", activeFeedTrigger);
                        publishFeedEvent(activeFeedTrigger, "completed");
                        totalFeedCycles = 0;
                        currentFeedCycle = 0;
                        activeFeedTrigger = nullptr;
                        weightBeforeFeed = -1.0;
                    }
                } else {
                    publishDeviceStatus("Feed completed", "servo_event");
                }
            }
            break;
        }
        case IDLE:
            break;
    }
}

void handleButtonPress() {
    static unsigned long lastDebounce = 0;
    static int lastState = HIGH;

    int reading = digitalRead(BUTTON_PIN);
    if (reading != lastState) lastDebounce = millis();

    if ((millis() - lastDebounce) > 50) {
        if (reading == LOW && !buttonPressed) {
            buttonPressed = true;
            activateFeeder("button");
        } else if (reading == HIGH && buttonPressed) {
            buttonPressed = false;
        }
    }
    lastState = reading;
}

void updateLEDs() {
    bool wifi = isWiFiConnected();
    bool mqtt = isAWSConnected();
    bool active = (servoState != CLOSED);

    if (wifi && mqtt) {
        digitalWrite(RED_LED_PIN, LOW);
        if (active) {
            static unsigned long lastBlink = 0;
            if (millis() - lastBlink >= 200) {
                digitalWrite(GREEN_LED_PIN, !digitalRead(GREEN_LED_PIN));
                lastBlink = millis();
            }
        } else {
            digitalWrite(GREEN_LED_PIN, HIGH);
        }
    } else {
        digitalWrite(GREEN_LED_PIN, LOW);
        static unsigned long lastBlink = 0;
        if (millis() - lastBlink >= 500) {
            digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
            lastBlink = millis();
        }
    }
}

void checkAndPublishStatusChanges() {
    bool wifiNow = isWiFiConnected();
    bool mqttNow = isAWSConnected();
    bool networkChanged = (wifiNow != lastWiFiStatus || mqttNow != lastMQTTStatus);
    bool servoChanged = (servoState != lastPublishedServoState);

    if (networkChanged) {
        lastWiFiStatus = wifiNow;
        lastMQTTStatus = mqttNow;
    }

    if (servoChanged) {
        lastPublishedServoState = servoState;
    }

    if (networkChanged || servoChanged) {
        const char* reason = networkChanged ? "network_change" : "servo_state_change";
        publishDeviceStatus("Status changed", reason);
    }
}

void monitorWeightChanges() {
    unsigned long now = millis();

    // If waiting for weight stabilization
    if (waitingForWeightStabilization) {
        if (now - pendingWeightStartTime >= WEIGHT_STABILIZATION_DELAY_MS) {
            // 3 seconds have passed, now calculate delta
            float currentWeight = getWeight();
            if (currentWeight < 0.0) {
                waitingForWeightStabilization = false;
                return;
            }

            float delta = currentWeight - pendingWeightBefore;
            float absDelta = abs(delta);

            // Only process if delta is >= 5g
            if (absDelta >= 5.0) {
                Serial.printf("Stabilized weight: %.1fg -> %.1fg (delta: %.1fg)\n", pendingWeightBefore, currentWeight, delta);

                // Detect pet eating (weight decrease)
                if (delta < 0 && pendingWeightBefore > MINIMAL_FOOD_WEIGHT_G) {
                    generateFeedId(currentFeedId);

                    StaticJsonDocument<256> doc;
                    doc["feed_id"] = currentFeedId;
                    doc["mode"] = "consumption";
                    doc["requested_by"] = "pet";
                    doc["status"] = "initiated";
                    doc["trigger_method"] = "weight_monitor";
                    doc["event_type"] = "consumption";
                    doc["weight_before_g"] = round(pendingWeightBefore * 10.0) / 10.0;

                    char buf[256];
                    serializeJson(doc, buf);
                    mqttClient.publish(MQTT_FEED_EVENT_TOPIC, buf);
                    Serial.printf("Consumption initiated: %s\n", buf);

                    delay(100);

                    doc.clear();
                    doc["feed_id"] = currentFeedId;
                    doc["status"] = "completed";
                    doc["weight_after_g"] = round(currentWeight * 10.0) / 10.0;

                    serializeJson(doc, buf);
                    mqttClient.publish(MQTT_FEED_EVENT_TOPIC, buf);
                    Serial.printf("Consumption completed: %s\n", buf);

                    // Update lastPublishedWeight BEFORE publishing status to prevent duplicate detections
                    lastPublishedWeight = currentWeight;

                    // Update device status with new weight
                    publishDeviceStatus("Pet ate food", "weight_monitor");
                }
                // Detect refill (weight increase)
                else if (delta > 0 && absDelta > MINIMAL_FOOD_WEIGHT_G) {
                    generateFeedId(currentFeedId);

                    StaticJsonDocument<256> doc;
                    doc["feed_id"] = currentFeedId;
                    doc["mode"] = "refill";
                    doc["requested_by"] = "human";
                    doc["status"] = "initiated";
                    doc["trigger_method"] = "weight_monitor";
                    doc["event_type"] = "refill";
                    doc["weight_before_g"] = round(pendingWeightBefore * 10.0) / 10.0;

                    char buf[256];
                    serializeJson(doc, buf);
                    mqttClient.publish(MQTT_FEED_EVENT_TOPIC, buf);
                    Serial.printf("Refill initiated: %s\n", buf);

                    delay(100);

                    doc.clear();
                    doc["feed_id"] = currentFeedId;
                    doc["status"] = "completed";
                    doc["weight_after_g"] = round(currentWeight * 10.0) / 10.0;

                    serializeJson(doc, buf);
                    mqttClient.publish(MQTT_FEED_EVENT_TOPIC, buf);
                    Serial.printf("Refill completed: %s\n", buf);

                    // Update lastPublishedWeight BEFORE publishing status to prevent duplicate detections
                    lastPublishedWeight = currentWeight;

                    // Update device status with new weight
                    publishDeviceStatus("Food refilled", "weight_monitor");
                }
            }

            waitingForWeightStabilization = false;
            lastWeightPublishTime = now;
        }
        return;
    }

    // Regular weight monitoring
    if (now - lastWeightPublishTime < MIN_WEIGHT_PUBLISH_INTERVAL_MS) return;

    float w = getWeight();
    if (w < 0.0) return;

    float delta = w - lastPublishedWeight;
    float absDelta = abs(delta);

    if (absDelta >= WEIGHT_CHANGE_THRESHOLD_G) {
        Serial.printf("Weight change detected: %.1fg -> %.1fg (delta: %.1fg) - waiting 3s for stabilization\n", lastPublishedWeight, w, delta);

        // Start waiting for stabilization
        pendingWeightBefore = lastPublishedWeight;
        pendingWeightStartTime = now;
        waitingForWeightStabilization = true;
        publishDeviceStatus("Weight changing", "weight_monitor");
    }
}
