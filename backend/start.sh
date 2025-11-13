#!/bin/bash
pip install --upgrade pip
uvicorn app:app --host 0.0.0.0 --port 10000
