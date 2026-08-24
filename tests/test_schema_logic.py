import unittest
import re
from datetime import datetime, timedelta, timezone

# Simulate database tables
class MockDatabase:
    def __init__(self):
        self.settings = {}
        self.rooms = {}
        self.energy_readings = []
        self.savings_log = []
        self.extensions = set()
        self.warnings = []
        self.notified_payloads = []

    def clear(self):
        self.settings.clear()
        self.rooms.clear()
        self.energy_readings.clear()
        self.savings_log.clear()
        self.extensions.clear()
        self.warnings.clear()
        self.notified_payloads.clear()

    def add_extension(self, name):
        self.extensions.add(name)

    def set_setting(self, key, value):
        self.settings[key] = value

    def get_setting(self, key):
        return self.settings.get(key)

    # 1. Rooms logic
    def insert_room(self, id_val, name, status='VACANT', manual_override=False, nominal_power=0.0):
        # Check constraints
        if status not in ('OCCUPIED', 'VACANT'):
            raise ValueError("CHECK CONSTRAINT VIOLATION: status must be OCCUPIED or VACANT")
        if nominal_power <= 0:
            raise ValueError("CHECK CONSTRAINT VIOLATION: nominal_power must be > 0")
        
        # Unique constraint check (case-insensitive)
        for room in self.rooms.values():
            if room['name'].lower() == name.lower() and room['id'] != id_val:
                raise ValueError("UNIQUE CONSTRAINT VIOLATION: room name must be case-insensitively unique")

        self.rooms[id_val] = {
            'id': id_val,
            'name': name,
            'status': status,
            'manual_override': manual_override,
            'nominal_power': nominal_power,
            'updated_at': datetime.now(timezone.utc)
        }

    def delete_room(self, id_val):
        if id_val in self.rooms:
            del self.rooms[id_val]
            # ON DELETE CASCADE for energy readings
            self.energy_readings = [r for r in self.energy_readings if r['room_id'] != id_val]
            # ON DELETE CASCADE for savings log
            self.savings_log = [s for s in self.savings_log if s['room_id'] != id_val]

    # 2. Energy readings logic
    def insert_energy_reading(self, room_id, voltage, current, power, energy):
        # Foreign key check
        if room_id not in self.rooms:
            raise ValueError("FOREIGN KEY VIOLATION: room_id does not exist")
        # Check constraints
        if voltage < 0 or current < 0 or power < 0 or energy < 0:
            raise ValueError("CHECK CONSTRAINT VIOLATION: values must be >= 0")
            
        reading = {
            'room_id': room_id,
            'voltage': voltage,
            'current': current,
            'power': power,
            'energy': energy,
            'created_at': datetime.now(timezone.utc)
        }
        self.energy_readings.append(reading)

    # 3. Savings log logic with trigger simulation
    def insert_savings_log(self, room_id, start_time, end_time, kwh_saved, rm_saved, co2_saved):
        # Foreign key check
        if room_id not in self.rooms:
            raise ValueError("FOREIGN KEY VIOLATION: room_id does not exist")
        # Check constraints
        if end_time < start_time:
            raise ValueError("CHECK CONSTRAINT VIOLATION: end_time must be >= start_time")
        if kwh_saved < 0 or rm_saved < 0 or co2_saved < 0:
            raise ValueError("CHECK CONSTRAINT VIOLATION: savings values must be >= 0")
            
        log_entry = {
            'room_id': room_id,
            'start_time': start_time,
            'end_time': end_time,
            'kwh_saved': kwh_saved,
            'rm_saved': rm_saved,
            'co2_saved': co2_saved,
            'created_at': datetime.now(timezone.utc)
        }
        
        self.savings_log.append(log_entry)
        # Run trigger AFTER INSERT
        self.trigger_notify_savings(log_entry)

    # Trigger logic simulation
    def trigger_notify_savings(self, new_row):
        bot_token = self.get_setting('telegram_bot_token')
        chat_id = self.get_setting('telegram_chat_id')

        # Skip if credentials are not configured or are placeholders
        if (bot_token is None or bot_token == 'placeholder_token' or 
            chat_id is None or chat_id == 'placeholder_chat_id' or
            bot_token == '' or chat_id == ''):
            self.warnings.append("Telegram notification skipped: credentials not configured in settings.")
            return

        room = self.rooms.get(new_row['room_id'])
        room_name = room['name'] if room else 'Bilik Tidak Diketahui'
        room_name = re.sub(r'([_*\[`])', r'\\\1', room_name)

        # Timezone conversion: AT TIME ZONE 'Asia/Kuala_Lumpur' (UTC+8)
        try:
            kl_tz = timezone(timedelta(hours=8))
            kl_start = new_row['start_time'].astimezone(kl_tz)
            kl_end = new_row['end_time'].astimezone(kl_tz)
            
            start_str = kl_start.strftime('%Y-%m-%d %H:%M:%S')
            end_str = kl_end.strftime('%Y-%m-%d %H:%M:%S')
        except Exception as e:
            self.warnings.append(f"Failed in time conversion: {e}")
            return

        # Format message
        message_text = (
            f"🌿 *SCEAS Penjimatan Tenaga Baharu!* 🌿\n"
            f"Bilik: *{room_name}*\n"
            f"Sesi Mula: *{start_str} (Asia/Kuala_Lumpur)*\n"
            f"Sesi Tamat: *{end_str} (Asia/Kuala_Lumpur)*\n"
            f"Tenaga Dijimatkan: *{new_row['kwh_saved']:.3f} kWh*\n"
            f"Kos Dijimatkan: *RM {new_row['rm_saved']:.2f}*\n"
            f"Karbon Dijimatkan: *{new_row['co2_saved']:.3f} kg CO₂*"
        )

        telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            'chat_id': chat_id,
            'text': message_text,
            'parse_mode': 'Markdown'
        }

        # Wrap webhook call logic in exception handling to prevent transaction rollback
        try:
            if 'pg_net' in self.extensions:
                # Async call using pg_net
                self.notified_payloads.append(('pg_net', telegram_url, payload))
            else:
                # Warn and skip
                self.warnings.append(f"Telegram notification skipped: pg_net extension is not available. Payload: {payload}")
        except Exception as e:
            self.warnings.append(f"Failed to send Telegram webhook notification: {e}")


