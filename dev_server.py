#!/usr/bin/env python3
"""
Icefuse Kit Manager - Development Server Launcher
Connects directly to Dokploy PostgreSQL database for local development

================================================================================
IMPORTANT NOTES:
================================================================================

1. DATABASE CONNECTION (Dokploy Direct):
   - Connects directly to PostgreSQL on Dokploy server (104.129.132.73)
   - Database port exposed externally on port 5433
   - No SSH tunnel needed - database allows external connections

2. MULTI-SITE ARCHITECTURE:
   - Kit Manager (localhost:3020) - Main kits frontend
   - Auth Server (localhost:3012) - Auth service

3. KEYBOARD COMMANDS:
   - [R] Full reboot with Prisma sync
   - [F] Fast reboot (skip Prisma)
   - [P] Open Prisma Studio
   - [Q] Quit

================================================================================
"""

import subprocess
import sys
import os
import signal
import socket
import time
import shutil
import threading
import re
import webbrowser
from datetime import datetime

# Global flags
reboot_requested = False
quit_requested = False
quick_mode = False  # Skip prisma steps for faster startup
prisma_studio_process = None  # Track Prisma Studio process

# Configuration for multiple sites
SITES = {
    'kits': {
        'name': 'Icefuse Kit Manager',
        'port': 3020,
        'dir': os.path.dirname(os.path.abspath(__file__)),
        'color': '\033[96m',  # Cyan
        'enabled': True,
        'uses_dokploy_db': True  # Uses Dokploy database via SSH tunnel
    },
    'auth': {
        'name': 'Auth Server v2',
        'port': 3012,
        'dir': r'C:\Users\Corvezeo\Desktop\Github\ifn_app_auth_v2',
        'color': '\033[95m',  # Magenta
        'enabled': True,
        'uses_dokploy_db': False  # Uses its own database config
    }
}

PROJECT_DIR = SITES['kits']['dir']
LOG_FILE = os.path.join(PROJECT_DIR, "dev_server.log")

# Node.js paths (Windows)
NODE_PATH = r"C:\Program Files\nodejs"
NODE_EXE = os.path.join(NODE_PATH, "node.exe")
NPM_CMD = os.path.join(NODE_PATH, "npm.cmd")
NPX_CMD = os.path.join(NODE_PATH, "npx.cmd")

# Add Node to PATH if not already there
if NODE_PATH not in os.environ.get('PATH', ''):
    os.environ['PATH'] = NODE_PATH + os.pathsep + os.environ.get('PATH', '')

# Colors for terminal
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

# Store process handles
site_processes = {}
log_file_handle = None

def safe_print(text):
    """Print text safely, handling Unicode characters that can't be displayed"""
    try:
        print(text)
    except UnicodeEncodeError:
        safe_text = text.encode('ascii', 'replace').decode('ascii')
        print(safe_text)

def log(message, level="INFO", console=True):
    """Log message to both console and file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {message}"
    if console:
        safe_print(log_line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_line + "\n")

def log_output(output, prefix="", console=True):
    """Log subprocess output to both console and file"""
    if output:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            for line in output.strip().split('\n'):
                if line.strip():
                    formatted = f"{prefix}{line}"
                    if console:
                        safe_print(formatted)
                    f.write(formatted + "\n")

def log_print(message, also_log=True):
    """Print to console AND write to log file (strips ANSI colors for log)"""
    safe_print(message)
    if also_log:
        clean_message = re.sub(r'\033\[[0-9;]*m', '', message)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(clean_message + "\n")

def run_command(cmd, cwd=None, description="", verbose=True, timeout=120, env=None):
    """Run a command and log output to both console and file, return success status"""
    cmd_str = ' '.join(cmd) if isinstance(cmd, list) else cmd
    log(f"Running: {cmd_str}", console=verbose)
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=timeout,
            env=env
        )
        if result.stdout:
            log_output(result.stdout, "  ", console=verbose)
        if result.stderr:
            log_output(result.stderr, "  ", console=verbose)
        if result.returncode != 0:
            log(f"Command failed with exit code {result.returncode}", "ERROR")
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        log(f"Command timed out after {timeout}s", "ERROR")
        return False
    except Exception as e:
        log(f"Command error: {e}", "ERROR")
        return False

def print_header():
    enabled_sites = [s for s in SITES.values() if s['enabled']]
    sites_info = " | ".join([f"{s['name']} (:{s['port']})" for s in enabled_sites])
    mode_info = f"{Colors.GREEN}QUICK{Colors.RESET}" if quick_mode else f"{Colors.YELLOW}FULL{Colors.RESET}"

    log_print(f"""
{Colors.CYAN}============================================
  Icefuse Kit Manager - Development Server
