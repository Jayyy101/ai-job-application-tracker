"""Run an explicitly selected local workspace, without loading legacy AI code."""
import argparse
import os

import uvicorn

from tracker.database import selected_database
from tracker.seed import seed_demo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, help="Absolute path to a separate development SQLite file")
    parser.add_argument("--port", type=int, default=43128)
    parser.add_argument("--frontend-origin", default="http://127.0.0.1:43127")
    parser.add_argument("--seed-demo", action="store_true", help="Add synthetic records only if the selected workspace is empty")
    parser.add_argument('--review-mode', choices=['disabled', 'mock', 'openai'], default='disabled')
    parser.add_argument('--env-file', help='Optional explicit server-only .env path; never printed')
    parser.add_argument('--seed-review-demo', action='store_true', help='Add a synthetic application and pasted versions; no AI requests')
    args = parser.parse_args()
    if args.env_file:
        from dotenv import load_dotenv
        load_dotenv(args.env_file, override=False)
    os.environ['TRACKER_REVIEW_MODE'] = args.review_mode
    path = selected_database(args.database)
    os.environ["TRACKER_DATABASE_PATH"] = str(path)
    os.environ["TRACKER_FRONTEND_ORIGIN"] = args.frontend_origin
    print(f"Development database: {path}", flush=True)
    if args.seed_demo:
        print(f"Added {seed_demo(path)} synthetic records (existing records are never replaced).", flush=True)
    if args.seed_review_demo:
        from tracker.seed_review import seed_review
        print(f"Synthetic review application: {seed_review(path)}", flush=True)
    uvicorn.run("tracker.api:create_app", factory=True, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
