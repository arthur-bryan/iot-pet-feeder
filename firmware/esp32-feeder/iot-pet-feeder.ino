#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <MQTTClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HX711.h>

// =====================================================================
// === CONFIGURATION CONSTANTS (UPDATED) ===
// =====================================================================
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

const int BUTTON_PIN = 27;
const int SERVO_PIN = 25;
const int GREEN_LED_PIN = 32;
const int RED_LED_PIN = 33;
const int LOADCELL_DOUT_PIN = 13;
const int LOADCELL_SCK_PIN = 14;

const int SERVO_ANGLE_OPEN = 60;
const int SERVO_ANGLE_CLOSED = 0;
const unsigned long SERVO_SWEEP_DURATION_MS = 150;
unsigned long SERVO_OPEN_HOLD_DURATION_MS = 3000;
float WEIGHT_THRESHOLD_G = 450.0;

const unsigned long WIFI_RECONNECT_DELAY_MS = 5000;
const unsigned long AWS_RECONNECT_DELAY_MS = 5000;
// Changed 5 * 60 * 10 to 15 * 60 * 1000 (15 minutes) as per original intent, or choose your value
const unsigned long STATUS_PUBLISH_INTERVAL_MS = 5 * 60 * 10;
const unsigned long CONFIG_FETCH_INTERVAL_MS = 30 * 1000;

// *** YOUR NEW CALIBRATION FACTOR ***
const float CALIBRATION_FACTOR = -1093.94; // <--- UPDATED WITH YOUR VALUE!
const float MINIMAL_FOOD_WEIGHT_G = 10.0;

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

// --- Global Objects ---
WiFiClientSecure netMqtt;
WiFiClientSecure netHttp;
MQTTClient mqttClient(256);
HX711 scale;
Servo myServo;

// --- Servo State Machine ---
enum ServoState { IDLE, OPENING, OPEN, CLOSING, CLOSED };
ServoState servoState = CLOSED;

unsigned long servoMoveStartTime = 0;
bool buttonPressed = false; // For button debouncing

// --- Non-Blocking Reconnection Timers ---
unsigned long lastConfigFetchTime = 0;
// Already defined: const unsigned long CONFIG_FETCH_INTERVAL_MS = 30 * 1000;
unsigned long lastWiFiAttemptTime = 0;
unsigned long lastAWSAttemptTime = 0;
unsigned long lastStatusPublishTime = 0;

// --- Function Prototypes ---
void connectToWiFi();
bool isWiFiConnected();
void connectToAWS();
bool isAWSConnected();
void fetchServoDuration();
void fetchWeightThreshold();
void parseServoDuration(const char* payload);
void parseWeightThreshold(const char* payload);
void onMqttMessage(String &topic, String &payload);
void handleFeedCommand();
void publishDeviceStatus(const char* statusMessage, const char* triggerMethod = nullptr);
void publishFeedEvent(const char* triggerMethod, const char* status);
void activateFeeder(const char* triggerMethod = nullptr);
bool canFeed();
void updateServoState();
void handleButtonPress();
void updateLEDs();

// =====================================================================
// === API CONFIG FETCH ===
// =====================================================================
void fetchServoDuration() {
    if (!isWiFiConnected()) {
        Serial.println("Cannot fetch config: WiFi disconnected.");
        return;
    }

    HTTPClient http;
    String url = String(API_BASE_URL) + "/SERVO_OPEN_HOLD_DURATION_MS";
    http.begin(netHttp, url);
    http.addHeader("Content-Type", "application/json");

    Serial.println("Fetching SERVO_OPEN_HOLD_DURATION_MS from API...");

    int httpResponseCode = http.GET();

    if (httpResponseCode > 0) {
        Serial.printf("HTTP Response code: %d\n", httpResponseCode);
        String payload = http.getString();
        parseServoDuration(payload.c_str());
    } else {
        Serial.printf("HTTP GET failed. Error code: %d\n", httpResponseCode);
        Serial.println("Using existing or default SERVO_OPEN_HOLD_DURATION_MS: " + String(SERVO_OPEN_HOLD_DURATION_MS) + " ms");
    }

    http.end();
}

