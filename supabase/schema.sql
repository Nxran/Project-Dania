-- =====================================================================
-- Smart Campus Energy Awareness System (SCEAS) - Database Schema
-- Location: sceas/supabase/schema.sql
-- =====================================================================

-- Enable extensions (Supabase typically has these enabled, but safe for local Postgres)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. Tables & Constraints
-- =====================================================================

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Table: rooms
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'VACANT',
    manual_override BOOLEAN NOT NULL DEFAULT FALSE,
    nominal_power NUMERIC NOT NULL,
    category TEXT DEFAULT 'LAB',
    icon TEXT DEFAULT 'Zap',
    last_heartbeat TIMESTAMPTZ,
    latitude NUMERIC DEFAULT 3.8615,
    longitude NUMERIC DEFAULT 103.3156,
    wiring_type TEXT NOT NULL DEFAULT 'SMART_AUTOMATED',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_rooms_status CHECK (status IN ('OCCUPIED', 'VACANT')),
    CONSTRAINT chk_rooms_nominal_power CHECK (nominal_power > 0)
);

-- Table: room_bookings (Lecturer QR Code Booking & Session Assignment)
CREATE TABLE IF NOT EXISTS room_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    lecturer_name TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    push_endpoint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_booking_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED'))
);

-- Table: push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'admin',
    endpoint TEXT NOT NULL,
    p256dh TEXT,
    auth TEXT,
    device_hint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_push_subscriptions UNIQUE(user_id, endpoint)
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'admin',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'INFO',
    module TEXT DEFAULT 'ENERGY',
    link TEXT DEFAULT '/',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: authorized_beacons
CREATE TABLE IF NOT EXISTS authorized_beacons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    name TEXT NOT NULL,
    mac_address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_authorized_beacons_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT chk_mac_address_format CHECK (mac_address ~* '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$')
);

-- Table: energy_readings
CREATE TABLE IF NOT EXISTS energy_readings (
    id BIGSERIAL PRIMARY KEY,
    room_id UUID NOT NULL,
    voltage NUMERIC NOT NULL,
    current NUMERIC NOT NULL,
    power NUMERIC NOT NULL,
    energy NUMERIC NOT NULL,
    is_simulation BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_energy_readings_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT chk_energy_readings_voltage CHECK (voltage >= 0),
    CONSTRAINT chk_energy_readings_current CHECK (current >= 0),
    CONSTRAINT chk_energy_readings_power CHECK (power >= 0),
    CONSTRAINT chk_energy_readings_energy CHECK (energy >= 0)
);

-- Table: savings_log
CREATE TABLE IF NOT EXISTS savings_log (
    id BIGSERIAL PRIMARY KEY,
    room_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    kwh_saved NUMERIC NOT NULL,
    rm_saved NUMERIC NOT NULL,
    co2_saved NUMERIC NOT NULL,
    log_type TEXT NOT NULL DEFAULT 'SAVINGS',
    is_simulation BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_savings_log_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT chk_savings_log_time_range CHECK (end_time >= start_time),
    CONSTRAINT chk_savings_log_kwh CHECK (kwh_saved >= 0),
    CONSTRAINT chk_savings_log_rm CHECK (rm_saved >= 0),
    CONSTRAINT chk_savings_log_co2 CHECK (co2_saved >= 0),
    CONSTRAINT chk_savings_log_type CHECK (log_type IN ('SAVINGS', 'WASTAGE'))
);

