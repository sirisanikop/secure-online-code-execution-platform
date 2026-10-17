def clamp_timeout(requested_seconds: float, max_seconds: float = 5.0) -> float:
    if requested_seconds <= 0:
        raise ValueError("Timeout must be positive")

    if max_seconds <= 0:
        raise ValueError("Maximum timeout must be positive")

    return min(requested_seconds, max_seconds)