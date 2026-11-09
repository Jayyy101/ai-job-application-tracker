"""Check fixture integrity only. This is not an AI quality evaluation."""
import json
from pathlib import Path

data = json.loads(Path(__file__).with_name("starter_cases.json").read_text())
cases = data["cases"]
assert len(cases) == len({case["id"] for case in cases}) == 12
assert sum(case["split"] == "development" for case in cases) == 8
assert sum(case["split"] == "held_out" for case in cases) == 4
for case in cases:
    assert case["resume_text"] and case["job_description"]
    for requirement in case["expected_requirements"]:
        assert requirement["status"] in {"supported", "partially_supported", "not_evidenced"}
        assert requirement["importance"] in {"required", "preferred", "unspecified"}
        assert all(quote in case["resume_text"] for quote in requirement["evidence_quotes"])
print("12 synthetic fixtures validated (8 development, 4 held out). No models called or quality results measured.")
