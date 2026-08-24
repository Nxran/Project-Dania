import sys
import time

# Simulation of the ESP32 Firmware logic from sceas_esp32.ino
class ESP32FirmwareSimulator:
    def __init__(self, api_status=200, api_latency_ms=0):
        # Configuration
        self.api_status = api_status
        self.api_latency_ms = api_latency_ms
        
        # Pins (simulated)
        self.pir_pin_high = False
        self.ultrasonic_distance = 999.0
        self.relay_state = "LOW"
        
        # State Machine Variables
        self.current_state = "VACANT"
        self.manual_override = False
        self.override_status = "VACANT"
        
        self.presence_timer_start = 0
        self.vacancy_timer_start = 0
        
        self.last_poll_time = 0
        self.last_telemetry_time = 0
        self.last_wifi_retry_time = 0
        
        self.POLL_INTERVAL = 3000
        self.TELEMETRY_INTERVAL = 10000
        self.WIFI_RETRY_INTERVAL = 15000
        
        # Offline Queue
        self.status_update_pending = False
        self.pending_status = ""
        
        # Wi-Fi State
        self.wifi_connected = True
        
        # Metrics
        self.total_simulated_time_ms = 0
        self.total_blocked_time_ms = 0
        self.api_request_count = 0
        self.sensor_reads_count = 0
        self.relay_toggles = 0
        self.max_sensor_read_delay_ms = 0
        self.last_sensor_read_time_ms = 0

    def mock_http_request(self, method, url, payload=None):
        self.api_request_count += 1
        # Add latency
        self.total_blocked_time_ms += self.api_latency_ms
        
        # Return status and code
        if self.api_status == 200 or self.api_status == 201:
            return self.api_status, "{\"manual_override\": false, \"status\": \"VACANT\"}"
        else:
            return self.api_status, "Error"

    def read_ultrasonic_distance(self):
        self.sensor_reads_count += 1
        return self.ultrasonic_distance

    def send_room_status_patch(self, status):
        if not self.wifi_connected:
            self.status_update_pending = True
            self.pending_status = status
            return
        
        # HTTP Client Timeout is 5000ms
        effective_latency = min(self.api_latency_ms, 5000)
        self.api_request_count += 1
        self.total_blocked_time_ms += effective_latency
        
        if self.api_status in [200, 201]:
            self.status_update_pending = False
        else:
            self.status_update_pending = True
            self.pending_status = status

    def poll_room_settings(self, now):
        if not self.wifi_connected:
            return
            
        if now - self.last_poll_time >= self.POLL_INTERVAL:
            self.last_poll_time = now
            effective_latency = min(self.api_latency_ms, 5000)
            status, payload = self.mock_http_request("GET", "/rest/v1/rooms")
            
            if status == 200:
                # Mock success deserialization
                pass

    def update_state_machine(self, now):
        if self.manual_override:
            self.presence_timer_start = 0
            self.vacancy_timer_start = 0
            return
            
        pir_active = self.pir_pin_high
        distance = self.read_ultrasonic_distance()
        presence_detected = pir_active and (distance < 200.0)
        
        if self.current_state == "VACANT":
            if presence_detected:
                if self.presence_timer_start == 0:
                    self.presence_timer_start = now
                elif now - self.presence_timer_start >= 5000:
                    self.current_state = "OCCUPIED"
                    if self.relay_state != "HIGH":
                        self.relay_state = "HIGH"
                        self.relay_toggles += 1
                    self.presence_timer_start = 0
                    self.send_room_status_patch("OCCUPIED")
            else:
                self.presence_timer_start = 0
            self.vacancy_timer_start = 0
        else: # OCCUPIED
            if not presence_detected:
                if self.vacancy_timer_start == 0:
                    self.vacancy_timer_start = now
                elif now - self.vacancy_timer_start >= 60000:
                    self.current_state = "VACANT"
                    if self.relay_state != "LOW":
                        self.relay_state = "LOW"
                        self.relay_toggles += 1
                    self.vacancy_timer_start = 0
                    self.send_room_status_patch("VACANT")
            else:
                self.vacancy_timer_start = 0
            self.presence_timer_start = 0

    def post_energy_telemetry(self, now):
        if not self.wifi_connected:
            return
            
        if now - self.last_telemetry_time >= self.TELEMETRY_INTERVAL:
            self.last_telemetry_time = now
            effective_latency = min(self.api_latency_ms, 5000)
            self.mock_http_request("POST", "/rest/v1/energy_readings")

    def handle_wifi_reconnection(self, now):
        if not self.wifi_connected:
            if now - self.last_wifi_retry_time >= self.WIFI_RETRY_INTERVAL:
                self.last_wifi_retry_time = now
                # In real ESP32, WiFi.begin is async, but WiFi.disconnect might block slightly
                # Here we assume WiFi reconnection is non-blocking.

    def step(self, loop_delay_ms=50):
        # Compute how long the previous loop step actually took
        # Start of this step:
        start_time = self.total_simulated_time_ms
        
        # Track sensor read delay
        if self.last_sensor_read_time_ms > 0:
            delay = start_time - self.last_sensor_read_time_ms
            if delay > self.max_sensor_read_delay_ms:
                self.max_sensor_read_delay_ms = delay
        self.last_sensor_read_time_ms = start_time
        
        # Run loop functions
        self.handle_wifi_reconnection(start_time)
        
        # If there's a pending status update, try to flush it immediately
        if self.wifi_connected and self.status_update_pending:
            self.send_room_status_patch(self.pending_status)
            
        self.poll_room_settings(start_time)
        self.update_state_machine(start_time)
        self.post_energy_telemetry(start_time)
        
        # Add the loop delay
        self.total_simulated_time_ms += loop_delay_ms

