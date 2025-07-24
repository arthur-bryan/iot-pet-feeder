#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <MQTTClient.h>
#include <ESP32Servo.h>

// --- Configuration Constants ---
const char* WIFI_SSID = "<YOUR_WIFI_SSID>";
const char* WIFI_PASSWORD = "<YOUR_WIFI_PASSWORD>";

const char* AWS_IOT_ENDPOINT = "<YOUR_IOT_ENDPOINT>"; // e.g., "a1b2c3d4e5f6g7h8.iot.us-west-2.amazonaws.com
const int AWS_IOT_PORT = 8883;

const char* MQTT_CLIENT_ID = "PetFeeder";
const char* MQTT_SUBSCRIBE_TOPIC = "petfeeder/commands";
const char* MQTT_PUBLISH_TOPIC = "petfeeder/status";

const int BUTTON_PIN = 26;
const int SERVO_PIN = 25;
const int GREEN_LED_PIN = 32;
const int RED_LED_PIN = 33;

const int SERVO_ANGLE_OPEN = 110;
const int SERVO_ANGLE_CLOSED = 0;
const unsigned long SERVO_MOVE_DURATION_MS = 2000;      // Time for servo to move (open or close)
const unsigned long SERVO_OPEN_HOLD_DURATION_MS = 10; // How long servo stays open after reaching open position

const unsigned long WIFI_RECONNECT_DELAY_MS = 5000;
const unsigned long AWS_RECONNECT_DELAY_MS = 5000;

// Certificates
const char* AWS_ROOT_CA = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1...
-----END CERTIFICATE-----
)EOF";

const char* AWS_CLIENT_CERT = R"KEY(
-----BEGIN CERTIFICATE-----
MIIDWTCCAkGgAwIBAgIUWxCRrJBLwCO1HLlsVQTup4wUIKQwDQYJKoZIhvcNAQEL
BQAwTTFLMEkGA1UECwxCQW1hem9uIFdlYiBTZXJ2aWNlcyBPPUFtYXpvbi5jb20g
SW5jLiBMPVNlYXR0bGUgU1Q9V2FzaGluZ3RvbiBDP...
-----END CERTIFICATE-----
)KEY";

const char* AWS_PRIVATE_KEY = R"KEY(
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAvzSaw5olatr/XdkqDeT8Byb4lPlr/splX76XyVW31nwXEIDQ
YjNhMsoak8hcBYWgOOgpnEGQqbkvPWJf4V0hrGquqUoQ5b2SbSy7yGcz+0vLHhMB
YVYzP35d85a5UcKG1aySsGcuxL8wZXZdE6DZa4o...
-----END RSA PRIVATE KEY-----
)KEY";

// --- Global Objects ---
WiFiClientSecure net;
MQTTClient mqttClient(256);
Servo myServo;

// --- Servo State Machine ---
enum ServoState { IDLE, OPENING, OPEN, CLOSING, CLOSED };
ServoState servoState = CLOSED;

unsigned long servoMoveStartTime = 0;
bool buttonPressed = false; // For button debouncing

// --- Function Prototypes ---
void connectToWiFi();
bool isWiFiConnected();
void connectToAWS();
bool isAWSConnected();
void setupNetworking();
void onMqttMessage(String &topic, String &payload);
void handleFeedCommand();
void publishDeviceStatus(const char* status);
void activateFeeder();
void updateServoState();
void handleButtonPress();
void updateLEDs(); // Function for LED control

// --- Setup Function ---
void setup() {
    Serial.begin(115200);
    while (!Serial && millis() < 5000) delay(1); // Wait for Serial Monitor
    Serial.println("\n--- Pet Feeder Device Setup ---");

    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(RED_LED_PIN, OUTPUT);
    myServo.attach(SERVO_PIN);
    myServo.write(SERVO_ANGLE_CLOSED); // Ensure servo starts closed

    // Set initial LED state
    digitalWrite(GREEN_LED_PIN, HIGH); // Green ON (ready)
    digitalWrite(RED_LED_PIN, LOW);    // Red OFF
    Serial.println("LEDs initialized: Green ON, Red OFF.");

    net.setCACert(AWS_ROOT_CA);
    net.setCertificate(AWS_CLIENT_CERT);
    net.setPrivateKey(AWS_PRIVATE_KEY);

    mqttClient.begin(AWS_IOT_ENDPOINT, AWS_IOT_PORT, net);
    mqttClient.onMessage(onMqttMessage);

    setupNetworking();
}

// --- Loop Function ---
void loop() {
    if (!isWiFiConnected()) {
        connectToWiFi();
    }

    if (isWiFiConnected() && !isAWSConnected()) {
        connectToAWS();
    }

    mqttClient.loop();

    updateServoState();
    handleButtonPress();
    updateLEDs(); // Ensure this is called in every loop cycle
}

