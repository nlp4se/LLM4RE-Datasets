import csv
import time
import re
from typing import Dict, List, Tuple

import requests
import pandas as pd


OPENALEX = "https://api.openalex.org"
MAILTO = "joaquim.motger@upc.edu"  # optional but polite for rate-limits


def norm_doi(doi: str) -> str:
    doi = doi.strip()
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.I)
    return doi.lower()


def norm_title(title: str) -> str:
    """
    Normalize titles for comparison: trim, collapse whitespace, lowercase.
    """
    title = (title or "").strip()
    title = re.sub(r"\s+", " ", title)
    return title.lower()


def get_work_by_doi(doi: str):
    url = f"{OPENALEX}/works/https://doi.org/{doi}"
    r = requests.get(url, params={"mailto": MAILTO}, timeout=60)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def search_work_by_title(title: str):
    """
    Fallback: search OpenAlex by title when DOI lookup fails.
    Returns the first matching work with an exactly matching title (case-insensitive), or None.
    """
    if not title:
        return None

    params = {
        "search": title,
        "per_page": 1,
        "mailto": MAILTO,
    }
    url = f"{OPENALEX}/works"
    r = requests.get(url, params=params, timeout=60)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    data = r.json()
    results = data.get("results") or []
    if not results:
        return None

    candidate = results[0]
    cand_title = (candidate.get("title") or "").strip().lower()
    wanted_title = (title or "").strip().lower()
    if cand_title != wanted_title:
        return None

    return candidate