============================================{Colors.RESET}
  Started: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
  Sites:   {sites_info}
  Mode:    {mode_info} (pass --quick or -q to skip Prisma)
  Log:     {LOG_FILE}

{Colors.BOLD}  Keyboard Commands (while servers are running):{Colors.RESET}
    {Colors.GREEN}[R]{Colors.RESET} Reboot      - Full restart with Prisma sync
    {Colors.GREEN}[F]{Colors.RESET} Fast Reboot - Quick restart (skip Prisma)
    {Colors.CYAN}[O]{Colors.RESET} Open        - Open browser (main page)
    {Colors.CYAN}[P]{Colors.RESET} Prisma      - Open Prisma Studio
    {Colors.BLUE}[D]{Colors.RESET} Database    - Check database connection
    {Colors.YELLOW}[Q]{Colors.RESET} Quit        - Stop servers and exit
    {Colors.RED}Ctrl+C{Colors.RESET}     - Force stop and exit

    {Colors.CYAN}[1]{Colors.RESET} Toggle Icefuse Kit Manager (port 3020)
    {Colors.MAGENTA}[2]{Colors.RESET} Toggle Auth Server (port 3012)
{Colors.CYAN}============================================{Colors.RESET}
""")

def kill_all_node_processes():
    """Kill all running node processes"""
    log("Killing all node processes...")
    if sys.platform == "win32":
        try:
            subprocess.run('taskkill /F /IM node.exe', shell=True, capture_output=True)
            log("Killed node.exe processes")
        except Exception as e:
            log(f"Error killing node processes: {e}", "WARN")
    else:
        try:
            subprocess.run('pkill -f node', shell=True, capture_output=True)
            log("Killed node processes")
        except Exception as e:
            log(f"Error killing node processes: {e}", "WARN")
    time.sleep(1)

def kill_port(port):
    """Kill any process running on the specified port"""
    log(f"Checking port {port}...")
    if sys.platform == "win32":
        try:
            result = subprocess.run(
                f'netstat -ano | findstr :{port} | findstr LISTENING',
                shell=True, capture_output=True, text=True
            )
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        log(f"Killing process on port {port} (PID: {pid})")
                        subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
        except Exception as e:
            log(f"Error checking port: {e}", "WARN")
    else:
        try:
            result = subprocess.run(
                f'lsof -ti:{port}', shell=True, capture_output=True, text=True
            )
            for pid in result.stdout.strip().split('\n'):
                if pid:
                    log(f"Killing process on port {port} (PID: {pid})")
                    os.kill(int(pid), signal.SIGKILL)
        except Exception as e:
            log(f"Error checking port: {e}", "WARN")
    log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Port {port} is free")

def clean_next_cache(site_dir, site_name):
    """Delete the .next folder to clear build cache"""
    next_dir = os.path.join(site_dir, ".next")
    if os.path.exists(next_dir):
        log(f"Deleting .next folder for {site_name}...")
        try:
            shutil.rmtree(next_dir)
            log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Deleted .next cache for {site_name}")
        except Exception as e:
            log_print(f"  {Colors.YELLOW}[WARN]{Colors.RESET} Could not delete .next folder: {e}")
    else:
        log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} No .next folder for {site_name}")

def clean_prisma_client(site_dir, site_name):
    """Delete the .prisma client folder to prevent permission errors on regenerate"""
    prisma_client_dir = os.path.join(site_dir, "node_modules", ".prisma")
    if os.path.exists(prisma_client_dir):
        log(f"Deleting .prisma client folder for {site_name}...")
        try:
            shutil.rmtree(prisma_client_dir)
            log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Deleted .prisma client for {site_name}")
        except Exception as e:
            log_print(f"  {Colors.YELLOW}[WARN]{Colors.RESET} Could not delete .prisma folder: {e}")
    else:
        log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} No .prisma client folder for {site_name}")

def check_node():
    """Check if Node.js is installed"""
    log("Checking Node.js...")
    try:
        node_version = subprocess.run(
            [NODE_EXE, '-v'], capture_output=True, text=True, shell=True
        ).stdout.strip()
        npm_version = subprocess.run(
            [NPM_CMD, '-v'], capture_output=True, text=True, shell=True
        ).stdout.strip()
        log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Node.js: {node_version}")
        log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} NPM: {npm_version}")
        return node_version, npm_version
    except FileNotFoundError:
        log_print(f"  {Colors.RED}[ERROR]{Colors.RESET} Node.js is not installed!")
        return None, None

def check_dependencies(site_dir, site_name):
    """Check and install dependencies if needed"""
    log(f"Checking dependencies for {site_name}...")
    node_modules = os.path.join(site_dir, "node_modules")
    if not os.path.exists(node_modules):
        log_print(f"  {Colors.YELLOW}[INFO]{Colors.RESET} Installing dependencies for {site_name}...")
        if not run_command([NPM_CMD, 'install'], cwd=site_dir):
            log_print(f"  {Colors.RED}[ERROR]{Colors.RESET} Failed to install dependencies")
            return False
    log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Dependencies installed for {site_name}")
    return True

# Dokploy Database Configuration
DOKPLOY_DB = {
    'host': '104.129.132.73',
    'port': 5434,
    'database': 'ifn_kits',
    'user': 'kits_user',
    'password': '37bf60ec9b098bbf74274d586c0945cbc9df3745105aa0e39486e1db98722d3b',
}

# Build DATABASE_URL for Kit Manager (do NOT set globally - let each site use its own)
KITS_DATABASE_URL = f"postgresql://{DOKPLOY_DB['user']}:{DOKPLOY_DB['password']}@{DOKPLOY_DB['host']}:{DOKPLOY_DB['port']}/{DOKPLOY_DB['database']}"

def check_database_connection():
    """Check if we can connect to the Dokploy database"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((DOKPLOY_DB['host'], DOKPLOY_DB['port']))
        sock.close()
        return result == 0
    except Exception as e:
        log(f"Database connection check failed: {e}", "WARN")
        return False