-- =====================================================================
-- 2. Indexes for Performance
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_energy_readings_room_id ON energy_readings(room_id);
CREATE INDEX IF NOT EXISTS idx_energy_readings_created_at ON energy_readings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_savings_log_room_id ON savings_log(room_id);
CREATE INDEX IF NOT EXISTS idx_savings_log_created_at ON savings_log(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_name_lower ON rooms (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_authorized_beacons_room_id ON authorized_beacons(room_id);


-- =====================================================================
-- 3. Triggers & Functions
-- =====================================================================

-- Function & Trigger to auto-update updated_at on rooms table
CREATE OR REPLACE FUNCTION fn_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_rooms_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at_column();

-- Function & Trigger to notify Telegram on savings_log insert
CREATE OR REPLACE FUNCTION fn_notify_savings_telegram()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
    bot_token TEXT;
    chat_id TEXT;
    room_name TEXT;
    message_text TEXT;
    telegram_url TEXT;
    payload JSONB;
    net_exists BOOLEAN;
BEGIN
    -- Retrieve Telegram credentials
    SELECT value INTO bot_token FROM settings WHERE key = 'telegram_bot_token';
    SELECT value INTO chat_id FROM settings WHERE key = 'telegram_chat_id';

    -- Skip if credentials are not configured or are placeholders
    IF bot_token IS NULL OR bot_token = 'placeholder_token' OR 
       chat_id IS NULL OR chat_id = 'placeholder_chat_id' OR
       bot_token = '' OR chat_id = '' THEN
        RAISE WARNING 'Telegram notification skipped: credentials not configured in settings.';
        RETURN NEW;
    END IF;

    -- Fetch room name
    SELECT name INTO room_name FROM rooms WHERE id = NEW.room_id;
    IF room_name IS NULL THEN
        room_name := 'Bilik Tidak Diketahui';
    ELSE
        room_name := regexp_replace(room_name, '([_*\[`])', '\\\1', 'g');
    END IF;

    -- Format the notification message
    message_text := format(
        '🌿 *SCEAS Penjimatan Tenaga Baharu!* 🌿' || chr(10) ||
        'Bilik: *%s*' || chr(10) ||
        'Sesi Mula: *%s (Asia/Kuala_Lumpur)*' || chr(10) ||
        'Sesi Tamat: *%s (Asia/Kuala_Lumpur)*' || chr(10) ||
        'Tenaga Dijimatkan: *%s kWh*' || chr(10) ||
        'Kos Dijimatkan: *RM %s*' || chr(10) ||
        'Karbon Dijimatkan: *%s kg CO₂*',
        room_name,
        to_char(NEW.start_time AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI:SS'),
        to_char(NEW.end_time AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI:SS'),
        trim(to_char(NEW.kwh_saved, 'FM999,999,990.000')),
        trim(to_char(NEW.rm_saved, 'FM999,999,990.00')),
        trim(to_char(NEW.co2_saved, 'FM999,999,990.000'))
    );

    telegram_url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage';
    payload := jsonb_build_object(
        'chat_id', chat_id,
        'text', message_text,
        'parse_mode', 'Markdown'
    );

    -- Check if pg_net extension exists
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ) INTO net_exists;

    -- Wrap the actual notification logic in an EXCEPTION block to avoid rollback on insert
    BEGIN
        IF net_exists THEN
            -- Call net.http_post asynchronously to avoid blocking the main transaction
            EXECUTE 'SELECT net.http_post(
                url := $1,
                headers := ''{"Content-Type": "application/json"}''::jsonb,
                body := $2::text,
                timeout_milliseconds := 5000
            )' USING telegram_url, payload;
            RAISE NOTICE 'Telegram notification request queued using pg_net.';
        ELSE
            RAISE WARNING 'Telegram notification skipped: pg_net extension is not available. Payload: %', payload;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send Telegram webhook notification: %', SQLERRM;
    END;

    RETURN NEW;
    EXCEPTION
    WHEN OTHERS THEN
        -- Suppress any other function failures to ensure database transaction is not rolled back
        RAISE WARNING 'Failed in fn_notify_savings_telegram function: %', SQLERRM;
        RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_savings_log_insert
AFTER INSERT ON savings_log
FOR EACH ROW
EXECUTE FUNCTION fn_notify_savings_telegram();

-- Function & Trigger to auto-record savings and in-app notifications on room status change
CREATE OR REPLACE FUNCTION fn_auto_record_savings()
RETURNS TRIGGER AS $$
DECLARE
    v_duration_hours NUMERIC;
    v_kwh_saved NUMERIC;
    v_tariff NUMERIC;
    v_rm_saved NUMERIC;
    v_co2_saved NUMERIC;
    v_start_time TIMESTAMPTZ;
BEGIN
    IF (OLD.status = 'OCCUPIED' AND NEW.status = 'VACANT') THEN
        v_start_time := COALESCE(OLD.updated_at, now() - INTERVAL '10 minutes');
        v_duration_hours := GREATEST(0.001, EXTRACT(EPOCH FROM (now() - v_start_time)) / 3600.0);
        v_kwh_saved := (COALESCE(OLD.nominal_power, 1200.0) / 1000.0) * v_duration_hours;
        
        SELECT COALESCE(value::numeric, 0.571) INTO v_tariff FROM settings WHERE key = 'tnb_tariff';
        IF v_tariff IS NULL THEN
            v_tariff := 0.571;
        END IF;
        
        v_rm_saved := v_kwh_saved * v_tariff;
        v_co2_saved := v_kwh_saved * 0.585;
        
        INSERT INTO savings_log (room_id, start_time, end_time, kwh_saved, rm_saved, co2_saved)
        VALUES (OLD.id, v_start_time, now(), v_kwh_saved, v_rm_saved, v_co2_saved);
        
        INSERT INTO notifications (user_id, title, message, type, module, link)
        VALUES (
            'admin',
            'Penjimatan Tenaga: ' || OLD.name,
            'Lampu ditutup. Penjimatan ' || round(v_kwh_saved::numeric, 3) || ' kWh (RM ' || round(v_rm_saved::numeric, 2) || ') direkodkan.',
            'SAVINGS',
            'ENERGY',
            '/logs'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rooms_status_savings ON rooms;
CREATE TRIGGER trg_rooms_status_savings
AFTER UPDATE OF status ON rooms
FOR EACH ROW
EXECUTE FUNCTION fn_auto_record_savings();

-- Function to record ESP32 hardware online heartbeat
CREATE OR REPLACE FUNCTION fn_heartbeat(p_room_id UUID)
RETURNS JSON
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE rooms 
    SET last_heartbeat = now() 
    WHERE id = p_room_id;
    
    RETURN json_build_object('success', true, 'timestamp', now());
END;
$$;

-- Function to clear simulation / demo test data
CREATE OR REPLACE FUNCTION fn_clear_simulation_data()
RETURNS JSON
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
    v_readings_deleted INT;
    v_savings_deleted INT;
BEGIN
    DELETE FROM energy_readings WHERE is_simulation = TRUE;
    GET DIAGNOSTICS v_readings_deleted = ROW_COUNT;
    
    DELETE FROM savings_log WHERE is_simulation = TRUE;
    GET DIAGNOSTICS v_savings_deleted = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'readings_deleted', v_readings_deleted,
        'savings_deleted', v_savings_deleted,
        'message', 'Data simulasi berjaya dibersihkan.'
    );
END;
$$;

-- =====================================================================
-- 4. Initial Seed Data
-- =====================================================================
INSERT INTO settings (key, value) VALUES
    ('tnb_tariff', '0.571'),
    ('telegram_bot_token', 'placeholder_token'),
    ('telegram_chat_id', 'placeholder_chat_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO rooms (name, status, manual_override, nominal_power) VALUES
    ('Makmal Fotogrametri', 'VACANT', FALSE, 1200.0),
    ('Makmal Kartografi', 'VACANT', FALSE, 1500.0)
ON CONFLICT (LOWER(name)) DO UPDATE SET 
    status = EXCLUDED.status, 
    manual_override = EXCLUDED.manual_override, 
    nominal_power = EXCLUDED.nominal_power;

-- =====================================================================
-- 5. Mock Data Constraint Tests
-- =====================================================================
DO $$
DECLARE
    v_room_id UUID;
    v_updated_at TIMESTAMPTZ;
    v_new_updated_at TIMESTAMPTZ;
    v_record_count INT;
    v_error_occurred BOOLEAN;
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'Starting SCEAS SQL Schema and Trigger Test Suite...';
    RAISE NOTICE '==================================================';

    -- -----------------------------------------------------------------
    -- Test Case 1: Retrieve room ID for "Makmal Fotogrametri"
    -- -----------------------------------------------------------------
    SELECT id, updated_at INTO v_room_id, v_updated_at 
    FROM rooms 
    WHERE name = 'Makmal Fotogrametri';
    
    IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'Test Case 1 Failed: Seed data not found for Makmal Fotogrametri';
    END IF;
    RAISE NOTICE 'Test Case 1 Passed: Successfully retrieved room ID %', v_room_id;

    -- -----------------------------------------------------------------
    -- Test Case 2: Verify Rooms CHECK Constraints (status)
    -- -----------------------------------------------------------------
    v_error_occurred := FALSE;
    BEGIN
        INSERT INTO rooms (name, status, nominal_power)
        VALUES ('Makmal Gagal 1', 'INVALID_STATUS', 1000.0);
    EXCEPTION
        WHEN check_violation THEN
            v_error_occurred := TRUE;
            RAISE NOTICE 'Test Case 2 Passed: Correctly blocked invalid status constraint.';
    END;
    IF NOT v_error_occurred THEN
        RAISE EXCEPTION 'Test Case 2 Failed: Room allowed invalid status constraint.';
    END IF;

    -- -----------------------------------------------------------------
    -- Test Case 3: Verify Rooms CHECK Constraints (nominal_power)
    -- -----------------------------------------------------------------
    v_error_occurred := FALSE;
    BEGIN
        INSERT INTO rooms (name, status, nominal_power)
        VALUES ('Makmal Gagal 2', 'VACANT', -100.0);
    EXCEPTION
        WHEN check_violation THEN
            v_error_occurred := TRUE;
            RAISE NOTICE 'Test Case 3 Passed: Correctly blocked negative nominal_power.';
    END;
    IF NOT v_error_occurred THEN
        RAISE EXCEPTION 'Test Case 3 Failed: Room allowed negative nominal_power.';
    END IF;

    -- -----------------------------------------------------------------
    -- Test Case 4: Verify rooms updated_at Auto-update Trigger
    -- -----------------------------------------------------------------
    -- Disable trigger temporarily to manually set a past updated_at
    ALTER TABLE rooms DISABLE TRIGGER trg_rooms_updated_at;
    UPDATE rooms SET updated_at = now() - INTERVAL '1 hour' WHERE id = v_room_id;
    ALTER TABLE rooms ENABLE TRIGGER trg_rooms_updated_at;
    
    SELECT updated_at INTO v_updated_at FROM rooms WHERE id = v_room_id;

    -- Update a column on rooms to trigger fn_update_updated_at_column
    UPDATE rooms SET status = 'OCCUPIED' WHERE id = v_room_id;
    SELECT updated_at INTO v_new_updated_at FROM rooms WHERE id = v_room_id;
    
    IF v_new_updated_at = v_updated_at THEN
        RAISE EXCEPTION 'Test Case 4 Failed: updated_at was not updated by trigger.';
    END IF;
    RAISE NOTICE 'Test Case 4 Passed: Room updated_at trigger successfully fired.';

    -- -----------------------------------------------------------------
    -- Test Case 5: Verify energy_readings Table Constraints
    -- -----------------------------------------------------------------
    -- Positive readings validation
    v_error_occurred := FALSE;
    BEGIN
        INSERT INTO energy_readings (room_id, voltage, current, power, energy)
        VALUES (v_room_id, 240.0, -1.0, 240.0, 1.0);
    EXCEPTION
        WHEN check_violation THEN
            v_error_occurred := TRUE;
            RAISE NOTICE 'Test Case 5 Passed: Correctly blocked negative current in energy readings.';
    END;
    IF NOT v_error_occurred THEN
        RAISE EXCEPTION 'Test Case 5 Failed: Energy reading allowed negative current.';
    END IF;

    -- -----------------------------------------------------------------
    -- Test Case 6: Verify energy_readings Foreign Key Constraints
    -- -----------------------------------------------------------------
    v_error_occurred := FALSE;
    BEGIN
        INSERT INTO energy_readings (room_id, voltage, current, power, energy)
        VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 240.0, 1.0, 240.0, 1.0);
    EXCEPTION
        WHEN foreign_key_violation THEN
            v_error_occurred := TRUE;
            RAISE NOTICE 'Test Case 6 Passed: Correctly blocked non-existent room ID in energy readings.';
    END;
    IF NOT v_error_occurred THEN
        RAISE EXCEPTION 'Test Case 6 Failed: Energy reading allowed non-existent room ID.';
    END IF;

    -- -----------------------------------------------------------------
    -- Test Case 7: Verify savings_log Time Range Constraints
    -- -----------------------------------------------------------------
    v_error_occurred := FALSE;
    BEGIN
        INSERT INTO savings_log (room_id, start_time, end_time, kwh_saved, rm_saved, co2_saved)
        VALUES (v_room_id, now(), now() - INTERVAL '1 hour', 1.0, 0.57, 0.58);
    EXCEPTION
        WHEN check_violation THEN
            v_error_occurred := TRUE;
            RAISE NOTICE 'Test Case 7 Passed: Correctly blocked savings log where end_time < start_time.';
    END;
    IF NOT v_error_occurred THEN
        RAISE EXCEPTION 'Test Case 7 Failed: Savings log allowed end_time before start_time.';
    END IF;

    -- -----------------------------------------------------------------
    -- Test Case 8: Verify savings_log Valid Insertion and Trigger Fallback
    -- -----------------------------------------------------------------
    -- Valid insert should succeed even if Telegram credentials are not set (logs a warning and returns NEW)
    INSERT INTO savings_log (room_id, start_time, end_time, kwh_saved, rm_saved, co2_saved)
    VALUES (v_room_id, now() - INTERVAL '30 minutes', now(), 0.6, 0.34, 0.35);
    
    SELECT COUNT(*) INTO v_record_count 
    FROM savings_log 
    WHERE room_id = v_room_id;
    
    IF v_record_count != 1 THEN
        RAISE EXCEPTION 'Test Case 8 Failed: Valid savings log insert failed to persist.';
    END IF;
    RAISE NOTICE 'Test Case 8 Passed: Valid savings_log row successfully inserted and trigger handled gracefully.';

    -- -----------------------------------------------------------------
    -- Test Case 9: Verify Case-Insensitive Room Name Uniqueness Index
    -- -----------------------------------------------------------------
    v_error_occurred := FALSE;
    BEGIN
        INSERT INTO rooms (name, status, nominal_power)
        VALUES ('makmal fotogrametri', 'VACANT', 1000.0);
    EXCEPTION
        WHEN unique_violation THEN
            v_error_occurred := TRUE;
            RAISE NOTICE 'Test Case 9 Passed: Correctly blocked duplicate room name in case-insensitive check.';
    END;
    IF NOT v_error_occurred THEN
        RAISE EXCEPTION 'Test Case 9 Failed: Room allowed duplicate room name (case-insensitive).';
    END IF;

    -- -----------------------------------------------------------------
    -- -----------------------------------------------------------------
    -- Test Case 10: Verify authorized_beacons MAC address format constraint
    -- -----------------------------------------------------------------
    v_error_occurred := FALSE;
    BEGIN
        INSERT INTO authorized_beacons (room_id, name, mac_address)
        VALUES (v_room_id, 'Beacon Invalid', 'INVALID-MAC-ADDRESS');
    EXCEPTION
        WHEN check_violation THEN
            v_error_occurred := TRUE;
            RAISE NOTICE 'Test Case 10 Passed: Correctly blocked invalid MAC address format.';
    END;
    IF NOT v_error_occurred THEN
        RAISE EXCEPTION 'Test Case 10 Failed: Allowed invalid MAC address format.';
    END;

    -- Cleanup of Test Data
    -- -----------------------------------------------------------------
    DELETE FROM authorized_beacons WHERE room_id = v_room_id;
    DELETE FROM savings_log WHERE room_id = v_room_id;
    UPDATE rooms SET status = 'VACANT', updated_at = v_updated_at WHERE id = v_room_id;
    RAISE NOTICE 'Test Suite Cleanup: Successfully cleaned up mock records and restored rooms status.';


    RAISE NOTICE '==================================================';
    RAISE NOTICE 'ALL MOCK DATA AND CONSTRAINT TESTS PASSED SUCCESSFULLY!';
    RAISE NOTICE '==================================================';
END $$;
