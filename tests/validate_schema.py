import re
import sys
import os

def check_brackets_and_quotes(sql_content):
    """
    Checks for basic bracket, quote, and dollar-quoting balance.
    """
    errors = []
    stack = []
    mapping = {')': '(', ']': '[', '}': '{'}
    
    in_single_quote = False
    in_double_quote = False
    dollar_quote_tag = None
    
    line_idx = 1
    i = 0
    n = len(sql_content)
    
    while i < n:
        char = sql_content[i]
        
        # Track line number
        if char == '\n':
            line_idx += 1
            
        # Handle line comments (-- ...)
        if not in_single_quote and not in_double_quote and dollar_quote_tag is None:
            if sql_content[i:i+2] == '--':
                # Skip to end of line
                while i < n and sql_content[i] != '\n':
                    i += 1
                continue
            elif sql_content[i:i+2] == '/*':
                # Skip multiline comment
                start_line = line_idx
                i += 2
                while i < n and sql_content[i:i+2] != '*/':
                    if sql_content[i] == '\n':
                        line_idx += 1
                    i += 1
                if i >= n:
                    errors.append(f"Unclosed multiline comment starting at line {start_line}")
                else:
                    i += 2 # Skip the closing '*/'
                continue

        # Handle dollar quoting like $$ or $tag$
        if not in_single_quote and not in_double_quote:
            dollar_match = re.match(r'^\$[a-zA-Z_0-9]*\$', sql_content[i:])
            if dollar_match:
                tag = dollar_match.group(0)
                if dollar_quote_tag is None:
                    dollar_quote_tag = tag
                elif dollar_quote_tag == tag:
                    dollar_quote_tag = None
                i += len(tag)
                continue
        
        if dollar_quote_tag is not None:
            i += 1
            continue
            
        if char == "'" and not in_double_quote:
            # Handle escaped single quote in SQL (i.e. '')
            if i + 1 < n and sql_content[i+1] == "'":
                i += 2
                continue
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
            
        if not in_single_quote and not in_double_quote:
            if char in ['(', '[', '{']:
                stack.append((char, line_idx))
            elif char in [')', ']', '}']:
                if not stack:
                    errors.append(f"Unmatched closing bracket '{char}' at line {line_idx}")
                else:
                    top_char, top_line = stack.pop()
                    if mapping[char] != top_char:
                        errors.append(f"Mismatched brackets: '{top_char}' from line {top_line} closed by '{char}' at line {line_idx}")
        i += 1
        
    while stack:
        char, line_idx = stack.pop()
        errors.append(f"Unmatched opening bracket '{char}' from line {line_idx}")
        
    return errors

def analyze_schema_sql(filepath):
    """
    Parses and checks the SQL schema file for syntax, dependencies, and risks.
    """
    if not os.path.exists(filepath):
        print(f"Error: File {filepath} not found.")
        sys.exit(1)
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    errors = check_brackets_and_quotes(content)
    warnings = []
    
    # 1. Check for SECURITY DEFINER on notification function
    if "fn_notify_savings_telegram" in content:
        # Let's extract the function definition
        func_match = re.search(r'CREATE\s+OR\s+REPLACE\s+FUNCTION\s+fn_notify_savings_telegram\b.*?LANGUAGE\s+plpgsql', content, re.DOTALL | re.IGNORECASE)
        if func_match:
            func_def = func_match.group(0)
            if "SECURITY DEFINER" not in func_def:
                warnings.append(
                    "SECURITY DEFINER is missing from fn_notify_savings_telegram. "
                    "This function accesses sensitive Settings (Telegram tokens) and calls external webhooks. "
                    "Running it as SECURITY INVOKER (default) means low-privilege clients executing INSERTs "
                    "must have read access to settings/tokens, or the notification will fail due to permissions."
                )
                
    # 2. Check for transaction blocking risk in HTTP call
    if "http_post" in content:
        # Check if http_post is called synchronously
        # Usually http_post from pg_http is synchronous
        # Look for the fallback using pg_http
        fallback_match = re.search(r'SELECT\s+http_post\(', content, re.IGNORECASE)
        if fallback_match:
            warnings.append(
                "Synchronous http_post (pg_http) fallback is present in fn_notify_savings_telegram. "
                "If pg_net is not available, the trigger will perform a blocking HTTP call synchronously inside the INSERT transaction. "
                "This can lead to significant latency spikes, transaction blocking, and connection pool exhaustion if the Telegram API is slow."
            )

    # 3. Check for format pattern capacity limits (potential numeric overflow/hash output)
    format_matches = re.findall(r"to_char\([^)]+,\s*'FM999,990\.\d+'\)", content)
    if format_matches:
        warnings.append(
            f"Numeric formatting format pattern 'FM999,990.00' or similar used in {len(format_matches)} places. "
            "If the saved kWh, RM, or CO2 values exceed 999,999.999, to_char will return a string of hash symbols ('#######.###'). "
            "Consider using a larger format pattern (e.g. 'FM999,999,990.00') or directly casting to text if strict formatting is not required."
        )

    # 4. Check for ON DELETE CASCADE on foreign keys
    # Check rooms relation
    rooms_ref_matches = re.findall(r'FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s*rooms\s*\([^)]+\)(?:\s+ON\s+DELETE\s+(\w+))?', content, re.IGNORECASE)
    for ref in rooms_ref_matches:
        action = ref.strip().upper() if ref else ""
        if action != "CASCADE":
            warnings.append(
                f"Foreign key reference to rooms table does not use ON DELETE CASCADE (found: '{action or 'NO ACTION'}'). "
                "Deleting a room may cause key constraint violations if child records exist."
            )
            
    # 5. Check if start_time and end_time check constraint exists
    if "chk_savings_log_time_range" not in content:
        warnings.append("Constraint 'chk_savings_log_time_range' not found in SQL file.")
    elif "end_time >= start_time" not in content:
        warnings.append("Constraint 'chk_savings_log_time_range' may not correctly enforce end_time >= start_time.")
        
    return errors, warnings

if __name__ == "__main__":
    schema_path = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.abspath("sceas/supabase/schema.sql")
    print(f"Analyzing SQL schema: {schema_path}")
    
    errors, warnings = analyze_schema_sql(schema_path)
    
    print("\n--- Bracket and Syntax Errors ---")
    if errors:
        for err in errors:
            print(f"[ERROR] {err}")
    else:
        print("No bracket or quotation mismatches found.")
        
    print("\n--- Potential Issues / Warnings ---")
    if warnings:
        for warn in warnings:
            print(f"[WARNING] {warn}")
    else:
        print("No structural warning issues found.")
        
    if errors:
        sys.exit(1)
    else:
        sys.exit(0)