void fetchWeightThreshold() {
    if (!isWiFiConnected()) {
        Serial.println("Cannot fetch weight threshold: WiFi disconnected.");
        return;
    }

    HTTPClient http;
    String url = String(API_BASE_URL) + "/WEIGHT_THRESHOLD_G";
    http.begin(netHttp, url);
    http.addHeader("Content-Type", "application/json");

    Serial.println("Fetching WEIGHT_THRESHOLD_G from API...");

    int httpResponseCode = http.GET();

    if (httpResponseCode > 0) {
        Serial.printf("HTTP Response code: %d\n", httpResponseCode);
        String payload = http.getString();
        parseWeightThreshold(payload.c_str());
    } else {
        Serial.printf("HTTP GET failed. Error code: %d\n", httpResponseCode);
        Serial.println("Using existing or default WEIGHT_THRESHOLD_G: " + String(WEIGHT_THRESHOLD_G) + " g");
    }

    http.end();
    lastConfigFetchTime = millis();
}


// --- JSON Parsing Functions ---
void parseServoDuration(const char* payload) {
    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        Serial.print(F("deserializeJson() failed: "));
        Serial.println(error.f_str());
        Serial.println("Failed to parse config. Using default: " + String(SERVO_OPEN_HOLD_DURATION_MS) + " ms");
        return;
    }

    if (doc.containsKey("value") && doc["value"].is<int>()) {
        unsigned long newDuration = doc["value"].as<unsigned long>();

        if (newDuration >= 1000) {
            SERVO_OPEN_HOLD_DURATION_MS = newDuration;
            Serial.println("SUCCESS: Updated SERVO_OPEN_HOLD_DURATION_MS to: " + String(SERVO_OPEN_HOLD_DURATION_MS) + " ms");
        } else {
            Serial.println("Fetched duration is too short. Using default: " + String(SERVO_OPEN_HOLD_DURATION_MS) + " ms");
        }
    } else {
        Serial.println("JSON response missing 'value' key or invalid format. Using default.");
    }
}

void parseWeightThreshold(const char* payload) {
    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        Serial.print(F("deserializeJson() failed: "));
        Serial.println(error.f_str());
        Serial.println("Failed to parse weight threshold. Using default: " + String(WEIGHT_THRESHOLD_G) + " g");
        return;
    }

    if (doc.containsKey("value")) {
        float newThreshold = doc["value"].as<float>();

        if (newThreshold >= 50.0) {
            WEIGHT_THRESHOLD_G = newThreshold;
            Serial.println("SUCCESS: Updated WEIGHT_THRESHOLD_G to: " + String(WEIGHT_THRESHOLD_G) + " g");
        } else {
            Serial.println("Fetched threshold is too low. Using default: " + String(WEIGHT_THRESHOLD_G) + " g");
        }
    } else {
        Serial.println("JSON response missing 'value' key or invalid format. Using default.");
    }
}

float getWeight() {
    if (scale.is_ready()) {
        // Read the average of 5 measurements
        float weight = scale.get_units(5);

        // Return 0.0g if the reading is negative (due to noise/tare issues)
        return max(0.0f, weight);
    } else {
        return 0.0f;
    }
}