def get_site_env(uses_dokploy_db=False):
    """Get environment variables for a site, optionally including Dokploy DB URL"""
    env = os.environ.copy()
    if uses_dokploy_db:
        env['DATABASE_URL'] = KITS_DATABASE_URL
    return env

def run_prisma_generate(site_dir, site_name, uses_dokploy_db=False):
    """Generate Prisma client if prisma schema exists"""
    prisma_schema = os.path.join(site_dir, "prisma", "schema.prisma")
    if not os.path.exists(prisma_schema):
        log_print(f"  {Colors.GREEN}[SKIP]{Colors.RESET} No Prisma schema for {site_name}")
        return True

    env = get_site_env(uses_dokploy_db)
    if not run_command([NPX_CMD, 'prisma', 'generate'], cwd=site_dir, env=env):
        log_print(f"  {Colors.RED}[ERROR]{Colors.RESET} Failed to generate Prisma client")
        return False
    log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Prisma client generated for {site_name}")
    return True

def run_prisma_migrate(site_dir, site_name, uses_dokploy_db=False):
    """Run prisma migrate dev to sync schema"""
    prisma_schema = os.path.join(site_dir, "prisma", "schema.prisma")
    if not os.path.exists(prisma_schema):
        return True

    log_print(f"  {Colors.CYAN}[INFO]{Colors.RESET} Running prisma migrate dev...")

    env = get_site_env(uses_dokploy_db)

    # Run migrate dev with --skip-seed to avoid seed script issues
    result = subprocess.run(
        [NPX_CMD, 'prisma', 'migrate', 'dev', '--skip-seed'],
        cwd=site_dir,
        shell=True,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=120,
        env=env
    )

    if result.stdout:
        log_output(result.stdout, "  ")
    if result.stderr:
        log_output(result.stderr, "  ")

    if result.returncode == 0:
        log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Database schema synced for {site_name}")
        return True
    else:
        # Try db push as fallback
        log_print(f"  {Colors.YELLOW}[WARN]{Colors.RESET} Migrate failed, trying db push...")
        if run_command([NPX_CMD, 'prisma', 'db', 'push', '--accept-data-loss'], cwd=site_dir, env=env):
            log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Database schema synced via db push")
            return True
        return False

