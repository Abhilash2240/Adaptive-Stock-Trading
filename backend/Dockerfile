# syntax=docker/dockerfile:1.4
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ROOT=/app

WORKDIR ${APP_ROOT}

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY . ${APP_ROOT}

ENV PYTHONPATH=${APP_ROOT}
ENV PORT=8001

EXPOSE 8001

CMD ["python", "run_server.py"]
