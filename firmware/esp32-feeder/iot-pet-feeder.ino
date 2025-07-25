#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <MQTTClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h> // For building JSON payloads

// --- Configuration Constants ---
const char* WIFI_SSID = "...";
const char* WIFI_PASSWORD = "...";

const char* AWS_IOT_ENDPOINT = "a1mm0cek76sanp...";
const int AWS_IOT_PORT = 8883;

const char* MQTT_CLIENT_ID = "PetFeeder";
const char* MQTT_SUBSCRIBE_TOPIC = "petfeeder/commands";
const char* MQTT_PUBLISH_TOPIC = "petfeeder/status"; // Will publish JSON status here

const int BUTTON_PIN = 27;
const int SERVO_PIN = 25;
const int GREEN_LED_PIN = 32;
const int RED_LED_PIN = 33;

const int SERVO_ANGLE_OPEN = 90; // Adjusted from 110 to 90
const int SERVO_ANGLE_CLOSED = 0;
const unsigned long SERVO_SWEEP_DURATION_MS = 1000; // Total time for one full sweep (open or close)
const unsigned long SERVO_OPEN_HOLD_DURATION_MS = 1500; // How long servo stays open after reaching open position (changed from 10ms to 2000ms)

const unsigned long WIFI_RECONNECT_DELAY_MS = 5000; // 5 seconds between WiFi reconnection attempts
const unsigned long AWS_RECONNECT_DELAY_MS = 5000;  // 5 seconds between AWS MQTT reconnection attempts
const unsigned long STATUS_PUBLISH_INTERVAL_MS = 15 * 60 * 1000; // Publish full status every 15 minutes

// Certificates
const char* AWS_ROOT_CA = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
b3QgQ0EgMTCCASIwDQYJKoZIhv...
-----END CERTIFICATE-----
)EOF";

const char* AWS_CLIENT_CERT = R"KEY(
-----BEGIN CERTIFICATE-----
MIIDWTCCAkGgAwIBAgIUQvrplKNxr1qRGXzDqRk+2xG4H1cwDQYJKoZIhvcNAQEL
BQAwTTFLMEkGA1UECwxCQW1hem9uIFdlYiBTZXJ2aWNlcyBPPUFtYXpvbi5jb20g
SW5jLiBMPVNlYXR0bGUgU1Q9...
-----END CERTIFICATE-----
)KEY";

const char* AWS_PRIVATE_KEY = R"KEY(
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA14dNt585HIGfXKv905c9IbFD9tSbsc6rAxJXFLZBoe4bqui0
iVrZ1STn0hgA7zhqTWbgl0cjHYe1Yd6960FxC4vTXjDNlBnVPHwvbRiDZpvs3HAm
1bmKlpab/0kiMc/mMUUR2t3Yi2DoDMY+vjf2GfdYY11AlGRyo+/un4WEAq5max8w
F0l8Be9Bzr/LOCYpWEaKlmvN621UBDw60aAeldeKZ6hVpL7lVkJjWfRts9sDVDLQ
LljzBLcLLC8XziWK6ztvjpoRX+...
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

// --- Non-Blocking Reconnection Timers ---
unsigned long lastWiFiAttemptTime = 0;
unsigned long lastAWSAttemptTime = 0;
unsigned long lastStatusPublishTime = 0; // Timer for periodic status updates

// --- Function Prototypes ---
// Networking
void connectToWiFi();
bool isWiFiConnected();
void connectToAWS();
bool isAWSConnected();

// MQTT Callbacks & Actions
void onMqttMessage(String &topic, String &payload);
void handleFeedCommand();
void publishDeviceStatus(const char* statusMessage, const char* triggerMethod = nullptr); // Added triggerMethod

// Device Control
void activateFeeder(const char* triggerMethod = nullptr); // Added triggerMethod
void updateServoState();
void handleButtonPress();
void updateLEDs(); // Function for LED control based on state

