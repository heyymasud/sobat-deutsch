-- S6-08/S6-09 fix: dictionary_meta had no primary key (admin-review-suggestion's
-- `.eq("id", currentMeta.id)` update was silently a no-op) and the approval flow
-- fabricated a random checksum instead of signaling that a re-export is due.
-- BR-SYNC-05: approval only flags the dataset as stale; the real checksum is
-- only ever (re)computed by the manual scripts/export_dictionary_full.py batch job.

alter table public.dictionary_meta add column id bigint generated always as identity primary key;
alter table public.dictionary_meta add column needs_reexport boolean not null default false;
