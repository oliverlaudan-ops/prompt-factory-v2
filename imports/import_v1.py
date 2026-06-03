#!/usr/bin/env python3
"""
Importiert den V1-Prompt-Factory-Backup in die V2-DB.
- Mappt v1-User-IDs auf den existierenden v2-User (per E-Mail).
- Idempotent: existiert ein Prompt mit gleichem Titel beim User, wird er übersprungen
  (oder mit --force überschrieben).
- Behält createdAt/updatedAt aus dem Backup.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import execute_values

DEFAULT_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres_pf_strong_2026@127.0.0.1:5432/promptfactory",
)


def parse_iso(s: str) -> datetime:
    if not s:
        return datetime.now(timezone.utc)
    if s.endswith("Z"):
        s = s.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", help="Pfad zur V1-Backup-JSON")
    ap.add_argument(
        "--email",
        default="oliver.laudan@gmail.com",
        help="E-Mail des v2-Users, dem die Prompts zugeordnet werden sollen",
    )
    ap.add_argument(
        "--force",
        action="store_true",
        help="Existierende Prompts gleichen Titels überschreiben",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur anzeigen, nichts schreiben",
    )
    args = ap.parse_args()

    with open(args.file, "r", encoding="utf-8") as f:
        backup = json.load(f)

    v1_user = backup.get("user", {})
    prompts = backup.get("prompts", [])
    print(f"V1-Backup: {len(prompts)} Prompts, User: {v1_user.get('email')}")
    print(f"Ziel-User : {args.email}")
    print(f"Mode      : {'FORCE' if args.force else 'skip-dup'} | {'DRY-RUN' if args.dry_run else 'WRITE'}")
    print()

    conn = psycopg2.connect(DEFAULT_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute('SELECT id, email, name FROM "User" WHERE email = %s', (args.email,))
    row = cur.fetchone()
    if not row:
        print(f"ERROR: User mit E-Mail {args.email} existiert nicht in der DB.")
        print("Erst registrieren oder --email anpassen.")
        sys.exit(1)
    v2_user_id, v2_email, v2_name = row
    print(f"→ Mappe auf v2-User: id={v2_user_id} email={v2_email} name={v2_name}\n")

    inserted = 0
    skipped = 0
    updated = 0
    errors = 0

    for p in prompts:
        title = (p.get("title") or "").strip()
        if not title:
            print(f"  SKIP: Prompt ohne Titel (id={p.get('id')})")
            skipped += 1
            continue

        # Existiert dieser Titel schon beim User?
        cur.execute(
            'SELECT id FROM "Prompt" WHERE "userId" = %s AND title = %s',
            (v2_user_id, title),
        )
        existing = cur.fetchone()

        data = (
            p.get("id"),  # v1-id (zur Nachvollziehbarkeit)
            v2_user_id,
            title,
            p.get("description"),
            p.get("content"),
            p.get("category"),
            p.get("tags"),
            bool(p.get("isFavorite", False)),
            bool(p.get("isPublic", False)),
            parse_iso(p.get("createdAt")),
            parse_iso(p.get("updatedAt")),
        )

        if existing:
            if not args.force:
                print(f"  SKIP (existiert): {title}")
                skipped += 1
                continue
            # Update
            if not args.dry_run:
                cur.execute(
                    """
                    UPDATE "Prompt" SET
                        description = %s,
                        content     = %s,
                        category    = %s,
                        tags        = %s,
                        "isFavorite"= %s,
                        "isPublic"  = %s,
                        "createdAt" = %s,
                        "updatedAt" = %s
                    WHERE id = %s
                    """,
                    (data[2], data[3], data[4], data[5], data[6], data[7], data[8], data[9], data[10], existing[0]),
                )
            print(f"  UPD: {title}")
            updated += 1
        else:
            # Insert (neue v2-Generierung der ID, aber alte v1-ID als _v1Id merken wir nicht im Schema)
            # Also: einfach mit neuem cuid anlegen
            if not args.dry_run:
                cur.execute(
                    """
                    INSERT INTO "Prompt"
                        ("userId", title, description, content, category, tags, "isFavorite", "isPublic", "createdAt", "updatedAt")
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (data[1], data[2], data[3], data[4], data[5], data[6], data[7], data[8], data[9], data[10]),
                )
            print(f"  ADD: {title}")
            inserted += 1

    if args.dry_run:
        conn.rollback()
        print(f"\nDRY-RUN: nichts geschrieben.")
    else:
        conn.commit()
        print(f"\nCommit OK.")

    cur.close()
    conn.close()

    print(f"\n=== Zusammenfassung ===")
    print(f"  Eingefügt  : {inserted}")
    print(f"  Aktualisiert: {updated}")
    print(f"  Übersprungen: {skipped}")
    print(f"  Fehler     : {errors}")


if __name__ == "__main__":
    main()