// =====================================================================
// === SETUP FUNCTION (Updated HX711 logic) ===
// =====================================================================
void setup() {
    Serial.begin(115200);
    while (!Serial && millis() < 5000) delay(1);
    Serial.println("\n--- Pet Feeder Device Setup ---");

    // Initialize Pins
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(RED_LED_PIN, OUTPUT);
    myServo.attach(SERVO_PIN);
    myServo.write(SERVO_ANGLE_CLOSED);

    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, HIGH);

    // Configure Secure Clients
    netHttp.setCACert(AWS_ROOT_CA);
    netMqtt.setCACert(AWS_ROOT_CA);
    netMqtt.setCertificate(AWS_CLIENT_CERT);
    netMqtt.setPrivateKey(AWS_PRIVATE_KEY);

    // Configure MQTT Client
    mqttClient.begin(AWS_IOT_ENDPOINT, AWS_IOT_PORT, netMqtt);
    mqttClient.onMessage(onMqttMessage);


    // *** HX711 Initialization with Safe Tare ***
    scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
    scale.set_scale(CALIBRATION_FACTOR);
    Serial.print("Starting HX711 tare... ");
    unsigned long timeout = millis() + 5000; // 5-second timeout

    // Wait for the HX711 to signal readiness (Dout goes LOW)
    while (!scale.wait_ready_timeout(100) && millis() < timeout) {
        // Non-blocking wait
    }

    if (millis() < timeout) {
        scale.tare(); // Blocking tare is safe now that we've checked readiness
        Serial.println("Taring successful. Load cell ready.");
    } else {
        Serial.println("Taring FAILED (HX711 timeout). Weight reading will be unreliable.");
    }
    // *******************************************

    // Initial network setup attempt - non-blocking calls will be handled in loop
    Serial.println("Attempting initial network connection...");
    lastWiFiAttemptTime = millis() - WIFI_RECONNECT_DELAY_MS;
    lastAWSAttemptTime = millis() - AWS_RECONNECT_DELAY_MS;
    lastStatusPublishTime = millis() - STATUS_PUBLISH_INTERVAL_MS;
    lastConfigFetchTime = millis() - CONFIG_FETCH_INTERVAL_MS;
}

// =====================================================================
// === LOOP FUNCTION ===
// =====================================================================
void loop() {
    unsigned long currentMillis = millis();

    // --- Network Management ---
    if (!isWiFiConnected()) {
        if (currentMillis - lastWiFiAttemptTime >= WIFI_RECONNECT_DELAY_MS) {
            Serial.println("WiFi disconnected. Attempting reconnect...");
            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
            lastWiFiAttemptTime = currentMillis;
        }
    } else {
        if (!isAWSConnected()) {
            if (currentMillis - lastAWSAttemptTime >= AWS_RECONNECT_DELAY_MS) {
                Serial.println("MQTT not connected. Attempting reconnect...");
                if (mqttClient.connect(MQTT_CLIENT_ID)) {
                    Serial.println("AWS IoT MQTT connected!");
                    mqttClient.subscribe(MQTT_SUBSCRIBE_TOPIC);
                    Serial.print("Subscribed to: ");
                    Serial.println(MQTT_SUBSCRIBE_TOPIC);
                } else {
                    Serial.print("AWS IoT MQTT connection failed, rc=");
                    Serial.println(mqttClient.lastError());
                }
                lastAWSAttemptTime = currentMillis;
            }
        }
    }

    // --- MQTT & Config ---
    mqttClient.loop();

    if (isWiFiConnected() && currentMillis - lastConfigFetchTime >= CONFIG_FETCH_INTERVAL_MS) {
        fetchServoDuration();
        fetchWeightThreshold();
    }

    // --- Device Logic ---
    updateServoState();
    handleButtonPress();
    updateLEDs();

    // --- Periodic Status Update ---
    if (currentMillis - lastStatusPublishTime >= STATUS_PUBLISH_INTERVAL_MS) {
        publishDeviceStatus("Periodic update", "system");
        lastStatusPublishTime = currentMillis;
    }
}

// =====================================================================
// === NETWORKING & MQTT IMPLEMENTATIONS ===
// =====================================================================

void connectToWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nFailed to connect to WiFi.");
    }
}

bool isWiFiConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void connectToAWS() {
    if (mqttClient.connected()) {
        Serial.println("AWS IoT MQTT connected!");
    } else {
        Serial.println("AWS IoT MQTT not connected.");
    }
}

bool isAWSConnected() {
    return mqttClient.connected();
}

void onMqttMessage(String &topic, String &payload) {
    Serial.print("Message arrived on topic: ");
    Serial.println(topic);
    Serial.print("Payload: ");
    Serial.println(payload);

    if (topic == MQTT_SUBSCRIBE_TOPIC && payload == "FEED_NOW") {
        handleFeedCommand();
    } else {
        Serial.println("Unknown command received: " + payload);
    }
}