// The moveServoSmoothly function is no longer needed as a separate blocking function
// Its logic is now integrated into updateServoState for non-blocking operation.

// --- Setup Function ---
void setup() {
    Serial.begin(115200);
    while (!Serial && millis() < 5000) delay(1); // Wait for Serial Monitor
    Serial.println("\n--- Pet Feeder Device Setup ---");

    // Initialize Pins
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(RED_LED_PIN, OUTPUT);
    myServo.attach(SERVO_PIN);
    myServo.write(SERVO_ANGLE_CLOSED); // Ensure servo starts closed

    // Set initial LED state (will be updated by updateLEDs in loop)
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, HIGH); // Assume disconnected initially

    // Configure Secure Client with Certificates
    net.setCACert(AWS_ROOT_CA);
    net.setCertificate(AWS_CLIENT_CERT);
    net.setPrivateKey(AWS_PRIVATE_KEY);

    // Configure MQTT Client
    mqttClient.begin(AWS_IOT_ENDPOINT, AWS_IOT_PORT, net);
    mqttClient.onMessage(onMqttMessage);

    // Initial network setup attempt - non-blocking calls will be handled in loop
    Serial.println("Attempting initial network connection...");
    lastWiFiAttemptTime = millis() - WIFI_RECONNECT_DELAY_MS; // Allow immediate first attempt
    lastAWSAttemptTime = millis() - AWS_RECONNECT_DELAY_MS;   // Allow immediate first attempt
    lastStatusPublishTime = millis() - STATUS_PUBLISH_INTERVAL_MS; // Allow immediate first status publish
}

// --- Loop Function ---
void loop() {
    unsigned long currentMillis = millis();

    // --- Network Management (Non-Blocking) ---
    if (!isWiFiConnected()) {
        if (currentMillis - lastWiFiAttemptTime >= WIFI_RECONNECT_DELAY_MS) {
            Serial.println("WiFi disconnected. Attempting reconnect...");
            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
            lastWiFiAttemptTime = currentMillis; // Update last attempt time
        }
    } else {
        // If WiFi is connected, attempt AWS connection
        if (!isAWSConnected()) {
            if (currentMillis - lastAWSAttemptTime >= AWS_RECONNECT_DELAY_MS) {
                Serial.println("MQTT not connected. Attempting reconnect...");
                if (mqttClient.connect(MQTT_CLIENT_ID)) {
                    Serial.println("AWS IoT MQTT connected!");
                    mqttClient.subscribe(MQTT_SUBSCRIBE_TOPIC);
                    Serial.print("Subscribed to: ");
                    Serial.println(MQTT_SUBSCRIBE_TOPIC);
                    // No immediate publish here, let the periodic publish handle it
                } else {
                    Serial.print("AWS IoT MQTT connection failed, rc=");
                    Serial.println(mqttClient.lastError());
                }
                lastAWSAttemptTime = currentMillis; // Update last attempt time
            }
        }
    }

    // --- MQTT Loop (Essential for connection maintenance and message processing) ---
    mqttClient.loop();

    // --- Device Logic (Always running, regardless of network status) ---
    updateServoState(); // Now handles smooth movement non-blocking
    handleButtonPress(); // This will now run even during network retry periods
    updateLEDs(); // LEDs reflect network and device state

    // --- Periodic Status Update ---
    if (currentMillis - lastStatusPublishTime >= STATUS_PUBLISH_INTERVAL_MS) {
        publishDeviceStatus("Periodic update", "system"); // Send a full status update
        lastStatusPublishTime = currentMillis;
    }
}

// --- Networking Functions ---
// Note: These functions are now primarily status checks and initial triggers.
// The actual reconnection logic is managed by timers in the loop().

