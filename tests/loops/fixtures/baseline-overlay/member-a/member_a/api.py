import csv
import io


def export_rows(rows: list[dict], fmt: str = "csv") -> str:
    """Export rows as CSV; always returns at least the header row."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()