void handleFeedCommand() {
    Serial.println("Received 'FEED_NOW' command.");
    if (canFeed()) {
        activateFeeder("api");
    } else {
        Serial.println("Feed command denied: Weight threshold exceeded.");
        publishDeviceStatus("Feed denied - weight threshold exceeded", "api");
        publishFeedEvent("api", "denied_weight_exceeded");
    }
}

bool canFeed() {
    float currentWeight = getWeight();
    Serial.printf("Current weight: %.1fg, Threshold: %.1fg\n", currentWeight, WEIGHT_THRESHOLD_G);

    if (currentWeight >= WEIGHT_THRESHOLD_G) {
        return false;
    }
    return true;
}

void publishDeviceStatus(const char* statusMessage, const char* triggerMethod) {
    if (!isAWSConnected()) {
        Serial.println("Cannot publish status: MQTT not connected.");
        return;
    }

    StaticJsonDocument<256> doc;

    float currentWeight = getWeight();
    doc["current_weight_g"] = round(currentWeight * 10.0) / 10.0;

    switch (servoState) {
        case IDLE: doc["feeder_state"] = "IDLE"; break;
        case OPENING: doc["feeder_state"] = "OPENING"; break;
        case OPEN: doc["feeder_state"] = "OPEN"; break;
        case CLOSING: doc["feeder_state"] = "CLOSING"; break;
        case CLOSED: doc["feeder_state"] = "CLOSED"; break;
    }

    if (isWiFiConnected() && isAWSConnected()) {
        doc["network_status"] = "ONLINE";
    } else if (isWiFiConnected() && !isAWSConnected()) {
        doc["network_status"] = "WIFI_CONNECTED_MQTT_DISCONNECTED";
    } else {
        doc["network_status"] = "OFFLINE_WIFI_DISCONNECTED";
    }

    doc["message"] = statusMessage;
    if (triggerMethod != nullptr) {
        doc["trigger_method"] = triggerMethod;
    } else {
        doc["trigger_method"] = "unknown";
    }

    char jsonBuffer[256];
    serializeJson(doc, jsonBuffer);

    mqttClient.publish(MQTT_PUBLISH_TOPIC, jsonBuffer);
    Serial.print("Published JSON status: ");
    Serial.println(jsonBuffer);
}

void publishFeedEvent(const char* triggerMethod, const char* status) {
    if (!isAWSConnected()) {
        Serial.println("Cannot publish feed event: MQTT not connected.");
        return;
    }

    StaticJsonDocument<128> doc;

    // Determine mode based on trigger method
    if (strcmp(triggerMethod, "button") == 0) {
        doc["mode"] = "manual";
        doc["requested_by"] = "physical_button";
    } else if (strcmp(triggerMethod, "api") == 0) {
        doc["mode"] = "api";
        doc["requested_by"] = "api_user";
    } else {
        doc["mode"] = "unknown";
        doc["requested_by"] = "unknown";
    }

    doc["status"] = status;
    doc["trigger_method"] = triggerMethod;

    char jsonBuffer[128];
    serializeJson(doc, jsonBuffer);

    mqttClient.publish(MQTT_FEED_EVENT_TOPIC, jsonBuffer);
    Serial.print("Published feed event: ");
    Serial.println(jsonBuffer);
}

// =====================================================================
// === DEVICE CONTROL IMPLEMENTATIONS ===
// =====================================================================

void activateFeeder(const char* triggerMethod) {
    if (servoState == CLOSED) {
        Serial.println("Activating feeder: starting slow opening sweep.");
        servoState = OPENING;
        servoMoveStartTime = millis();
        // Publish status immediately so user sees weight update quickly
        publishDeviceStatus("Feeder opening", triggerMethod);
        // Log feed event to history
        publishFeedEvent(triggerMethod, "sent");
    } else {
        Serial.println("Feeder is currently busy. Cannot activate.");
        publishDeviceStatus("Feeder busy", triggerMethod);
        publishFeedEvent(triggerMethod, "failed");
    }
}

