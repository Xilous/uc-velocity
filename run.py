#!/usr/bin/env python3
"""
UC Velocity ERP - Single Entry Point Launcher

This script starts both the FastAPI backend and React frontend servers.
It also manages the PostgreSQL Docker container for local development.
Press Ctrl+C to stop both servers gracefully.
"""

import subprocess
import sys
import os
import signal
import time
from pathlib import Path

# Configuration
BACKEND_PORT = 8000
FRONTEND_PORT = 5173
ROOT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
POSTGRES_CONTAINER_NAME = "ucvelocity-postgres"


def check_docker_installed():
    """Check if Docker is installed and accessible."""
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def check_docker_running():
    """Check if Docker daemon is running."""
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def check_postgres_container():
    """Check if PostgreSQL container exists and is running."""
    try:
        # Check if container exists
        result = subprocess.run(
            ["docker", "ps", "-a", "--filter", f"name={POSTGRES_CONTAINER_NAME}", "--format", "{{.Status}}"],
            capture_output=True,
            text=True
        )
        status = result.stdout.strip()

        if not status:
            return "not_exists"
        elif status.startswith("Up"):
            return "running"
        else:
            return "stopped"
    except FileNotFoundError:
        return "docker_not_found"


def start_postgres_container():
    """Start the PostgreSQL container using docker-compose."""
    print("[Database] Starting PostgreSQL container...")
    try:
        result = subprocess.run(
            ["docker", "compose", "up", "-d"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"[Database] Error starting container: {result.stderr}")
            return False

        # Wait for PostgreSQL to be ready
        print("[Database] Waiting for PostgreSQL to be ready...")
        for i in range(30):  # Wait up to 30 seconds
            check_result = subprocess.run(
                ["docker", "exec", POSTGRES_CONTAINER_NAME, "pg_isready", "-U", "postgres"],
                capture_output=True,
                text=True
            )
            if check_result.returncode == 0:
                print("[Database] PostgreSQL is ready!")
                return True
            time.sleep(1)

        print("[Database] PostgreSQL did not become ready in time")
        return False
    except FileNotFoundError:
        print("[Database] docker-compose not found")
        return False


def ensure_postgres_running():
    """Ensure PostgreSQL container is running, start if needed."""
    if not check_docker_installed():
        print("\n[ERROR] Docker is not installed.")
        print("  Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/")
        print("  PostgreSQL is required for local development.\n")
        return False

    if not check_docker_running():
        print("\n[ERROR] Docker is not running.")
        print("  Please start Docker Desktop and try again.\n")
        return False

    status = check_postgres_container()

    if status == "running":
        print("[Database] PostgreSQL container is already running")
        return True
    elif status == "stopped":
        print("[Database] PostgreSQL container exists but is stopped, starting...")
        result = subprocess.run(
            ["docker", "start", POSTGRES_CONTAINER_NAME],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            # Wait for it to be ready
            time.sleep(2)
            print("[Database] PostgreSQL container started")
            return True
        else:
            print(f"[Database] Failed to start container: {result.stderr}")
            return False
    elif status == "not_exists":
        print("[Database] PostgreSQL container does not exist, creating...")
        return start_postgres_container()
    else:
        print("[Database] Could not determine container status")
        return False


def check_dependencies():
    """Check if required dependencies are installed."""
    errors = []

    # Check Python packages
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import psycopg2
        import dotenv
    except ImportError as e:
        errors.append(f"Missing Python package: {e.name}. Run: pip install -r backend/requirements.txt")

    # Check if node_modules exists
    if not (FRONTEND_DIR / "node_modules").exists():
        errors.append("Frontend dependencies not installed. Run: cd frontend && npm install")

    if errors:
        print("\n[ERROR] Missing dependencies:")
        for error in errors:
            print(f"  - {error}")
        print()
        return False

    return True


def get_npm_command():
    """Get the appropriate npm command for the platform."""
    if sys.platform == "win32":
        return "npm.cmd"
    return "npm"


def main():
    print("""
    +-----------------------------------------------------------+
    |                   UC Velocity ERP                         |
    |               Starting Application...                     |
    +-----------------------------------------------------------+
    """)

    # Ensure PostgreSQL is running first
    if not ensure_postgres_running():
        print("\n[ERROR] Could not start PostgreSQL. Exiting.")
        sys.exit(1)

    # Check dependencies
    if not check_dependencies():
        sys.exit(1)

    processes = []

    try:
        # Start Backend (FastAPI with Uvicorn)
        print(f"[Backend] Starting FastAPI server on http://localhost:{BACKEND_PORT}")
        backend_process = subprocess.Popen(
            [
                sys.executable, "-m", "uvicorn",
                "main:app",
                "--host", "0.0.0.0",
                "--port", str(BACKEND_PORT),
                "--reload"
            ],
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        processes.append(("Backend", backend_process))

        # Give backend a moment to start
        time.sleep(2)

        # Start Frontend (Vite dev server)
        print(f"[Frontend] Starting Vite dev server on http://localhost:{FRONTEND_PORT}")
        npm_cmd = get_npm_command()
        frontend_process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=FRONTEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(sys.platform == "win32")
        )
        processes.append(("Frontend", frontend_process))

        print(f"""
    +-----------------------------------------------------------+
    |                Application Running                        |
    +-----------------------------------------------------------+
    |  Frontend:  http://localhost:{FRONTEND_PORT}                        |
    |  Backend:   http://localhost:{BACKEND_PORT}                         |
    |  API Docs:  http://localhost:{BACKEND_PORT}/docs                    |
    |  Database:  PostgreSQL (Docker)                           |
    +-----------------------------------------------------------+
    |  Press Ctrl+C to stop all servers                         |
    +-----------------------------------------------------------+
        """)

        # Stream output from both processes
        import threading

        def stream_output(name, process):
            """Stream output from a process with prefix."""
            try:
                for line in iter(process.stdout.readline, ''):
                    if line:
                        print(f"[{name}] {line.rstrip()}")
                    if process.poll() is not None:
                        break
            except Exception:
                pass

        # Start output streaming threads
        threads = []
        for name, proc in processes:
            t = threading.Thread(target=stream_output, args=(name, proc), daemon=True)
            t.start()
            threads.append(t)

        # Wait for processes
        while True:
            for name, proc in processes:
                if proc.poll() is not None:
                    print(f"\n[{name}] Process exited with code {proc.returncode}")
                    raise KeyboardInterrupt
            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n\n[Shutdown] Stopping servers...")

    finally:
        # Cleanup: terminate all processes
        for name, proc in processes:
            if proc.poll() is None:
                print(f"[Shutdown] Stopping {name}...")
                if sys.platform == "win32":
                    # On Windows, use taskkill to kill process tree
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        capture_output=True
                    )
                else:
                    # On Unix, send SIGTERM to process group
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                proc.wait(timeout=5)

        print("[Shutdown] All servers stopped.")
        print("[Note] PostgreSQL container is still running. Stop it with: docker compose down")


if __name__ == "__main__":
    main()
