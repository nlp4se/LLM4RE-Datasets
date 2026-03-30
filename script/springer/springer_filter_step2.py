import csv
import html
from pathlib import Path


INPUT_FILE = Path("SearchResults_Expanded.csv")
OUTPUT_FILE = Path("springer_filtered.csv")


LLM_TERMS = [
    "large language model",
    "llm",
]

RE_TERMS = [
    "requirements engineering",
    "requirement engineering",
    "requirements elicitation",
    "requirement elicitation",
    "requirements specification",
    "requirement specification",
    "requirements analysis",
    "requirement analysis",
    "requirements validation",
    "requirement validation",
    "requirements verification",
    "requirement verification",
    "requirements prioritization",
    "requirement prioritization",
    "requirements prioritisation",
    "requirement prioritisation",
    "requirements gathering",
    "requirement gathering",
    "requirements collection",
    "requirement collection",
    "requirements modelling",
    "requirement modelling",
    "requirements modeling",
    "requirement modeling",
    "requirements design",
    "requirement design",
    "requirements traceability",
    "requirement traceability",
]

DATA_TERMS = [
    "data",
    "dataset",
    "corpus",
    "benchmark",
    "gold standard",
    "gold-standard",
    "ground truth",
    "ground-truth",
]


def matches_query(text: str) -> bool:
    """
    Check whether the given text satisfies:
      ("large language model" OR llm)
      AND (any RE_TERMS)
      AND (any DATA_TERMS)
    Matching is case-insensitive and done over the raw substring.
    """
    if not text:
        return False

    norm = html.unescape(text).lower()

    if not any(term in norm for term in LLM_TERMS):
        return False

    if not any(term in norm for term in RE_TERMS):
        return False

    if not any(term in norm for term in DATA_TERMS):
        return False

    return True


def main() -> None:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")

    # Use utf-8-sig to transparently strip a possible BOM from the header,
    # which otherwise would make the first column name look like '\ufeffAuthors'
    # and break lookups such as row["Authors"].
    with INPUT_FILE.open(newline="", encoding="utf-8-sig") as f_in:
        reader = csv.DictReader(f_in)

        # We only output these columns in the given order
        fieldnames = [
            "Authors",
            "Title",
            "Year",
            "Source title",
            "Cited by",
            "DOI",
            "Abstract",
        ]

        with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as f_out:
            writer = csv.DictWriter(f_out, fieldnames=fieldnames)
            writer.writeheader()

            total = 0
            matched = 0

            for row in reader:
                total += 1
                if total == 1 or total % 20 == 0:
                    print(f"[springer_filter_step2] Processing record {total}")

                title = row.get("Title", "") or ""
                abstract = row.get("Abstract", "") or ""
                keywords = row.get("Author Keywords", "") or ""

                search_text = " ".join(
                    part for part in (title, abstract, keywords) if part
                )

                if not matches_query(search_text):
                    continue

                matched += 1
                print(row)
                out_row = {
                    "Authors": row.get("Authors", "") or "",
                    "Title": title,
                    "Year": row.get("Year", "") or "",
                    "Source title": row.get("Source title", "") or "",
                    "Cited by": row.get("Cited by", "") or "",
                    "DOI": row.get("DOI", "") or "",
                    "Abstract": abstract,
                }
                writer.writerow(out_row)

            print(
                "[springer_filter_step2] Finished filtering. "
                f"Total rows: {total}, matched: {matched}"
            )


if __name__ == "__main__":
    main()