void updateServoState() {
    unsigned long currentMillis = millis();

    switch (servoState) {
        case CLOSED:
            break;

        case OPENING: {
            long elapsedTime = currentMillis - servoMoveStartTime;
            if (elapsedTime < SERVO_SWEEP_DURATION_MS) {
                int newAngle = map(elapsedTime, 0, SERVO_SWEEP_DURATION_MS, SERVO_ANGLE_CLOSED, SERVO_ANGLE_OPEN);
                myServo.write(newAngle);
            } else {
                myServo.write(SERVO_ANGLE_OPEN);
                servoState = OPEN;
                servoMoveStartTime = currentMillis;
                Serial.println("Servo state changed to: OPEN (after slow opening)");
                publishDeviceStatus("Feeder open", "servo_event");
            }
            break;
        }

        case OPEN:
            if (currentMillis - servoMoveStartTime >= SERVO_OPEN_HOLD_DURATION_MS) {
                Serial.println("Starting to close servo slowly...");
                servoState = CLOSING;
                servoMoveStartTime = currentMillis;
                // Publish status during transition to show weight change
                publishDeviceStatus("Feeder closing", "servo_event");
            }
            break;

        case CLOSING: {
            long elapsedTime = currentMillis - servoMoveStartTime;
            if (elapsedTime < SERVO_SWEEP_DURATION_MS) {
                int baseAngle = map(elapsedTime, 0, SERVO_SWEEP_DURATION_MS, SERVO_ANGLE_OPEN, SERVO_ANGLE_CLOSED);

                const int VIBRATION_AMPLITUDE = 2;
                const int VIBRATION_FREQUENCY_HZ = 40;
                const int VIBRATION_PERIOD_MS = 1000 / VIBRATION_FREQUENCY_HZ;

                int offsetIndex = (currentMillis / VIBRATION_PERIOD_MS) % 2;
                int vibrationOffset = (offsetIndex == 0) ? VIBRATION_AMPLITUDE : -VIBRATION_AMPLITUDE;

                int newAngle = baseAngle + vibrationOffset;

                myServo.write(newAngle);
            } else {
                myServo.write(SERVO_ANGLE_CLOSED);
                servoState = CLOSED;
                Serial.println("Servo state changed to: CLOSED (after slow closing)");
                // Publish final status immediately after feed completes so user sees updated weight
                publishDeviceStatus("Feed completed", "servo_event");
            }
            break;
        }
        case IDLE:
            break;
    }
}

void handleButtonPress() {
    static unsigned long lastDebounceTime = 0;
    static int lastButtonState = HIGH;
    static const unsigned long debounceDelay = 50;

    int reading = digitalRead(BUTTON_PIN);

    if (reading != lastButtonState) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > debounceDelay) {
        if (reading == LOW && !buttonPressed) {
            buttonPressed = true;
            Serial.println("Button pressed!");
            activateFeeder("button");
        }
        else if (reading == HIGH && buttonPressed) {
            buttonPressed = false;
            Serial.println("Button released.");
        }
    }
    lastButtonState = reading;
}

void updateLEDs() {
    bool wifiConnected = isWiFiConnected();
    bool awsConnected = isAWSConnected();
    bool feederActive = (servoState != CLOSED);

    if (wifiConnected && awsConnected) {
        digitalWrite(RED_LED_PIN, LOW);

        if (feederActive) {
            unsigned long currentMillis = millis();
            static unsigned long lastBlinkTime = 0;
            const unsigned long blinkInterval = 200;
            if (currentMillis - lastBlinkTime >= blinkInterval) {
                digitalWrite(GREEN_LED_PIN, !digitalRead(GREEN_LED_PIN));
                lastBlinkTime = currentMillis;
            }
        } else {
            digitalWrite(GREEN_LED_PIN, HIGH);
        }
    } else {
        digitalWrite(GREEN_LED_PIN, LOW);

        unsigned long currentMillis = millis();
        static unsigned long lastBlinkTime = 0;
        const unsigned long blinkInterval = 500;
        if (currentMillis - lastBlinkTime >= blinkInterval) {
            digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
            lastBlinkTime = currentMillis;
        }
    }
}