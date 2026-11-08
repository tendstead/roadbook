package store

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tendstead/roadbook/internal/domain"
)

func jsonRows[T any](ctx context.Context, s *Store, query string) ([]T, error) {
	out := []T{}
	rows, e := s.Pool.Query(ctx, query)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	for rows.Next() {
		var raw []byte
		if e = rows.Scan(&raw); e != nil {
			return nil, e
		}
		var v T
		if e = json.Unmarshal(raw, &v); e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s *Store) Snapshot(ctx context.Context) (domain.State, error) {
	state := domain.State{}
	e := s.Pool.QueryRow(ctx, "SELECT distance_unit,fuel_unit,currency,timezone FROM settings").Scan(&state.Settings.DistanceUnit, &state.Settings.FuelUnit, &state.Settings.Currency, &state.Settings.Timezone)
	if e != nil {
		return state, e
	}
	state.Profiles, e = jsonRows[domain.Profile](ctx, s, "SELECT jsonb_build_object('id',id,'name',name) FROM profiles ORDER BY name,id")
	if e != nil {
		return state, e
	}
	state.Vehicles, e = jsonRows[domain.Vehicle](ctx, s, "SELECT body FROM vehicles ORDER BY created_at,id")
	if e != nil {
		return state, e
	}
	state.Records, e = jsonRows[domain.Record](ctx, s, "SELECT body FROM entries ORDER BY on_date,sequence")
	if e != nil {
		return state, e
	}
	state.Schedules, e = jsonRows[domain.Schedule](ctx, s, "SELECT body FROM schedules ORDER BY id")
	if e != nil {
		return state, e
	}
	state.Attachments, e = jsonRows[domain.Attachment](ctx, s, "SELECT body FROM attachments ORDER BY id")
	return state, e
}
func (s *Store) SaveProfile(ctx context.Context, p domain.Profile) error {
	_, e := s.Pool.Exec(ctx, "INSERT INTO profiles(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=excluded.name", p.ID, p.Name)
	return e
}
func (s *Store) SaveVehicle(ctx context.Context, v domain.Vehicle) error {
	if e := v.Validate(); e != nil {
		return e
	}
	if !slices.Contains(v.Members, v.OwnerID) {
		v.Members = append(v.Members, v.OwnerID)
	}
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer func() { _ = tx.Rollback(ctx) }()
	raw, e := json.Marshal(v)
	if e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "INSERT INTO vehicles(id,owner_id,body) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,body=excluded.body", v.ID, v.OwnerID, raw); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "DELETE FROM vehicle_members WHERE vehicle_id=$1", v.ID); e != nil {
		return e
	}
	for _, p := range v.Members {
		if _, e = tx.Exec(ctx, "INSERT INTO vehicle_members VALUES($1,$2) ON CONFLICT DO NOTHING", v.ID, p); e != nil {
			return e
		}
	}
	return tx.Commit(ctx)
}
func saveRecord(ctx context.Context, tx pgx.Tx, r domain.Record) error {
	if e := r.Validate(); e != nil {
		return e
	}
	currency, e := financialCurrency(ctx, tx, r.Currency)
	if e != nil {
		return e
	}
	r.Currency = currency
	raw, e := json.Marshal(r)
	if e != nil {
		return e
	}
	var schedule any
	if r.ScheduleID != "" {
		schedule = r.ScheduleID
	}
	result, e := tx.Exec(ctx, `INSERT INTO entries(id,vehicle_id,payer_id,kind,on_date,body,schedule_id) VALUES($1,$2,$3,$4,$5,$6,$7)
 ON CONFLICT(id) DO UPDATE SET payer_id=excluded.payer_id,on_date=excluded.on_date,body=excluded.body
 WHERE entries.vehicle_id=excluded.vehicle_id AND entries.kind=excluded.kind AND (entries.schedule_id IS NULL OR entries.on_date=excluded.on_date)`, r.ID, r.VehicleID, r.PayerID, r.Kind, r.Date, raw, schedule)
	if e != nil {
		return e
	}
	if result.RowsAffected() != 1 {
		return errors.New("entry identity or recurring due date cannot change")
	}
	return nil
}
func (s *Store) SaveRecord(ctx context.Context, r domain.Record) error {
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if e = saveRecord(ctx, tx, r); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (s *Store) SaveSchedule(ctx context.Context, sch domain.Schedule) error {
	if e := sch.Validate(); e != nil {
		return e
	}
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer func() { _ = tx.Rollback(ctx) }()
	currency, e := financialCurrency(ctx, tx, sch.Template.Currency)
	if e != nil {
		return e
	}
	sch.Template.Currency = currency
	if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(7346222)"); e != nil {
		return e
	}
	var oldRaw []byte
	e = tx.QueryRow(ctx, "SELECT body FROM schedules WHERE id=$1", sch.ID).Scan(&oldRaw)
	if e == nil {
		var old domain.Schedule
		if e = json.Unmarshal(oldRaw, &old); e != nil {
			return e
		}
		if old.First != sch.First || old.Months != sch.Months || old.Template.VehicleID != sch.Template.VehicleID {
			return errors.New("start, frequency and vehicle cannot change; end this schedule and create another")
		}
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return e
	}
	raw, e := json.Marshal(sch)
	if e != nil {
		return e
	}
	_, e = tx.Exec(ctx, "INSERT INTO schedules(id,vehicle_id,body) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET body=excluded.body", sch.ID, sch.Template.VehicleID, raw)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (s *Store) Materialize(ctx context.Context, today string) error {
	through, e := time.Parse("2006-01-02", today)
	if e != nil {
		return e
	}
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, e = financialCurrency(ctx, tx, ""); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(7346222)"); e != nil {
		return e
	}
	rows, e := tx.Query(ctx, "SELECT body FROM schedules")
	if e != nil {
		return e
	}
	schedules := []domain.Schedule{}
	for rows.Next() {
		var raw []byte
		if e = rows.Scan(&raw); e != nil {
			rows.Close()
			return e
		}
		var sch domain.Schedule
		if e = json.Unmarshal(raw, &sch); e != nil {
			rows.Close()
			return e
		}
		schedules = append(schedules, sch)
	}
	rows.Close()
	if e = rows.Err(); e != nil {
		return e
	}
	for _, sch := range schedules {
		if !sch.Active {
			continue
		}
		first, _ := time.Parse("2006-01-02", sch.First)
		var end time.Time
		if sch.End != "" {
			end, _ = time.Parse("2006-01-02", sch.End)
		}
		for _, due := range domain.DueDates(first, through, end, sch.Months) {
			day := due.Format("2006-01-02")
			var exists bool
			if e = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM entries WHERE schedule_id=$1 AND on_date=$2)", sch.ID, day).Scan(&exists); e != nil {
				return e
			}
			if exists {
				continue
			}
			r := sch.Template
			r.ID = domain.NewID()
			r.Date = day
			r.ScheduleID = sch.ID
			if e = saveRecord(ctx, tx, r); e != nil {
				return e
			}
		}
	}
	return tx.Commit(ctx)
}
func (s *Store) SaveSettings(ctx context.Context, c domain.Settings) error {
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var old string
	if e = tx.QueryRow(ctx, "SELECT currency FROM settings FOR UPDATE").Scan(&old); e != nil {
		return e
	}
	var n int
	if e = tx.QueryRow(ctx, "SELECT (SELECT count(*) FROM entries)+(SELECT count(*) FROM schedules)").Scan(&n); e != nil {
		return e
	}
	if old != c.Currency && n > 0 {
		return errors.New("currency cannot change after records or schedules exist")
	}
	_, e = tx.Exec(ctx, "UPDATE settings SET distance_unit=$1,fuel_unit=$2,currency=$3,timezone=$4", c.DistanceUnit, c.FuelUnit, c.Currency, c.Timezone)
	if e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (s *Store) DeleteRecord(ctx context.Context, id string) error {
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var editable bool
	if e = tx.QueryRow(ctx, "SELECT schedule_id IS NULL FROM entries WHERE id=$1 FOR UPDATE", id).Scan(&editable); e != nil {
		return e
	}
	if !editable {
		return errors.New("generated charges cannot be deleted")
	}
	if e = queueAttachmentDeletion(ctx, tx, id); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "DELETE FROM entries WHERE id=$1", id); e != nil {
		return e
	}
	return tx.Commit(ctx)
}

func financialCurrency(ctx context.Context, tx pgx.Tx, requested string) (string, error) {
	var currency string
	if e := tx.QueryRow(ctx, "SELECT currency FROM settings FOR SHARE").Scan(&currency); e != nil {
		return "", e
	}
	if requested != "" && requested != currency {
		return "", errors.New("currency changed; reload settings before saving")
	}
	return currency, nil
}