def wait_for_server_ready(port, timeout=60):
    """Wait for the server to be ready"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('127.0.0.1', port))
            sock.close()
            if result == 0:
                return True
        except:
            pass
        time.sleep(0.5)
    return False

def clear_console():
    """Clear the console screen"""
    if sys.platform == "win32":
        os.system('cls')
    else:
        os.system('clear')

def open_browser(url):
    """Open Brave browser to the specified URL"""
    brave_paths = [
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
        os.path.expanduser(r"~\AppData\Local\BraveSoftware\Brave-Browser\Application\brave.exe"),
    ]

    brave_path = None
    for path in brave_paths:
        if os.path.exists(path):
            brave_path = path
            break

    if brave_path:
        try:
            subprocess.Popen([brave_path, url], shell=False)
            log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Opened Brave browser to {url}")
            return True
        except Exception as e:
            log(f"Failed to open Brave: {e}", "WARN")

    try:
        webbrowser.open(url)
        log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Opened default browser to {url}")
        return True
    except Exception as e:
        log(f"Failed to open browser: {e}", "WARN")
        return False

def open_prisma_studio():
    """Open Prisma Studio in a new process"""
    global prisma_studio_process

    if prisma_studio_process and prisma_studio_process.poll() is None:
        log_print(f"  {Colors.YELLOW}[INFO]{Colors.RESET} Prisma Studio is already running")
        return True

    log_print(f"  {Colors.CYAN}[INFO]{Colors.RESET} Starting Prisma Studio...")
    try:
        prisma_studio_process = subprocess.Popen(
            [NPX_CMD, 'prisma', 'studio'],
            cwd=PROJECT_DIR,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Prisma Studio started (port 5555)")
        return True
    except Exception as e:
        log_print(f"  {Colors.RED}[ERROR]{Colors.RESET} Failed to start Prisma Studio: {e}")
        return False

def print_system_info(node_ver, npm_ver):
    """Print system information"""
    enabled_sites = [f"{s['name']} (:{s['port']})" for s in SITES.values() if s['enabled']]
    log_print(f"""
{Colors.CYAN}============================================
  System Information
