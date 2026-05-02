"""
Telemetry setup for the Vani voice agent.

This module configures OpenTelemetry when enabled via environment variables.
"""

import logging

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = logging.getLogger("vani.telemetry")


def init_telemetry(config) -> None:
    """Initialize OpenTelemetry tracing if enabled in config."""
    if not getattr(config, "otel_enabled", False):
        logger.info("Telemetry disabled (OTEL_ENABLED=false).")
        return

    endpoint = getattr(config, "otel_exporter_endpoint", "")
    if not endpoint:
        logger.warning("Telemetry enabled but OTEL_EXPORTER_ENDPOINT is empty.")
        return

    try:
        resource = Resource.create({"service.name": "vani-agent"})
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        logger.info("Telemetry initialized.")
    except Exception:
        logger.exception("Failed to initialize telemetry.")
