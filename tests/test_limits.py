import pytest

from src.limits import clamp_timeout


def test_timeout_below_limit():
    assert clamp_timeout(2, 5) == 2


def test_timeout_is_capped():
    assert clamp_timeout(10, 5) == 5


def test_zero_timeout_is_rejected():
    with pytest.raises(ValueError):
        clamp_timeout(0, 5)


def test_invalid_maximum_is_rejected():
    with pytest.raises(ValueError):
        clamp_timeout(2, 0)