============================================{Colors.RESET}
  OS:         {sys.platform}
  User:       {os.environ.get('USERNAME', os.environ.get('USER', 'unknown'))}
  Node:       {node_ver}
  NPM:        {npm_ver}
  Sites:      {', '.join(enabled_sites)}
  Database:   Dokploy PostgreSQL ({DOKPLOY_DB['host']}:{DOKPLOY_DB['port']})
{Colors.CYAN}============================================{Colors.RESET}
""")

def keyboard_listener():
    """Listen for keyboard commands in a separate thread"""
    global reboot_requested, quit_requested, quick_mode

    if sys.platform == "win32":
        import msvcrt
        while not quit_requested and not reboot_requested:
            if msvcrt.kbhit():
                key_byte = msvcrt.getch()
                key = key_byte.decode('utf-8', errors='ignore').lower()

                if key_byte == b'C':  # Shift+C - Clear console
                    clear_console()
                    print_header()
                    log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Console cleared\n")
                    continue
                elif key == 'r':
                    reboot_requested = True
                    quick_mode = False
                    log_print(f"\n{Colors.YELLOW}  Full reboot requested!{Colors.RESET}\n")
                    return
                elif key == 'f':
                    reboot_requested = True
                    quick_mode = True
                    log_print(f"\n{Colors.GREEN}  Fast reboot requested!{Colors.RESET}\n")
                    return
                elif key == 'o':
                    log_print(f"\n{Colors.CYAN}  Opening browser...{Colors.RESET}\n")
                    open_browser(f"http://localhost:{SITES['kits']['port']}")
                    continue
                elif key == 'p':
                    log_print(f"\n{Colors.CYAN}  Opening Prisma Studio...{Colors.RESET}\n")
                    open_prisma_studio()
                    continue
                elif key == 'd':
                    log_print(f"\n{Colors.BLUE}  Checking database connection...{Colors.RESET}\n")
                    if check_database_connection():
                        log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Database is reachable at {DOKPLOY_DB['host']}:{DOKPLOY_DB['port']}")
                    else:
                        log_print(f"  {Colors.RED}[ERROR]{Colors.RESET} Cannot reach database at {DOKPLOY_DB['host']}:{DOKPLOY_DB['port']}")
                    continue
                elif key == 'q':
                    quit_requested = True
                    log_print(f"\n{Colors.YELLOW}  Quit requested...{Colors.RESET}\n")
                    return
                elif key == '1':
                    SITES['kits']['enabled'] = not SITES['kits']['enabled']
                    status = "ENABLED" if SITES['kits']['enabled'] else "DISABLED"
                    log_print(f"\n{Colors.CYAN}  Icefuse Kit Manager: {status}{Colors.RESET}\n")
                elif key == '2':
                    SITES['auth']['enabled'] = not SITES['auth']['enabled']
                    status = "ENABLED" if SITES['auth']['enabled'] else "DISABLED"
                    log_print(f"\n{Colors.MAGENTA}  Auth Server: {status}{Colors.RESET}\n")
            time.sleep(0.1)
    else:
        import select
        while not quit_requested and not reboot_requested:
            if select.select([sys.stdin], [], [], 0.1)[0]:
                key = sys.stdin.read(1)
                if key == 'C':
                    clear_console()
                    print_header()
                    continue
                key = key.lower()
                if key == 'r':
                    reboot_requested = True
                    quick_mode = False
                    return
                elif key == 'f':
                    reboot_requested = True
                    quick_mode = True
                    return
                elif key == 'o':
                    open_browser(f"http://localhost:{SITES['kits']['port']}")
                elif key == 'p':
                    open_prisma_studio()
                elif key == 'd':
                    start_prisma_dev()
                elif key == 'q':
                    quit_requested = True
                    return

def run_site_server(site_key, site_config):
    """Run a single site's development server"""
    global site_processes

    site_name = site_config['name']
    site_dir = site_config['dir']
    port = site_config['port']

    log(f"Starting {site_name} on port {port}...")

    env = os.environ.copy()
    env['PORT'] = str(port)

    # Only set DATABASE_URL for sites that use Dokploy database
    if site_config.get('uses_dokploy_db', False):
        env['DATABASE_URL'] = KITS_DATABASE_URL

    try:
        process = subprocess.Popen(
            [NPM_CMD, 'run', 'dev'],
            cwd=site_dir,
            env=env,
            shell=True
        )
        site_processes[site_key] = process
        return process
    except Exception as e:
        log(f"Failed to start {site_name}: {e}", "ERROR")
        return None

