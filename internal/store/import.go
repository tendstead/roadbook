package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/tendstead/roadbook/internal/domain"
)

func (s *Store) Import(ctx context.Context, fingerprint string, rows []domain.ImportRow, allowMatches bool) (int, error) {
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return 0, e
	}
	defer func() { _ = tx.Rollback(ctx) }()
	currency, e := financialCurrency(ctx, tx, "")
	if e != nil {
		return 0, e
	}
	if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(7346223)"); e != nil {
		return 0, e
	}
	if _, e = tx.Exec(ctx, "INSERT INTO import_batches(fingerprint,record_count) VALUES($1,0) ON CONFLICT DO NOTHING", fingerprint); e != nil {
		return 0, e
	}
	existing, e := tx.Query(ctx, "SELECT body FROM entries")
	if e != nil {
		return 0, e
	}
	keys := map[string]bool{}
	for existing.Next() {
		var raw []byte
		if e = existing.Scan(&raw); e != nil {
			existing.Close()
			return 0, e
		}
		var r domain.Record
		if e = json.Unmarshal(raw, &r); e != nil {
			existing.Close()
			return 0, e
		}
		keys[domain.RecordKey(r)] = true
	}
	existing.Close()
	if e = existing.Err(); e != nil {
		return 0, e
	}
	count := 0
	for _, row := range rows {
		if len(row.Errors) > 0 {
			return 0, errors.New("selected import row has errors")
		}
		result, e := tx.Exec(ctx, "INSERT INTO import_rows(fingerprint,source_row) VALUES($1,$2) ON CONFLICT DO NOTHING", fingerprint, row.SourceRow)
		if e != nil {
			return 0, e
		}
		if result.RowsAffected() == 0 {
			continue
		}
		r := row.Entry
		if r.Currency != "" && r.Currency != currency {
			return 0, errors.New("currency changed; preview the import again")
		}
		r.Currency = currency
		r.ID = domain.NewID()
		r.ScheduleID = ""
		if e = r.Validate(); e != nil {
			return 0, e
		}
		if !allowMatches && keys[domain.RecordKey(r)] {
			return 0, errors.New("matching record already exists; review duplicates before explicitly allowing matches")
		}
		if row.Schedule != nil {
			sch := *row.Schedule
			sch.ID = domain.NewID()
			sch.Template = r
			if e = sch.Validate(); e != nil {
				return 0, e
			}
			raw, e := json.Marshal(sch)
			if e != nil {
				return 0, e
			}
			if _, e = tx.Exec(ctx, "INSERT INTO schedules(id,vehicle_id,body) VALUES($1,$2,$3)", sch.ID, r.VehicleID, raw); e != nil {
				return 0, e
			}
		} else {
			if e = saveRecord(ctx, tx, r); e != nil {
				return 0, e
			}
			keys[domain.RecordKey(r)] = true
		}
		count++
	}
	if _, e = tx.Exec(ctx, "UPDATE import_batches SET record_count=record_count+$2 WHERE fingerprint=$1", fingerprint, count); e != nil {
		return 0, e
	}
	return count, tx.Commit(ctx)
}