def fetch_all_citers(seed_openalex_id: str):
    """
    Generator over all works that cite the given OpenAlex work id (short id like 'W...').
    """
    url = f"{OPENALEX}/works"
    params = {
        "filter": f"cites:{seed_openalex_id}",
        "per_page": 200,
        "mailto": MAILTO,
    }
    while True:
        r = requests.get(url, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        for w in data.get("results", []):
            yield w
        next_cursor = data.get("meta", {}).get("next_cursor")
        if not next_cursor:
            break
        params["cursor"] = next_cursor


def get_work(work_id: str):
    """
    Fetch a work given an OpenAlex work id.
    The ids in `referenced_works` are usually of the form https://openalex.org/Wxxxx.
    We normalize them to the API form https://api.openalex.org/works/Wxxxx.
    """
    if work_id.startswith("https://openalex.org/"):
        short_id = work_id.rsplit("/", 1)[-1]
        url = f"{OPENALEX}/works/{short_id}"
    else:
        url = work_id
    r = requests.get(url, params={"mailto": MAILTO}, timeout=60)
    r.raise_for_status()
    return r.json()


def _abstract_from_work(w: dict) -> str:
    abstract = w.get("abstract")
    if abstract:
        return abstract

    inverted = w.get("abstract_inverted_index") or {}
    if not inverted:
        return ""

    max_pos = -1
    for positions in inverted.values():
        if positions:
            max_pos = max(max_pos, max(positions))
    if max_pos < 0:
        return ""

    words = [""] * (max_pos + 1)
    for word, positions in inverted.items():
        for p in positions:
            if 0 <= p <= max_pos:
                words[p] = word
    return " ".join(token for token in words if token)


def _dedup_key_from_work(w: dict) -> str:
    """
    Use DOI as primary dedup key, falling back to OpenAlex id.
    """
    doi = (w.get("ids") or {}).get("doi") or ""
    doi = norm_doi(doi) if doi else ""
    if doi:
        return doi
    return w.get("id", "") or ""


def build_output_row_from_work(w: dict) -> dict:
    """
    Build a row with the required output structure from an OpenAlex work.
    Columns:
      Source, ID, Authors, Title, Year, Source title, Cited by, DOI, Abstract
    """
    authors = []
    for a in (w.get("authorships") or [])[:10]:
        name = (a.get("author") or {}).get("display_name")
        if name:
            authors.append(name)

    # For forward we used primary_location.source, for backward host_venue;
    # here we try both and fall back gracefully.
    venue = ""
    primary_source = ((w.get("primary_location") or {}).get("source") or {}).get("display_name")
    host_venue = (w.get("host_venue") or {}).get("display_name")
    if primary_source:
        venue = primary_source
    elif host_venue:
        venue = host_venue

    doi_value = (w.get("ids") or {}).get("doi") or ""
    doi_value = norm_doi(doi_value) if doi_value else ""

    return {
        "Source": "OpenAlex",
        "ID": "",
        "Authors": "; ".join(authors),
        "Title": w.get("title", "") or "",
        "Year": w.get("publication_year") or "",
        "Source title": venue or "",
        "Cited by": w.get("cited_by_count") or "",
        "DOI": doi_value,
        "Abstract": _abstract_from_work(w),
    }


def load_existing_publications(csv_path: str):
    """
    Load known publications from a CSV file.
    Expects columns 'DOI' and/or 'Title'.
    Returns (set_of_dois, set_of_normalized_titles).
    """
    try:
        df = pd.read_csv(csv_path)
    except Exception:
        return set(), set()

    existing_dois = set()
    existing_titles = set()

    if "DOI" in df.columns:
        for raw in df["DOI"]:
            if isinstance(raw, str) and raw.strip():
                existing_dois.add(norm_doi(raw))

    if "Title" in df.columns:
        for raw in df["Title"]:
            if isinstance(raw, str) and raw.strip():
                existing_titles.add(norm_title(raw))

    return existing_dois, existing_titles


def read_seeds(path: str) -> List[Dict[str, str]]:
    """
    Read seeds from a tab-separated CSV with columns: Title, DOI.
    Returns a list of dicts with keys 'title' and 'doi' (normalized).
    """
    seeds: List[Dict[str, str]] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            title = (row.get("Title") or "").strip()
            doi_raw = (row.get("DOI") or "").strip()
            doi_norm = norm_doi(doi_raw) if doi_raw else ""
            if not title and not doi_norm:
                continue
            seeds.append({"title": title, "doi": doi_norm})
    return seeds


def run_snowballing() -> None:
    seeds = read_seeds("seeds_snowballing_1.csv")

    forward_cands: Dict[str, dict] = {}
    backward_cands: Dict[str, dict] = {}
    edges_seed_to_citer: List[Dict[str, str]] = []
    edges_seed_to_ref: List[Dict[str, str]] = []

    for i, seed_info in enumerate(seeds, 1):
        title = seed_info["title"]
        doi = seed_info["doi"]

        seed = None
        if doi:
            seed = get_work_by_doi(doi)
        if not seed:
            seed = search_work_by_title(title)

        if not seed:
            print(f"[{i}/{len(seeds)}] Seed not found in OpenAlex (DOI='{doi}', Title='{title}')")
            continue

        seed_id = seed.get("id", "")
        seed_title = seed.get("title", "") or title
        seed_openalex_short = seed_id.split("/")[-1] if seed_id else ""

        print(f"[{i}/{len(seeds)}] seed -> OpenAlex {seed_openalex_short}")

        # FORWARD: all citers
        if seed_openalex_short:
            citer_count = 0
            for w in fetch_all_citers(seed_openalex_short):
                citer_count += 1
                key = _dedup_key_from_work(w)
                if key and key not in forward_cands:
                    forward_cands[key] = build_output_row_from_work(w)
                edges_seed_to_citer.append(
                    {
                        "seed_doi": doi,
                        "seed_openalex_id": seed_id,
                        "seed_title": seed_title,
                        "citer_key": key,
                    }
                )
            print(f"  forward citers fetched: {citer_count}")

        # BACKWARD: all referenced works
        ref_ids = seed.get("referenced_works") or []
        print(f"  backward refs: {len(ref_ids)}")
        for rid in ref_ids:
            try:
                w = get_work(rid)
            except Exception:
                continue

            key = _dedup_key_from_work(w)
            if key and key not in backward_cands:
                backward_cands[key] = build_output_row_from_work(w)

            edges_seed_to_ref.append(
                {
                    "seed_doi": doi,
                    "seed_openalex_id": seed_id,
                    "seed_title": seed_title,
                    "ref_key": key,
                }
            )

        time.sleep(0.2)  # gentle throttling

    # Write edges (traceability) as before
    with open("edges_seed_to_citer.csv", "w", newline="", encoding="utf-8") as f:
        fieldnames = ["seed_doi", "seed_openalex_id", "seed_title", "citer_key"]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for e in edges_seed_to_citer:
            w.writerow(e)

    with open("edges_seed_to_ref.csv", "w", newline="", encoding="utf-8") as f:
        fieldnames = ["seed_doi", "seed_openalex_id", "seed_title", "ref_key"]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for e in edges_seed_to_ref:
            w.writerow(e)

    # Merge all candidates from forward and backward, and assign IDs
    # BS1_XXX for backward-only, FS1_XXX for forward-only, BFS1_XXX for both
    forward_keys = set(forward_cands.keys())
    backward_keys = set(backward_cands.keys())

    only_backward = sorted(backward_keys - forward_keys)
    only_forward = sorted(forward_keys - backward_keys)
    both = sorted(backward_keys & forward_keys)

    all_cands: Dict[str, dict] = {}

    bs_counter = 1
    fs_counter = 1
    bfs_counter = 1

    for key in only_backward:
        row = dict(backward_cands[key])
        row["ID"] = f"BS1_{bs_counter:03d}"
        bs_counter += 1
        all_cands[key] = row

    for key in only_forward:
        row = dict(forward_cands[key])
        row["ID"] = f"FS1_{fs_counter:03d}"
        fs_counter += 1
        all_cands[key] = row

    for key in both:
        # Prefer forward metadata but could be either; we override ID anyway
        base_row = forward_cands.get(key) or backward_cands.get(key)
        row = dict(base_row)
        row["ID"] = f"BFS1_{bfs_counter:03d}"
        bfs_counter += 1
        all_cands[key] = row

    fieldnames = [
        "Source",
        "ID",
        "Authors",
        "Title",
        "Year",
        "Source title",
        "Cited by",
        "DOI",
        "Abstract",
    ]

    # 1) CSV with all found candidates, deduplicated within this list
    with open("snowball_candidates.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for key in sorted(all_cands.keys()):
            w.writerow(all_cands[key])

    # 2) Additional CSV removing duplicates within this list
    #    + removing all papers whose DOI or Title is in publications.csv
    existing_dois, existing_titles = load_existing_publications("../literature-review/publications.csv")
    seen_dois = set()
    seen_titles = set()

    with open("snowball_candidates_filtered.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for key in sorted(all_cands.keys()):
            row = all_cands[key]
            doi_raw = row.get("DOI") or ""
            doi_norm = norm_doi(doi_raw) if doi_raw else ""
            title_norm = norm_title(row.get("Title") or "")

            # Filter if DOI or Title already exists in the external publications list
            if (doi_norm and doi_norm in existing_dois) or (title_norm and title_norm in existing_titles):
                continue

            # Ensure no duplicates within this filtered list by DOI or Title
            if doi_norm:
                if doi_norm in seen_dois:
                    continue
                seen_dois.add(doi_norm)

            if title_norm:
                if title_norm in seen_titles:
                    continue
                seen_titles.add(title_norm)

            w.writerow(row)

    print("Done: snowball_candidates.csv + snowball_candidates_filtered.csv")


if __name__ == "__main__":
    run_snowballing()