def run_all_servers():
    """Run all enabled development servers"""
    global reboot_requested, quit_requested, site_processes

    enabled_sites = {k: v for k, v in SITES.items() if v['enabled']}

    if not enabled_sites:
        log_print(f"\n{Colors.YELLOW}  No sites enabled!{Colors.RESET}\n")
        return

    sites_list = "\n    ".join([f"{s['color']}{s['name']}: http://localhost:{s['port']}{Colors.RESET}" for s in enabled_sites.values()])

    log_print(f"""
  Starting development servers...

{Colors.GREEN}============================================
  Servers are running!

  Sites:
    {sites_list}

  Commands:
    [R] Reboot  - Full restart with Prisma
    [F] Fast    - Quick restart (skip Prisma)
    [O] Open    - Open browser
    [P] Prisma  - Open Prisma Studio
    [D] Database - Check database connection
    [Q] Quit    - Stop servers and exit
============================================{Colors.RESET}
""")

    listener_thread = threading.Thread(target=keyboard_listener, daemon=True)
    listener_thread.start()

    browser_opened = False

    try:
        for site_key, site_config in enabled_sites.items():
            run_site_server(site_key, site_config)
            time.sleep(2)

        while not reboot_requested and not quit_requested:
            for site_key, process in list(site_processes.items()):
                if process and process.poll() is not None:
                    log(f"{SITES[site_key]['name']} process died", "WARN")
                    del site_processes[site_key]

            if not site_processes:
                log("All processes died", "WARN")
                break

            if not browser_opened:
                first_site = list(enabled_sites.values())[0]
                if wait_for_server_ready(first_site['port'], timeout=5):
                    time.sleep(1)
                    open_browser(f"http://localhost:{first_site['port']}")
                    browser_opened = True

            time.sleep(0.5)

    except KeyboardInterrupt:
        quit_requested = True
        log_print(f"\n\n{Colors.YELLOW}  Shutting down servers...{Colors.RESET}")
    finally:
        for site_key, process in site_processes.items():
            if process:
                try:
                    process.terminate()
                except:
                    pass

        if prisma_studio_process:
            try:
                prisma_studio_process.terminate()
            except:
                pass

        for site_config in SITES.values():
            kill_port(site_config['port'])

        if sys.platform == "win32":
            subprocess.run('taskkill /F /IM node.exe', shell=True, capture_output=True)

        site_processes.clear()

def setup_site(site_key, site_config, step_offset, skip_checks=False):
    """Setup a single site"""
    global quick_mode
    site_name = site_config['name']
    site_dir = site_config['dir']
    color = site_config['color']
    uses_dokploy_db = site_config.get('uses_dokploy_db', False)

    if not os.path.exists(site_dir):
        log_print(f"  {Colors.RED}[ERROR]{Colors.RESET} {site_name} directory not found: {site_dir}")
        return False

    log_print(f"\n{color}  Setting up {site_name}...{Colors.RESET}")

    if quick_mode:
        log_print(f"  {Colors.GREEN}[QUICK]{Colors.RESET} Cleaning .next cache only...")
        clean_next_cache(site_dir, site_name)
        log_print(f"  {Colors.GREEN}[QUICK]{Colors.RESET} Skipping Prisma steps")
        return True

    # Clean caches
    log_print(f"  [{step_offset}/X] Cleaning caches for {site_name}...")
    clean_next_cache(site_dir, site_name)
    clean_prisma_client(site_dir, site_name)

    # Check dependencies
    if not skip_checks:
        log_print(f"  [{step_offset + 1}/X] Checking dependencies for {site_name}...")
        if not check_dependencies(site_dir, site_name):
            return False

    # Generate Prisma client
    log_print(f"  [{step_offset + 2}/X] Generating Prisma client for {site_name}...")
    if not run_prisma_generate(site_dir, site_name, uses_dokploy_db):
        return False

    # Sync database schema
    prisma_schema = os.path.join(site_dir, "prisma", "schema.prisma")
    if os.path.exists(prisma_schema):
        log_print(f"  [{step_offset + 3}/X] Syncing database schema for {site_name}...")
        if not run_prisma_migrate(site_dir, site_name, uses_dokploy_db):
            # Fall back to db push if migrate fails
            log_print(f"  {Colors.YELLOW}[WARN]{Colors.RESET} Migrate failed, trying db push...")
            env = get_site_env(uses_dokploy_db)
            run_command([NPX_CMD, 'prisma', 'db', 'push', '--accept-data-loss'], cwd=site_dir, env=env)

    return True

