import csv
from pathlib import Path


INPUT_FILE = Path("SearchResults.csv")


def build_scopus_doi_query() -> str:
    """
    Read DOIs from the Springer search results CSV and build a Scopus-style query:
    DOI(10.xxxx/aaaa) OR DOI(10.xxxx/bbbb) ...
    """
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")

    dois: list[str] = []
    seen = set()

    # Use utf-8-sig to safely handle CSVs that may start with a BOM
    # (common with exports from some tools), so the first header name
    # does not get a leading '\ufeff'.
    with INPUT_FILE.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            doi = (row.get("Item DOI") or "").strip()
            if not doi:
                continue
            if doi in seen:
                continue
            seen.add(doi)
            dois.append(doi)

    return " OR ".join(f"DOI({d})" for d in dois)


def main() -> None:
    query = build_scopus_doi_query()
    print(query)


if __name__ == "__main__":
    main()

