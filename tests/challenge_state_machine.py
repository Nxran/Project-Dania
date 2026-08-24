# ESP32 State Machine Adversarial Challenge Test Suite
import sys

class ESP32StateMachine:
    def __init__(self, initial_state="VACANT"):
        self.currentState = initial_state  # "VACANT" or "OCCUPIED"
        self.presenceTimerStart = 0
        self.vacancyTimerStart = 0
        self.manualOverride = False
        self.relayState = "HIGH" if initial_state == "OCCUPIED" else "LOW"
        self.patchedStatus = None
        self.numPatches = 0

    def set_manual_override(self, active, status="VACANT"):
        self.manualOverride = active
        if active:
            self.currentState = status
            self.relayState = "HIGH" if status == "OCCUPIED" else "LOW"
            self.presenceTimerStart = 0
            self.vacancyTimerStart = 0

    def updateStateMachine(self, now, pirActive, distance):
        # Unsigned 32-bit integer subtraction subtraction logic (Arduino unsigned long)
        def time_diff(t_now, t_start):
            return (t_now - t_start) & 0xFFFFFFFF

        if self.manualOverride:
            # Suspend sensor state machine
            self.presenceTimerStart = 0
            self.vacancyTimerStart = 0
            return

        presenceDetected = pirActive and (distance < 200.0)

        if self.currentState == "VACANT":
            if presenceDetected:
                if self.presenceTimerStart == 0:
                    self.presenceTimerStart = now
                elif time_diff(now, self.presenceTimerStart) >= 5000:
                    self.currentState = "OCCUPIED"
                    self.relayState = "HIGH"
                    self.presenceTimerStart = 0
                    self.patchedStatus = "OCCUPIED"
                    self.numPatches += 1
            else:
                self.presenceTimerStart = 0
            self.vacancyTimerStart = 0
        else:  # OCCUPIED
            if not presenceDetected:
                if self.vacancyTimerStart == 0:
                    self.vacancyTimerStart = now
                elif time_diff(now, self.vacancyTimerStart) >= 60000:
                    self.currentState = "VACANT"
                    self.relayState = "LOW"
                    self.vacancyTimerStart = 0
                    self.patchedStatus = "VACANT"
                    self.numPatches += 1
            else:
                self.vacancyTimerStart = 0
            self.presenceTimerStart = 0

    def resume_auto_mode(self, pirActive, distance):
        # Immediate sensor evaluation and state transition on deactivation
        presenceDetected = pirActive and (distance < 200.0)
        self.manualOverride = False
        self.currentState = "OCCUPIED" if presenceDetected else "VACANT"
        self.relayState = "HIGH" if self.currentState == "OCCUPIED" else "LOW"
        self.presenceTimerStart = 0
        self.vacancyTimerStart = 0
        self.patchedStatus = self.currentState
        self.numPatches += 1


