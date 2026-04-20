#!/usr/bin/env python3
"""
Merge missing translation keys from English default locale files into all other
locale files so Theme Check MatchingTranslations passes.

Run from repo root:
  .venv/bin/python scripts/sync_locale_keys_from_english.py
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

import json5

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "locales"


def merge_missing(target: dict, source: dict) -> None:
    for key, val in source.items():
        if key not in target:
            target[key] = copy.deepcopy(val)
        elif isinstance(val, dict) and isinstance(target.get(key), dict):
            merge_missing(target[key], val)


def main() -> None:
    # Storefront: en.default.json -> *.json (not en.default.json)
    en_store = LOCALES / "en.default.json"
    with open(en_store, encoding="utf-8") as f:
        default_store = json5.load(f)

    for path in sorted(LOCALES.glob("*.json")):
        # Exclude en.default.json and *.schema.json (those end with .json but are schema)
        if path.name == "en.default.json" or path.name.endswith(".schema.json"):
            continue
        with open(path, encoding="utf-8") as f:
            data = json5.load(f)
        merge_missing(data, default_store)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("updated", path.relative_to(ROOT))

    # Schema: en.default.schema.json -> *.schema.json (not en.default.schema.json)
    en_schema = LOCALES / "en.default.schema.json"
    with open(en_schema, encoding="utf-8") as f:
        default_schema = json5.load(f)

    for path in sorted(LOCALES.glob("*.schema.json")):
        if path.name == "en.default.schema.json":
            continue
        with open(path, encoding="utf-8") as f:
            data = json5.load(f)
        merge_missing(data, default_schema)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("updated", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