def run_simulation(api_status, api_latency_ms, description):
    print(f"\n--- Scenario: {description} ---")
    sim = ESP32FirmwareSimulator(api_status=api_status, api_latency_ms=api_latency_ms)
    
    # Enable presence detection from the start
    sim.pir_pin_high = True
    sim.ultrasonic_distance = 150.0 # 150cm (occupied)
    
    # Run simulation for 30 seconds (30,000 ms) of virtual time
    target_time_ms = 30000
    steps = 0
    while sim.total_simulated_time_ms < target_time_ms and steps < 1000:
        # Check actual simulated time at step start
        prev_blocked = sim.total_blocked_time_ms
        sim.step()
        # Add blocked time to total simulated time because blocking calls block the execution flow
        added_block_ms = sim.total_blocked_time_ms - prev_blocked
        sim.total_simulated_time_ms += added_block_ms
        steps += 1
        
    print(f"Total Simulated Time: {sim.total_simulated_time_ms / 1000:.2f}s")
    print(f"Total Blocked CPU Time: {sim.total_blocked_time_ms / 1000:.2f}s ({(sim.total_blocked_time_ms / sim.total_simulated_time_ms) * 100:.1f}%)")
    print(f"Total API Requests attempted: {sim.api_request_count}")
    print(f"Sensor Reads Count: {sim.sensor_reads_count}")
    print(f"Max Sensor Read Latency (Loop responsiveness): {sim.max_sensor_read_delay_ms / 1000:.2f}s")
    print(f"Relay State: {sim.relay_state} (Expected HIGH after 5s presence)")
    
    # Check if relay turned ON (takes 5s presence to debounce)
    if sim.relay_state == "HIGH":
        print("Result: PASS - Local control succeeded.")
    else:
        print("Result: FAIL - Local control BLOCKED or delayed.")

if __name__ == "__main__":
    # 1. Happy path: API is fast and healthy (latency = 50ms)
    run_simulation(api_status=200, api_latency_ms=50, description="Happy Path - API Healthy & Fast")
    
    # 2. API Down: API returns 500 error code immediately (latency = 10ms)
    run_simulation(api_status=500, api_latency_ms=10, description="Adversarial - API Down (HTTP 500) fast response")
    
    # 3. API Slow: API is slow/hanging (latency = 5000ms)
    run_simulation(api_status=200, api_latency_ms=5000, description="Adversarial - API Slow/Hanging (5000ms latency)")

    # 4. Worst Case: Pending update + API slow/hanging (latency = 5000ms)
    print("\n--- Scenario: Worst Case - Pending Update + API Slow/Hanging (5000ms latency) ---")
    sim = ESP32FirmwareSimulator(api_status=500, api_latency_ms=5000)
    sim.status_update_pending = True
    sim.pending_status = "OCCUPIED"
    sim.pir_pin_high = True
    sim.ultrasonic_distance = 150.0
    
    target_time_ms = 30000
    steps = 0
    while sim.total_simulated_time_ms < target_time_ms and steps < 1000:
        prev_blocked = sim.total_blocked_time_ms
        sim.step()
        added_block_ms = sim.total_blocked_time_ms - prev_blocked
        sim.total_simulated_time_ms += added_block_ms
        steps += 1
        
    print(f"Total Simulated Time: {sim.total_simulated_time_ms / 1000:.2f}s")
    print(f"Total Blocked CPU Time: {sim.total_blocked_time_ms / 1000:.2f}s ({(sim.total_blocked_time_ms / sim.total_simulated_time_ms) * 100:.1f}%)")
    print(f"Total API Requests attempted: {sim.api_request_count}")
    print(f"Sensor Reads Count: {sim.sensor_reads_count}")
    print(f"Max Sensor Read Latency (Loop responsiveness): {sim.max_sensor_read_delay_ms / 1000:.2f}s")
    print(f"Relay State: {sim.relay_state}")

