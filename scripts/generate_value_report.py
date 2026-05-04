#!/usr/bin/env python3
import argparse
import json
import urllib.request


def fetch(url: str, token: str):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Generate TeamUp value report from impact endpoint")
    parser.add_argument("--base-url", required=True, help="API base URL, e.g. https://teamup.example.com/api")
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--token", required=True, help="Bearer token")
    args = parser.parse_args()

    impact = fetch(f"{args.base_url}/analytics/impact/{args.workspace_id}", args.token)
    print("# TeamUp Value Report (Auto)\n")
    print(f"Workspace: {args.workspace_id}\n")
    print("| Metric | Baseline | Current | Delta | Delta % |")
    print("| --- | ---: | ---: | ---: | ---: |")
    for row in impact.get("metrics", []):
        delta_pct = "-" if row.get("delta_pct") is None else f"{row['delta_pct']}"
        print(
            f"| {row['metric']} | {row['baseline']} | {row['current']} | {row['delta']} | {delta_pct} |"
        )


if __name__ == "__main__":
    main()