void connectToWiFi() {
    // This function is now mostly for initial setup and logging.
    // The actual WiFi.begin() call is managed by the loop's timer.
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
    // This function is now mostly for initial setup and logging.
    // The actual mqttClient.connect() call is managed by the loop's timer.
    if (mqttClient.connected()) {
        Serial.println("AWS IoT MQTT connected!");
    } else {
        Serial.println("AWS IoT MQTT not connected.");
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
        handleFeedCommand(); // API-triggered command
    } else {
        Serial.println("Unknown command received: " + payload);
    }
}

void handleFeedCommand() {
    Serial.println("Received 'FEED_NOW' command.");
    activateFeeder("api"); // Indicate API as trigger method
}

// publishDeviceStatus now sends a JSON payload with more details
void publishDeviceStatus(const char* statusMessage, const char* triggerMethod) {
    if (!isAWSConnected()) {
        Serial.println("Cannot publish status: MQTT not connected.");
        return; // Don't attempt to publish if not connected
    }

    StaticJsonDocument<256> doc; // ArduinoJson buffer size

    // Add feeder state
    switch (servoState) {
        case IDLE: doc["feeder_state"] = "IDLE"; break;
        case OPENING: doc["feeder_state"] = "OPENING"; break;
        case OPEN: doc["feeder_state"] = "OPEN"; break;
        case CLOSING: doc["feeder_state"] = "CLOSING"; break;
        case CLOSED: doc["feeder_state"] = "CLOSED"; break;
    }

    // Add network status
    if (isWiFiConnected() && isAWSConnected()) {
        doc["network_status"] = "ONLINE";
    } else if (isWiFiConnected() && !isAWSConnected()) {
        doc["network_status"] = "WIFI_CONNECTED_MQTT_DISCONNECTED";
    } else {
        doc["network_status"] = "OFFLINE_WIFI_DISCONNECTED";
    }

    doc["message"] = statusMessage;
    if (triggerMethod != nullptr) { // Only add if provided
        doc["trigger_method"] = triggerMethod;
    } else {
        doc["trigger_method"] = "unknown"; // Default if not specified
    }

    char jsonBuffer[256];
    serializeJson(doc, jsonBuffer);

    mqttClient.publish(MQTT_PUBLISH_TOPIC, jsonBuffer);
    Serial.print("Published JSON status: ");
    Serial.println(jsonBuffer);
}

// --- Device Control Functions ---

// activateFeeder now takes a triggerMethod argument
void activateFeeder(const char* triggerMethod) {
    if (servoState == CLOSED) { // Only activate if truly closed and ready
        Serial.println("Activating feeder: starting slow opening sweep.");
        servoState = OPENING; // Set state to OPENING
        servoMoveStartTime = millis(); // Start timer for the sweep
        publishDeviceStatus("Feeder opening", triggerMethod);
    } else {
        Serial.println("Feeder is currently busy. Cannot activate.");
        publishDeviceStatus("Feeder busy", triggerMethod);
    }
}

