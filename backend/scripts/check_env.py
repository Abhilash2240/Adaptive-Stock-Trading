#!/usr/bin/env python3
"""
Run this before deploying to verify all required
environment variables are set.
Usage: python scripts/check_env.py
"""

import os
import sys

REQUIRED = [
    "DATABASE_URL",
    "JWT_SECRET",
    "TWELVEDATA_API_KEY",
]

OPTIONAL = [
    "PORT",
    "ENVIRONMENT",
    "ALLOWED_ORIGINS",
    "DATA_PROVIDER",
    "SYMBOLS",
]


def main():
    missing = []
    for var in REQUIRED:
        val = os.getenv(var, "")
        if not val:
            missing.append(var)
        else:
            masked = val[:4] + "***" if len(val) > 4 else "***"
            print(f"  + {var} = {masked}")

    print()
    for var in OPTIONAL:
        val = os.getenv(var, "")
        status = val if val else "(using default)"
        print(f"  ~ {var} = {status}")

    if missing:
        print(f"\nX Missing required variables: {', '.join(missing)}")
        print("Set them in Railway dashboard -> Variables tab")
        sys.exit(1)

    print("\n+ All required environment variables are set")


if __name__ == "__main__":
    main()
