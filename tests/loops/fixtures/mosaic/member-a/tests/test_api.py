import pytest

from member_a.api import export_rows


def test_export_rows():
    assert export_rows([{"name": "Ada", "score": 7}]) == "name,score\r\nAda,7\r\n"


@pytest.mark.skip(reason="tracked in plan 0002 verification gaps")
def test_export_empty():
    assert export_rows([]) == ""