class TestSchemaLogic(unittest.TestCase):
    def setUp(self):
        self.db = MockDatabase()
        # Seed settings & rooms
        self.db.set_setting('tnb_tariff', '0.571')
        self.db.set_setting('telegram_bot_token', 'placeholder_token')
        self.db.set_setting('telegram_chat_id', 'placeholder_chat_id')
        self.db.insert_room('room-1', 'Makmal Fotogrametri', 'VACANT', False, 1200.0)

    def test_start_time_after_end_time(self):
        """Test Case: start_time is after end_time should fail check constraint"""
        now_time = datetime.now(timezone.utc)
        past_time = now_time - timedelta(hours=1)
        
        with self.assertRaises(ValueError) as ctx:
            # start_time = now_time, end_time = past_time
            self.db.insert_savings_log('room-1', now_time, past_time, 1.0, 0.57, 0.58)
        self.assertIn("CHECK CONSTRAINT VIOLATION: end_time must be >= start_time", str(ctx.exception))

    def test_room_id_deleted_cascade(self):
        """Test Case: deleting a room cascades to child records"""
        self.db.insert_energy_reading('room-1', 240.0, 1.2, 288.0, 10.5)
        now_time = datetime.now(timezone.utc)
        self.db.insert_savings_log('room-1', now_time - timedelta(hours=1), now_time, 2.5, 1.42, 1.45)

        self.assertEqual(len(self.db.energy_readings), 1)
        self.assertEqual(len(self.db.savings_log), 1)

        # Delete room
        self.db.delete_room('room-1')

        # Assert cascade deletion worked
        self.assertEqual(len(self.db.rooms), 0)
        self.assertEqual(len(self.db.energy_readings), 0)
        self.assertEqual(len(self.db.savings_log), 0)

    def test_extensions_completely_absent(self):
        """Test Case: pg_net and pg_http extensions are completely absent"""
        # Set credentials so it doesn't exit early
        self.db.set_setting('telegram_bot_token', '12345:valid_token')
        self.db.set_setting('telegram_chat_id', '987654')

        # No extensions added to self.db.extensions
        now_time = datetime.now(timezone.utc)
        
        # Insert savings log
        self.db.insert_savings_log('room-1', now_time - timedelta(hours=1), now_time, 2.5, 1.42, 1.45)

        # Assert insert succeeded (records exist)
        self.assertEqual(len(self.db.savings_log), 1)
        # Assert warning raised
        self.assertTrue(any("pg_net extension is not available" in w for w in self.db.warnings))
        # Assert no HTTP payload generated
        self.assertEqual(len(self.db.notified_payloads), 0)

    def test_telegram_token_empty_null_placeholder(self):
        """Test Case: Telegram token is empty, null, or placeholder"""
        # Test placeholder token
        self.db.set_setting('telegram_bot_token', 'placeholder_token')
        self.db.set_setting('telegram_chat_id', '987654')
        now_time = datetime.now(timezone.utc)
        self.db.insert_savings_log('room-1', now_time - timedelta(hours=1), now_time, 2.5, 1.42, 1.45)
        
        self.assertTrue(any("credentials not configured in settings" in w for w in self.db.warnings))
        self.assertEqual(len(self.db.notified_payloads), 0)

        # Test empty token
        self.db.warnings.clear()
        self.db.set_setting('telegram_bot_token', '')
        self.db.insert_savings_log('room-1', now_time - timedelta(hours=1), now_time, 2.5, 1.42, 1.45)
        self.assertTrue(any("credentials not configured in settings" in w for w in self.db.warnings))

        # Test null token (setting deleted or missing)
        self.db.warnings.clear()
        if 'telegram_bot_token' in self.db.settings:
            del self.db.settings['telegram_bot_token']
        self.db.insert_savings_log('room-1', now_time - timedelta(hours=1), now_time, 2.5, 1.42, 1.45)
        self.assertTrue(any("credentials not configured in settings" in w for w in self.db.warnings))

    def test_timezone_and_timestamp_format(self):
        """Test Case: Timezone conversion and format match expectations"""
        self.db.set_setting('telegram_bot_token', '12345:token')
        self.db.set_setting('telegram_chat_id', '987654')
        self.db.add_extension('pg_net')

        # Use UTC times (start_time is 2026-06-14 08:00:00 UTC, which is 16:00:00 KL time)
        start_time = datetime(2026, 6, 14, 8, 0, 0, tzinfo=timezone.utc)
        end_time = datetime(2026, 6, 14, 9, 30, 0, tzinfo=timezone.utc)

        self.db.insert_savings_log('room-1', start_time, end_time, 12.345, 7.05, 6.789)

        self.assertEqual(len(self.db.notified_payloads), 1)
        ext, url, payload = self.db.notified_payloads[0]
        
        self.assertEqual(ext, 'pg_net')
        text = payload['text']
        
        # Verify Malaysia Time zone formatting (UTC+8)
        self.assertIn("Sesi Mula: *2026-06-14 16:00:00 (Asia/Kuala_Lumpur)*", text)
        self.assertIn("Sesi Tamat: *2026-06-14 17:30:00 (Asia/Kuala_Lumpur)*", text)
        self.assertIn("Tenaga Dijimatkan: *12.345 kWh*", text)
        self.assertIn("Kos Dijimatkan: *RM 7.05*", text)
        self.assertIn("Karbon Dijimatkan: *6.789 kg CO₂*", text)

    def test_markdown_escaping_in_room_name(self):
        """Test Case: Markdown special characters in room name are escaped"""
        self.db.set_setting('telegram_bot_token', '12345:token')
        self.db.set_setting('telegram_chat_id', '987654')
        self.db.add_extension('pg_net')
        
        # Room name with special markdown characters
        self.db.insert_room('room-special', 'Bilik_R&D*Test[1]`', 'VACANT', False, 1000.0)
        
        now_time = datetime.now(timezone.utc)
        self.db.insert_savings_log('room-special', now_time - timedelta(hours=1), now_time, 1.0, 0.57, 0.58)
        
        self.assertEqual(len(self.db.notified_payloads), 1)
        _, _, payload = self.db.notified_payloads[0]
        text = payload['text']
        
        self.assertIn("Bilik: *Bilik\\_R&D\\*Test\\[1]\\`*", text)

    def test_room_name_case_insensitive_uniqueness(self):
        """Test Case: inserting a room with a duplicate case-insensitive name fails unique constraint"""
        with self.assertRaises(ValueError) as ctx:
            self.db.insert_room('room-2', 'makmal fotogrametri', 'VACANT', False, 1000.0)
        self.assertIn("UNIQUE CONSTRAINT VIOLATION: room name must be case-insensitively unique", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
