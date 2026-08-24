import os
import re
import sys

# Paths
WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
INO_PATH = os.path.join(WORKSPACE_DIR, "sceas", "esp32", "sceas_esp32.ino")

def verify_file_exists():
    print("[STATIC] Verifying file exists...")
    if not os.path.isfile(INO_PATH):
        print(f"Error: {INO_PATH} not found.")
        sys.exit(1)
    print("Success: sceas_esp32.ino exists.")

def perform_static_analysis():
    print("\n[STATIC] Performing static analysis checks...")
    with open(INO_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Mandatory Includes
    mandatory_includes = ["WiFi.h", "HTTPClient.h", "ArduinoJson.h", "PZEM004Tv30.h"]
    for inc in mandatory_includes:
        pattern = rf'#include\s*[<"]{re.escape(inc)}[>"]'
        if not re.search(pattern, content):
            print(f"Error: Missing mandatory include: {inc}")
            sys.exit(1)
        print(f"Passed: Include {inc} is present.")

    # 2. Setup and Loop presence
    if not re.search(r'\bvoid\s+setup\s*\(\s*\)', content):
        print("Error: setup() function not found.")
        sys.exit(1)
    if not re.search(r'\bvoid\s+loop\s*\(\s*\)', content):
        print("Error: loop() function not found.")
        sys.exit(1)
    print("Passed: setup() and loop() are present.")

    # 3. Pin Configuration Checks
    pin_rules = {
        "PIR_PIN": 13,
        "TRIG_PIN": 12,
        "ECHO_PIN": 14,
        "RELAY_PIN": 27,
        "PZEM_RX_PIN": 16,
        "PZEM_TX_PIN": 17
    }

    for pin_name, val in pin_rules.items():
        # Match either #define PIN_NAME val or const ... PIN_NAME = val;
        pattern_define = rf'#define\s+{pin_name}\s+{val}\b'
        pattern_const = rf'const\s+(?:unsigned\s+)?int\s+{pin_name}\s*=\s*{val}\b'
        if not (re.search(pattern_define, content) or re.search(pattern_const, content)):
            print(f"Error: Pin configuration check failed for {pin_name}. Expected value: {val}.")
            sys.exit(1)
        print(f"Passed: {pin_name} configuration matches expected value {val}.")

    print("Static analysis completed successfully.")


# ============================================================================
# STATE MACHINE PYTHON RECREATION & UNIT TESTS
# ============================================================================

class ESP32StateMachineSimulator:
    def __init__(self, room_id="1"):
        self.room_id = room_id
        
        # State
        self.current_state = "VACANT"
        self.manual_override_active = False
        
        # Offline Queue
        self.status_update_pending = False
        self.pending_status_state = "VACANT"
        
        # Timers
        self.presence_timer = 0
        self.vacancy_timer = 0
        self.last_status_poll_time = 0
        self.last_telemetry_time = 0
        
        # Sim helper
        self.relay_state = "LOW"
        self.patched_states = []

    def mock_patch_status(self, state, wifi_connected):
        if not wifi_connected:
            return False
        self.patched_states.append(state)
        return True

    def transition_state(self, new_state, wifi_connected):
        self.current_state = new_state
        self.relay_state = "HIGH" if new_state == "OCCUPIED" else "LOW"
        
        if not self.mock_patch_status(new_state, wifi_connected):
            self.status_update_pending = True
            self.pending_status_state = new_state
        else:
            self.status_update_pending = False

    def setup_recovery(self, wifi_connected, get_succeeds, db_override, db_status, pir, distance):
        get_success = False
        
        if wifi_connected and get_succeeds:
            get_success = True
            self.manual_override_active = db_override
            
            if self.manual_override_active:
                self.current_state = db_status
                self.relay_state = "HIGH" if db_status == "OCCUPIED" else "LOW"
            else:
                presence = pir and (distance < 200)
                immediate_state = "OCCUPIED" if presence else "VACANT"
                self.current_state = immediate_state
                self.relay_state = "HIGH" if immediate_state == "OCCUPIED" else "LOW"
                
                if self.current_state != db_status:
                    if not self.mock_patch_status(self.current_state, wifi_connected):
                        self.status_update_pending = True
                        self.pending_status_state = self.current_state

        if not get_success:
            self.manual_override_active = False
            presence = pir and (distance < 200)
            immediate_state = "OCCUPIED" if presence else "VACANT"
            self.current_state = immediate_state
            self.relay_state = "HIGH" if immediate_state == "OCCUPIED" else "LOW"
            
            self.status_update_pending = True
            self.pending_status_state = immediate_state

    def loop_step(self, current_millis, wifi_connected, pir, distance, db_override, db_status):
        # Network recovery queue flush
        if wifi_connected and self.status_update_pending:
            if self.mock_patch_status(self.pending_status_state, wifi_connected):
                self.status_update_pending = False

        # Status polling every 3000ms
        if current_millis - self.last_status_poll_time >= 3000:
            self.last_status_poll_time = current_millis
            if wifi_connected:
                # Flush pending if exists
                if self.status_update_pending:
                    if self.mock_patch_status(self.pending_status_state, wifi_connected):
                        self.status_update_pending = False
                
                # Fetch DB config
                if db_override:
                    self.manual_override_active = True
                    if self.current_state != db_status:
                        self.current_state = db_status
                        self.relay_state = "HIGH" if db_status == "OCCUPIED" else "LOW"
                else:
                    if self.manual_override_active:
                        self.manual_override_active = False
                        # Immediate deactivation evaluation
                        presence = pir and (distance < 200)
                        immediate_state = "OCCUPIED" if presence else "VACANT"
                        self.presence_timer = 0
                        self.vacancy_timer = 0
                        self.transition_state(immediate_state, wifi_connected)

        # Run state machine if not overridden
        if not self.manual_override_active:
            presence_detected = pir and (distance < 200)
            
            if self.current_state == "VACANT":
                if presence_detected:
                    if self.presence_timer == 0:
                        self.presence_timer = current_millis
                    if current_millis - self.presence_timer >= 5000:
                        self.transition_state("OCCUPIED", wifi_connected)
                        self.presence_timer = 0
                else:
                    self.presence_timer = 0
            
            elif self.current_state == "OCCUPIED":
                if not presence_detected:
                    if self.vacancy_timer == 0:
                        self.vacancy_timer = current_millis
                    if current_millis - self.vacancy_timer >= 60000:
                        self.transition_state("VACANT", wifi_connected)
                        self.vacancy_timer = 0
                else:
                    self.vacancy_timer = 0


# ============================================================================
# UNIT TESTS EXECUTION
# ============================================================================

def run_unit_tests():
    print("\n[UNIT TESTS] Starting state machine logic simulation tests...")
    
    # --- Test Case 1: 5s presence debounce ---
    sim = ESP32StateMachineSimulator()
    sim.current_state = "VACANT"
    
    # Presence detected continuously
    sim.loop_step(1000, True, True, 150, False, "VACANT")
    assert sim.current_state == "VACANT", "TC1 Fail: transitioned too early"
    sim.loop_step(3000, True, True, 150, False, "VACANT")
    assert sim.current_state == "VACANT", "TC1 Fail: transitioned too early"
    sim.loop_step(5000, True, True, 150, False, "VACANT")
    assert sim.current_state == "VACANT", "TC1 Fail: transitioned too early (needs 5000ms duration from start)"
    
    # Start timer at 6000 (after resetting presence timer at 5500)
    sim.loop_step(5500, True, False, 250, False, "VACANT")
    sim.loop_step(6000, True, True, 150, False, "VACANT") # Timer starts
    sim.loop_step(8000, True, True, 150, False, "VACANT")
    sim.loop_step(10000, True, True, 150, False, "VACANT")
    assert sim.current_state == "VACANT", "TC1 Fail: transitioned before 5s debounce threshold"
    
    sim.loop_step(11000, True, True, 150, False, "VACANT") # 5000ms elapsed
    assert sim.current_state == "OCCUPIED", "TC1 Fail: failed to transition to OCCUPIED after 5s presence"
    assert "OCCUPIED" in sim.patched_states, "TC1 Fail: status PATCH was not recorded"
    print("Passed: 5s presence debounce logic.")

    # --- Test Case 2: 60s vacancy debounce ---
    sim = ESP32StateMachineSimulator()
    sim.current_state = "OCCUPIED"
    
    # Vacancy detected continuously from t=1000
    sim.loop_step(1000, True, False, 250, False, "OCCUPIED") # Timer starts
    sim.loop_step(30000, True, False, 250, False, "OCCUPIED")
    sim.loop_step(60000, True, False, 250, False, "OCCUPIED")
    assert sim.current_state == "OCCUPIED", "TC2 Fail: transitioned before 60s vacancy debounce threshold"
    
    sim.loop_step(61000, True, False, 250, False, "OCCUPIED") # 60000ms elapsed
    assert sim.current_state == "VACANT", "TC2 Fail: failed to transition to VACANT after 60s vacancy"
    assert "VACANT" in sim.patched_states, "TC2 Fail: status PATCH was not recorded"
    print("Passed: 60s vacancy debounce logic.")

    # --- Test Case 3: Manual override suspension ---
    sim = ESP32StateMachineSimulator()
    # Override active, status = OCCUPIED
    sim.setup_recovery(True, True, True, "OCCUPIED", False, 250)
    assert sim.current_state == "OCCUPIED"
    assert sim.manual_override_active is True
    
    # Run loop step with vacancy sensors
    sim.loop_step(1000, True, False, 250, True, "OCCUPIED")
    sim.loop_step(70000, True, False, 250, True, "OCCUPIED")
    # Should stay OCCUPIED because override is active
    assert sim.current_state == "OCCUPIED", "TC3 Fail: State machine ran sensor logic during active override"
    print("Passed: Sensor logic suspended during manual override.")

    # --- Test Case 4: Immediate deactivation resume ---
    sim = ESP32StateMachineSimulator()
    # Initial: Override active, status = OCCUPIED
    sim.setup_recovery(True, True, True, "OCCUPIED", False, 250)
    sim.last_status_poll_time = 0
    
    # Loop step at t=3000, override goes to False. Sensors show vacancy (pir=False, distance=250)
    # The status poll is executed, detects override false. It should IMMEDIATELY transition to VACANT.
    sim.loop_step(3000, True, False, 250, False, "OCCUPIED")
    assert sim.manual_override_active is False, "TC4 Fail: Override not deactivated"
    assert sim.current_state == "VACANT", "TC4 Fail: Did not perform immediate sensor evaluation and transition"
    assert "VACANT" in sim.patched_states, "TC4 Fail: Transition not patched to database"
    print("Passed: Immediate sensor evaluation and transition on override deactivation.")

    # --- Test Case 5: Boot recovery logic ---
    # Case 5.1: Boot when override is active (follows DB status)
    sim = ESP32StateMachineSimulator()
    sim.setup_recovery(True, True, True, "OCCUPIED", False, 250)
    assert sim.manual_override_active is True
    assert sim.current_state == "OCCUPIED"
    assert sim.relay_state == "HIGH"

    # Case 5.2: Boot when auto mode, database status is different from sensor status (syncs immediately)
    sim = ESP32StateMachineSimulator()
    # Sensors show presence (pir=True, distance=150 -> OCCUPIED), but DB says VACANT
    sim.setup_recovery(True, True, False, "VACANT", True, 150)
    assert sim.manual_override_active is False
    assert sim.current_state == "OCCUPIED"
    assert "OCCUPIED" in sim.patched_states, "TC5.2 Fail: Boot sync status PATCH was not recorded"

    # Case 5.3: Boot when GET fails / offline (fallback to sensors, flags pending state)
    sim = ESP32StateMachineSimulator()
    # Sensors show vacancy (pir=False -> VACANT)
    sim.setup_recovery(True, False, False, "OCCUPIED", False, 250)
    assert sim.manual_override_active is False
    assert sim.current_state == "VACANT"
    assert sim.status_update_pending is True
    assert sim.pending_status_state == "VACANT"
    print("Passed: Boot recovery logic configurations.")

    # --- Test Case 6: Local status sync and offline queue ---
    sim = ESP32StateMachineSimulator()
    sim.current_state = "VACANT"
    # Transition to OCCUPIED while offline
    sim.transition_state("OCCUPIED", False)
    assert sim.current_state == "OCCUPIED"
    assert sim.status_update_pending is True
    assert sim.pending_status_state == "OCCUPIED"
    
    # Restore connection and run loop step: should flush queue
    sim.loop_step(1000, True, True, 150, False, "VACANT")
    assert sim.status_update_pending is False, "TC6 Fail: Pending update was not flushed when online"
    assert "OCCUPIED" in sim.patched_states, "TC6 Fail: Flushed update not recorded"
    print("Passed: Local status sync and offline queue retry logic.")

    print("\nAll unit tests passed successfully!")

if __name__ == "__main__":
    verify_file_exists()
    perform_static_analysis()
    run_unit_tests()
