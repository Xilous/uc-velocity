#!/usr/bin/env python3
"""
UC Velocity ERP - Setup Script

This script installs all dependencies for both backend and frontend.
Run this once before using run.py to start the application.
"""

import subprocess
import sys
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def run_command(cmd, cwd=None, description=""):
    """Run a command and handle errors."""
    print(f"\n{'=' * 60}")
    print(f"  {description}")
    print(f"{'=' * 60}")
    print(f"  Running: {' '.join(cmd)}")
    print(f"  Directory: {cwd or 'current'}")
    print()

    result = subprocess.run(cmd, cwd=cwd, shell=(sys.platform == "win32"))

    if result.returncode != 0:
        print(f"\n[ERROR] Command failed with exit code {result.returncode}")
        return False
    return True


def get_npm_command():
    """Get the appropriate npm command for the platform."""
    if sys.platform == "win32":
        return "npm.cmd"
    return "npm"


def main():
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║              UC Velocity ERP - Setup                      ║
    ║         Installing all dependencies...                    ║
    ╚═══════════════════════════════════════════════════════════╝
    """)

    success = True

    # Install Python backend dependencies
    if not run_command(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
        cwd=BACKEND_DIR,
        description="Installing Python backend dependencies"
    ):
        success = False

    # Install Node.js frontend dependencies
    npm_cmd = get_npm_command()
    if not run_command(
        [npm_cmd, "install"],
        cwd=FRONTEND_DIR,
        description="Installing Node.js frontend dependencies"
    ):
        success = False

    print("\n")
    if success:
        print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║               Setup Complete!                             ║
    ╠═══════════════════════════════════════════════════════════╣
    ║  To start the application:                                ║
    ║                                                           ║
    ║    python run.py                                          ║
    ║                                                           ║
    ║  Or on Windows, double-click: run.bat                     ║
    ╚═══════════════════════════════════════════════════════════╝
        """)
    else:
        print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║            Setup completed with errors                    ║
    ╠═══════════════════════════════════════════════════════════╣
    ║  Some dependencies may not have installed correctly.      ║
    ║  Please check the errors above and try again.             ║
    ╚═══════════════════════════════════════════════════════════╝
        """)
        sys.exit(1)


if __name__ == "__main__":
    main()