// --- Networking Functions ---
void setupNetworking() {
    connectToWiFi();
    if (isWiFiConnected()) {
        connectToAWS();
    } else {
        Serial.println("Initial WiFi connection failed. Retrying in loop.");
    }
}

void connectToWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long connectAttemptStartTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - connectAttemptStartTime < 30000) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nFailed to connect to WiFi. Retrying in " + String(WIFI_RECONNECT_DELAY_MS / 1000) + " seconds...");
        delay(WIFI_RECONNECT_DELAY_MS);
    }
}

bool isWiFiConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void connectToAWS() {
    if (mqttClient.connected()) return;

    Serial.print("Connecting to AWS IoT MQTT as: ");
    Serial.println(MQTT_CLIENT_ID);

    if (mqttClient.connect(MQTT_CLIENT_ID)) {
        Serial.println("AWS IoT MQTT connected!");
        mqttClient.subscribe(MQTT_SUBSCRIBE_TOPIC);
        Serial.print("Subscribed to: ");
        Serial.println(MQTT_SUBSCRIBE_TOPIC);
        publishDeviceStatus("Device connected");
    } else {
        Serial.print("AWS IoT MQTT connection failed, rc=");
        Serial.print(mqttClient.lastError());
        Serial.println(". Retrying in " + String(AWS_RECONNECT_DELAY_MS / 1000) + " seconds...");
        delay(AWS_RECONNECT_DELAY_MS);
    }
}

bool isAWSConnected() {
    return mqttClient.connected();
}

// --- MQTT Callbacks & Actions ---
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
    activateFeeder();
}

void publishDeviceStatus(const char* status) {
    if (isAWSConnected()) {
        mqttClient.publish(MQTT_PUBLISH_TOPIC, status);
        Serial.print("Published status: ");
        Serial.println(status);
    } else {
        Serial.println("Cannot publish status: MQTT not connected.");
    }
}

// --- Device Control Functions ---
void activateFeeder() {
    if (servoState == CLOSED) { // Only activate if truly closed and ready
        Serial.println("Activating feeder: opening servo.");
        servoState = OPENING;
        servoMoveStartTime = millis();
        myServo.write(SERVO_ANGLE_OPEN);
        publishDeviceStatus("Feeder opening");
    } else {
        Serial.println("Feeder is currently busy. Cannot activate.");
        publishDeviceStatus("Feeder busy"); // Indicate busy state
    }
}

void updateServoState() {
    if (servoState == OPENING) {
        if (millis() - servoMoveStartTime >= SERVO_MOVE_DURATION_MS) {
            myServo.write(SERVO_ANGLE_OPEN); // Ensure it's fully open
            servoState = OPEN;
            Serial.println("Servo is open. Holding position...");
            servoMoveStartTime = millis(); // Reset timer for the 'hold open' duration
            publishDeviceStatus("Feeder open");
            Serial.println("Servo state changed to: OPEN"); // Debug print
        }
    } else if (servoState == OPEN) {
        if (millis() - servoMoveStartTime >= SERVO_OPEN_HOLD_DURATION_MS) {
            Serial.println("Closing servo...");
            servoState = CLOSING;
            servoMoveStartTime = millis(); // Reset timer for the 'closing' duration
            myServo.write(SERVO_ANGLE_CLOSED);
            publishDeviceStatus("Feeder closing");
        }
    } else if (servoState == CLOSING) {
        if (millis() - servoMoveStartTime >= SERVO_MOVE_DURATION_MS) {
            myServo.write(SERVO_ANGLE_CLOSED); // Ensure it's fully closed
            servoState = CLOSED;
            Serial.println("Servo is closed. Feeder ready.");
            publishDeviceStatus("Feeder ready");
        }
    }
}

void handleButtonPress() {
    static unsigned long lastDebounceTime = 0;
    static const unsigned long debounceDelay = 50;

    int reading = digitalRead(BUTTON_PIN);

    // Only detect a transition from HIGH to LOW (press)
    if (reading == LOW && !buttonPressed && (millis() - lastDebounceTime > debounceDelay)) {
        buttonPressed = true;
        lastDebounceTime = millis();
        Serial.println("Button pressed!");
        activateFeeder(); // This will initiate the feed cycle and change servoState
    }
    // Only detect a transition from LOW to HIGH (release)
    else if (reading == HIGH && buttonPressed && (millis() - lastDebounceTime > debounceDelay)) {
        buttonPressed = false;
        lastDebounceTime = millis();
        Serial.println("Button released.");
    }
}

void updateLEDs() {
    if (servoState == CLOSED) {
        digitalWrite(GREEN_LED_PIN, HIGH); // Green ON, Feeder ready
        digitalWrite(RED_LED_PIN, LOW);    // Red OFF
    } else { // Any state other than CLOSED (OPENING, OPEN, CLOSING)
        digitalWrite(GREEN_LED_PIN, LOW);  // Green OFF
        digitalWrite(RED_LED_PIN, HIGH);   // Red ON, Feeder busy/feeding
    }
}