def run_tests():
    print("======================================================================")
    print("RUNNING ESP32 STATE MACHINE ADVERSARIAL CHALLENGE TESTS")
    print("======================================================================")
    
    passed_tests = 0
    total_tests = 0

    # Helper function to assert test expectations
    def assert_test(condition, message):
        nonlocal passed_tests, total_tests
        total_tests += 1
        if condition:
            passed_tests += 1
            print(f"[PASS] {message}")
        else:
            print(f"[FAIL] {message}")
            # Do not exit immediately, let other tests run to collect full results

    # -------------------------------------------------------------------------
    # 1. Extremely Rapid Sensor Bounces (PIR high/low under 100ms)
    # -------------------------------------------------------------------------
    print("\n--- 1. Rapid Sensor Bounces Tests ---")
    
    # TC 1.1: Rapid bounces while VACANT must not transition to OCCUPIED
    sm = ESP32StateMachine("VACANT")
    for t in range(0, 10000, 50):  # bounce every 50ms for 10s
        pir = (t // 50) % 2 == 0
        sm.updateStateMachine(t, pir, 150.0)
    assert_test(sm.currentState == "VACANT", "TC 1.1: Rapid bounces while VACANT must keep state VACANT")
    assert_test(sm.relayState == "LOW", "TC 1.1: Relay must remain LOW during bounces")

    # TC 1.2: Rapid bounces while OCCUPIED must not transition to VACANT
    sm = ESP32StateMachine("OCCUPIED")
    for t in range(0, 120000, 50):  # bounce every 50ms for 120s
        pir = (t // 50) % 2 == 0
        sm.updateStateMachine(t, pir, 150.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 1.2: Rapid bounces while OCCUPIED must keep state OCCUPIED")
    assert_test(sm.relayState == "HIGH", "TC 1.2: Relay must remain HIGH during bounces")


    # -------------------------------------------------------------------------
    # 2. Boundary Conditions
    # -------------------------------------------------------------------------
    print("\n--- 2. Boundary Conditions Tests ---")

    # TC 2.1: VACANT -> OCCUPIED transitions (exactly 4999ms vs 5000ms)
    sm = ESP32StateMachine("VACANT")
    # Start detection at t=1000
    sm.updateStateMachine(1000, True, 150.0)
    # Feed updates up to t=5999 (4999ms elapsed)
    sm.updateStateMachine(5999, True, 150.0)
    assert_test(sm.currentState == "VACANT", "TC 2.1: No transition at 4999ms presence")
    # Feed update at t=6000 (5000ms elapsed)
    sm.updateStateMachine(6000, True, 150.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 2.1: Transitions to OCCUPIED at exactly 5000ms presence")
    assert_test(sm.relayState == "HIGH", "TC 2.1: Relay becomes HIGH")

    # TC 2.2: OCCUPIED -> VACANT transitions (exactly 59999ms vs 60000ms)
    sm = ESP32StateMachine("OCCUPIED")
    # Start vacancy at t=1000
    sm.updateStateMachine(1000, False, 250.0)
    # Feed updates up to t=60999 (59999ms elapsed)
    sm.updateStateMachine(60999, False, 250.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 2.2: No transition at 59999ms vacancy")
    # Feed update at t=61000 (60000ms elapsed)
    sm.updateStateMachine(61000, False, 250.0)
    assert_test(sm.currentState == "VACANT", "TC 2.2: Transitions to VACANT at exactly 60000ms vacancy")
    assert_test(sm.relayState == "LOW", "TC 2.2: Relay becomes LOW")


    # -------------------------------------------------------------------------
    # 3. Partial Dropouts
    # -------------------------------------------------------------------------
    print("\n--- 3. Partial Dropouts Tests ---")

    # TC 3.1: Sensor drops vacant for 10s, recovers occupied for 1s, drops vacant again
    sm = ESP32StateMachine("OCCUPIED")
    # t=1000: drops vacant (vacancy timer starts)
    sm.updateStateMachine(1000, False, 250.0)
    # t=11000: 10s vacant elapsed, remains OCCUPIED
    sm.updateStateMachine(11000, False, 250.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 3.1: Remains OCCUPIED after 10s vacancy")
    
    # t=11000 to t=12000: recovers occupied for 1s
    sm.updateStateMachine(11500, True, 150.0)
    sm.updateStateMachine(12000, True, 150.0)
    assert_test(sm.vacancyTimerStart == 0, "TC 3.1: Vacancy timer is reset to 0 upon recovering occupancy")
    
    # t=12000: drops vacant again
    sm.updateStateMachine(12000, False, 250.0)
    # t=71999: vacant for 59999ms
    sm.updateStateMachine(71999, False, 250.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 3.1: Remains OCCUPIED after 59999ms vacancy from last drop")
    # t=72000: vacant for 60000ms
    sm.updateStateMachine(72000, False, 250.0)
    assert_test(sm.currentState == "VACANT", "TC 3.1: Transitions to VACANT after 60000ms continuous vacancy from last drop")


    # -------------------------------------------------------------------------
    # 4. Timer Startup at now = 0 (Edge Case Analysis)
    # -------------------------------------------------------------------------
    print("\n--- 4. Timer Startup at now = 0 Edge Case ---")
    
    sm = ESP32StateMachine("VACANT")
    # Presence detected at t=0
    sm.updateStateMachine(0, True, 150.0)
    # In C++, presenceTimerStart becomes 0.
    # In next loop at t=50:
    sm.updateStateMachine(50, True, 150.0)
    # Because presenceTimerStart was 0, it gets overwritten with 50.
    assert_test(sm.presenceTimerStart == 50, "TC 4.1: presenceTimerStart gets set to 50 instead of remaining 0")
    
    # Let's see when it transitions.
    sm.updateStateMachine(5049, True, 150.0)
    assert_test(sm.currentState == "VACANT", "TC 4.1: Remains VACANT at t=5049 (only 4999ms from actual start)")
    sm.updateStateMachine(5050, True, 150.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 4.1: Transitions to OCCUPIED at t=5050 (5000ms from start = 50)")


    # -------------------------------------------------------------------------
    # 5. Timestamp Wrap-around (32-bit unsigned rollover)
    # -------------------------------------------------------------------------
    print("\n--- 5. Timestamp Wrap-around Tests ---")
    
    # TC 5.1: VACANT -> OCCUPIED near rollover
    sm = ESP32StateMachine("VACANT")
    # Start timer at t = 4294967000 (close to 4294967295)
    sm.updateStateMachine(4294967000, True, 150.0)
    # 4999ms later: t = 4294971999 -> wraps to 4703
    sm.updateStateMachine(4703, True, 150.0)
    assert_test(sm.currentState == "VACANT", "TC 5.1: Remains VACANT at 4999ms elapsed with wrap-around")
    # 5000ms later: t = 4294972000 -> wraps to 4704
    sm.updateStateMachine(4704, True, 150.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 5.1: Transitions to OCCUPIED at exactly 5000ms elapsed with wrap-around")

    # TC 5.2: OCCUPIED -> VACANT near rollover
    sm = ESP32StateMachine("OCCUPIED")
    # Start timer at t = 4294960000
    sm.updateStateMachine(4294960000, False, 250.0)
    # 59999ms later: t = 4295019999 -> wraps to 52703
    sm.updateStateMachine(52703, False, 250.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 5.2: Remains OCCUPIED at 59999ms elapsed with wrap-around")
    # 60000ms later: t = 4295020000 -> wraps to 52704
    sm.updateStateMachine(52704, False, 250.0)
    assert_test(sm.currentState == "VACANT", "TC 5.2: Transitions to VACANT at exactly 60000ms elapsed with wrap-around")


    # -------------------------------------------------------------------------
    # 6. Manual Override Interactions
    # -------------------------------------------------------------------------
    print("\n--- 6. Manual Override Interactions ---")

    # TC 6.1: Active override disables sensor updates
    sm = ESP32StateMachine("VACANT")
    sm.set_manual_override(True, "OCCUPIED")
    # Check that sensors are ignored even if vacant
    sm.updateStateMachine(1000, False, 250.0)
    sm.updateStateMachine(70000, False, 250.0)
    assert_test(sm.currentState == "OCCUPIED", "TC 6.1: Remains OCCUPIED due to active override")
    
    # TC 6.2: Resume auto mode transitions immediately
    # Deactivate override when sensors are vacant
    sm.resume_auto_mode(False, 250.0)
    assert_test(sm.currentState == "VACANT", "TC 6.2: Transitions to VACANT immediately upon deactivating override with vacant sensors")
    assert_test(sm.relayState == "LOW", "TC 6.2: Relay drops to LOW immediately")
    
    print("\n======================================================================")
    print(f"TEST RESULTS: {passed_tests} / {total_tests} PASSED")
    print("======================================================================")
    
    if passed_tests == total_tests:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