void updateServoState() {
    unsigned long currentMillis = millis();

    switch (servoState) {
        case CLOSED:
            // Servo is closed and idle, waiting for a command
            break;

        case OPENING: {
            long elapsedTime = currentMillis - servoMoveStartTime;
            if (elapsedTime < SERVO_SWEEP_DURATION_MS) {
                // Calculate current angle based on elapsed time for a smooth sweep
                int newAngle = map(elapsedTime, 0, SERVO_SWEEP_DURATION_MS, SERVO_ANGLE_CLOSED, SERVO_ANGLE_OPEN);
                myServo.write(newAngle);
            } else {
                // Reached open position
                myServo.write(SERVO_ANGLE_OPEN); // Ensure it's fully open
                servoState = OPEN;
                servoMoveStartTime = currentMillis; // Reset timer for holding open duration
                Serial.println("Servo state changed to: OPEN (after slow opening)");
                publishDeviceStatus("Feeder open", "servo_event");
            }
            break;
        }

        case OPEN:
            // Servo is open, holding position
            if (currentMillis - servoMoveStartTime >= SERVO_OPEN_HOLD_DURATION_MS) {
                Serial.println("Starting to close servo slowly...");
                servoState = CLOSING; // Transition to CLOSING
                servoMoveStartTime = currentMillis; // Reset timer for closing sweep
            }
            break;

        case CLOSING: {
            long elapsedTime = currentMillis - servoMoveStartTime;
            if (elapsedTime < SERVO_SWEEP_DURATION_MS) {
                // Calculate current angle based on elapsed time for a smooth sweep
                int newAngle = map(elapsedTime, 0, SERVO_SWEEP_DURATION_MS, SERVO_ANGLE_OPEN, SERVO_ANGLE_CLOSED);
                myServo.write(newAngle);
            } else {
                // Reached closed position
                myServo.write(SERVO_ANGLE_CLOSED); // Ensure it's fully closed
                servoState = CLOSED;
                Serial.println("Servo state changed to: CLOSED (after slow closing)");
                publishDeviceStatus("Feeder ready", "servo_event");
            }
            break;
        }
        case IDLE: // IDLE state is not explicitly used in the current flow, but good to have.
            break;
    }
}

void handleButtonPress() {
    static unsigned long lastDebounceTime = 0;
    static int lastButtonState = HIGH; // Initialize with button released state
    static const unsigned long debounceDelay = 50; // Use a static const for debounceDelay

    int reading = digitalRead(BUTTON_PIN);

    // If the button state has changed
    if (reading != lastButtonState) {
        lastDebounceTime = millis(); // Reset the debounce timer
    }

    // If the button state has been stable for longer than the debounce delay
    if ((millis() - lastDebounceTime) > debounceDelay) {
        // If the button is pressed (LOW) AND it was previously not considered pressed
        if (reading == LOW && !buttonPressed) {
            buttonPressed = true; // Mark as pressed
            Serial.println("Button pressed!"); // Kept this for confirmation
            activateFeeder("button"); // Pass "button" as trigger method
        }
        // If the button is released (HIGH) AND it was previously considered pressed
        else if (reading == HIGH && buttonPressed) {
            buttonPressed = false; // Mark as released
            Serial.println("Button released."); // Kept this for confirmation
        }
    }
    lastButtonState = reading; // Save the current reading for the next loop iteration
}

void updateLEDs() {
    // Green LED: Indicates operational status (online and ready, or feeding)
    // Red LED: Indicates network issues

    bool wifiConnected = isWiFiConnected();
    bool awsConnected = isAWSConnected();
    bool feederActive = (servoState != CLOSED); // Feeder is active if opening, open, or closing

    if (wifiConnected && awsConnected) {
        // Fully online
        digitalWrite(RED_LED_PIN, LOW); // Red OFF

        if (feederActive) {
            // Green LED blinking when online and feeding
            unsigned long currentMillis = millis();
            static unsigned long lastBlinkTime = 0;
            const unsigned long blinkInterval = 200; // Blink every 200ms
            if (currentMillis - lastBlinkTime >= blinkInterval) {
                digitalWrite(GREEN_LED_PIN, !digitalRead(GREEN_LED_PIN)); // Toggle Green LED
                lastBlinkTime = currentMillis;
            }
        } else {
            // Green LED solid ON when online and ready
            digitalWrite(GREEN_LED_PIN, HIGH);
        }
    } else {
        // Offline (WiFi or MQTT disconnected)
        digitalWrite(GREEN_LED_PIN, LOW); // Green OFF

        // Red LED blinking when offline/reconnecting
        unsigned long currentMillis = millis();
        static unsigned long lastBlinkTime = 0;
        const unsigned long blinkInterval = 500; // Blink every 500ms when offline
        if (currentMillis - lastBlinkTime >= blinkInterval) {
            digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN)); // Toggle Red LED
            lastBlinkTime = currentMillis;
        }
    }
}