def startup_sequence(skip_node_check=False):
    """Run the startup sequence"""
    global reboot_requested, quit_requested
    reboot_requested = False
    quit_requested = False

    clear_console()
    print_header()

    enabled_sites = {k: v for k, v in SITES.items() if v['enabled']}

    # Step 0: Kill all node processes and clear ports
    log_print(f"  [0] Stopping all running sites...")
    kill_all_node_processes()
    for site_config in SITES.values():
        kill_port(site_config['port'])

    # Step 1: Check Node.js
    if not skip_node_check:
        log_print(f"\n  [1] Checking Node.js...")
        node_ver, npm_ver = check_node()
        if not node_ver:
            return False
    else:
        log_print(f"\n  [1] Skipping Node.js check (reboot)...")
        node_ver = subprocess.run([NODE_EXE, '-v'], capture_output=True, text=True, shell=True).stdout.strip()
        npm_ver = subprocess.run([NPM_CMD, '-v'], capture_output=True, text=True, shell=True).stdout.strip()

    # Step 2: Check database connection (if not quick mode)
    if not quick_mode:
        log_print(f"\n  [2] Checking database connection...")
        if check_database_connection():
            log_print(f"  {Colors.GREEN}[OK]{Colors.RESET} Database is reachable at {DOKPLOY_DB['host']}:{DOKPLOY_DB['port']}")
        else:
            log_print(f"  {Colors.YELLOW}[WARN]{Colors.RESET} Cannot reach database at {DOKPLOY_DB['host']}:{DOKPLOY_DB['port']}")

    # Setup each enabled site
    step = 3
    for site_key, site_config in enabled_sites.items():
        if not setup_site(site_key, site_config, step, skip_node_check):
            return False
        step += 4

    print_system_info(node_ver, npm_ver)
    return True

def cleanup():
    """Cleanup on exit"""
    log("Cleaning up...")
    if prisma_studio_process:
        try:
            prisma_studio_process.terminate()
        except:
            pass

def main():
    global reboot_requested, quit_requested, quick_mode

    if '--quick' in sys.argv or '-q' in sys.argv:
        quick_mode = True
        log_print(f"{Colors.GREEN}  Quick mode enabled - skipping Prisma steps{Colors.RESET}")

    auth_dir = SITES['auth']['dir']
    if not os.path.exists(auth_dir):
        log_print(f"{Colors.YELLOW}  [WARN] Auth server directory not found: {auth_dir}")
        log_print(f"  Disabling auth server...{Colors.RESET}")
        SITES['auth']['enabled'] = False

    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] === Development Server Starting ===\n")

    os.chdir(PROJECT_DIR)

    is_reboot = False

    try:
        while True:
            if not startup_sequence(skip_node_check=is_reboot):
                input("\n  Press Enter to exit...")
                sys.exit(1)

            run_all_servers()

            if reboot_requested:
                log_print(f"\n{Colors.CYAN}============================================")
                log_print(f"  REBOOTING ALL SERVERS...")
                log_print(f"============================================{Colors.RESET}\n")
                is_reboot = True
                time.sleep(1)
                continue
            else:
                break
    finally:
        cleanup()

    log_print(f"""
{Colors.YELLOW}============================================
  Servers stopped at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
  All processes cleaned up
============================================{Colors.RESET}
""")
    input("  Press Enter to close...")

if __name__ == "__main__":
    main()
