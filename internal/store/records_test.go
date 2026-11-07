package store

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/tendstead/roadbook/internal/domain"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
)

func serviceStore(t *testing.T) *Store {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("isolated database required")
	}
	s, e := Open(context.Background(), url)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(s.Close)
	return s
}

func TestImportAtomicityAndRepeatSelection(t *testing.T) {
	s := serviceStore(t)
	ctx := context.Background()
	state, e := s.Snapshot(ctx)
	if e != nil {
		t.Fatal(e)
	}
	p := state.Profiles[0].ID
	v := domain.Vehicle{ID: domain.NewID(), Name: "Import vehicle", OwnerID: p, Members: []string{p}, Kind: "car"}
	if e = s.SaveVehicle(ctx, v); e != nil {
		t.Fatal(e)
	}
	amount := int64(1000)
	first := domain.ImportRow{SourceRow: 2, Entry: domain.Record{FuelEntry: domain.FuelEntry{Date: "2025-01-01", AmountMinor: &amount}, Kind: "expense", Category: "repair", VehicleID: v.ID, PayerID: p}}
	invalid := first
	invalid.SourceRow = 3
	invalid.Entry.Date = "bad date"
	key := domain.NewID()
	if _, e = s.Import(ctx, key, []domain.ImportRow{first, invalid}, false); e == nil {
		t.Fatal("invalid row accepted")
	}
	var n int
	if e = s.Pool.QueryRow(ctx, "SELECT count(*) FROM entries WHERE vehicle_id=$1", v.ID).Scan(&n); e != nil || n != 0 {
		t.Fatal("partial import committed", n, e)
	}
	for i, want := range []int{1, 0} {
		got, e := s.Import(ctx, key, []domain.ImportRow{first}, false)
		if e != nil || got != want {
			t.Fatalf("retry %d got %d want %d: %v", i, got, want, e)
		}
	}
	second := first
	second.SourceRow = 3
	second.Entry.Date = "2025-02-01"
	if got, e := s.Import(ctx, key, []domain.ImportRow{second}, false); e != nil || got != 1 {
		t.Fatal(got, e)
	}
}
func TestConcurrentRecurrenceCatchupDoesNotDuplicate(t *testing.T) {
	s := serviceStore(t)
	ctx := context.Background()
	state, e := s.Snapshot(ctx)
	if e != nil {
		t.Fatal(e)
	}
	p := state.Profiles[0].ID
	v := domain.Vehicle{ID: domain.NewID(), Name: "Concurrent vehicle", OwnerID: p, Members: []string{p}, Kind: "car"}
	if e = s.SaveVehicle(ctx, v); e != nil {
		t.Fatal(e)
	}
	amount := int64(2000)
	sch := domain.Schedule{ID: domain.NewID(), Template: domain.Record{FuelEntry: domain.FuelEntry{Date: "2025-01-01", AmountMinor: &amount}, VehicleID: v.ID, PayerID: p, Kind: "expense", Category: "insurance"}, First: "2025-01-01", End: "2025-12-31", Months: 3, Active: true}
	if e = s.SaveSchedule(ctx, sch); e != nil {
		t.Fatal(e)
	}
	var wg sync.WaitGroup
	for range 3 {
		wg.Go(func() {
			if e := s.Materialize(ctx, "2026-01-01"); e != nil {
				t.Error(e)
			}
		})
	}
	wg.Wait()
	var n int
	if e = s.Pool.QueryRow(ctx, "SELECT count(*) FROM entries WHERE vehicle_id=$1", v.ID).Scan(&n); e != nil || n != 4 {
		t.Fatal(n, e)
	}
}

func TestGeneratedChargeCannotMoveItsOccurrenceDate(t *testing.T) {
	s := serviceStore(t)
	ctx := context.Background()
	state, e := s.Snapshot(ctx)
	if e != nil {
		t.Fatal(e)
	}
	p := state.Profiles[0].ID
	v := domain.Vehicle{ID: domain.NewID(), Name: "Date identity", OwnerID: p, Kind: "car"}
	if e = s.SaveVehicle(ctx, v); e != nil {
		t.Fatal(e)
	}
	amount := int64(1000)
	sch := domain.Schedule{ID: domain.NewID(), Template: domain.Record{FuelEntry: domain.FuelEntry{Date: "2025-01-01", AmountMinor: &amount}, VehicleID: v.ID, PayerID: p, Kind: "expense", Category: "lease"}, First: "2025-01-01", End: "2025-01-31", Months: 1, Active: true}
	if e = s.SaveSchedule(ctx, sch); e != nil {
		t.Fatal(e)
	}
	if e = s.Materialize(ctx, "2025-02-01"); e != nil {
		t.Fatal(e)
	}
	state, e = s.Snapshot(ctx)
	if e != nil {
		t.Fatal(e)
	}
	for _, r := range state.Records {
		if r.ScheduleID == sch.ID {
			r.Date = "2025-01-02"
			if e = s.SaveRecord(ctx, r); e == nil {
				t.Fatal("generated charge date changed")
			}
		}
	}
	if e = s.Materialize(ctx, "2025-02-01"); e != nil {
		t.Fatal(e)
	}
	var n int
	if e = s.Pool.QueryRow(ctx, "SELECT count(*) FROM entries WHERE schedule_id=$1", sch.ID).Scan(&n); e != nil || n != 1 {
		t.Fatal(n, e)
	}
}
func TestCurrencyCannotChangeWithOnlyFutureSchedule(t *testing.T) {
	root := serviceStore(t)
	ctx := context.Background()
	name := "roadbook_" + strings.ReplaceAll(domain.NewID(), "-", "")
	if _, e := root.Pool.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{name}.Sanitize()); e != nil {
		t.Fatal(e)
	}
	u, e := url.Parse(os.Getenv("TEST_DATABASE_URL"))
	if e != nil {
		t.Fatal(e)
	}
	u.Path = "/" + name
	s, e := Open(ctx, u.String())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { s.Close(); _, _ = root.Pool.Exec(ctx, "DROP DATABASE "+pgx.Identifier{name}.Sanitize()) })
	state, e := s.Snapshot(ctx)
	if e != nil {
		t.Fatal(e)
	}
	p := state.Profiles[0].ID
	v := domain.Vehicle{ID: domain.NewID(), Name: "Future schedule", OwnerID: p, Kind: "car"}
	if e = s.SaveVehicle(ctx, v); e != nil {
		t.Fatal(e)
	}
	amount := int64(1000)
	sch := domain.Schedule{ID: domain.NewID(), Template: domain.Record{FuelEntry: domain.FuelEntry{Date: "2099-01-01", AmountMinor: &amount}, VehicleID: v.ID, PayerID: p, Kind: "expense", Category: "lease"}, First: "2099-01-01", Months: 12, Active: true}
	if e = s.SaveSchedule(ctx, sch); e != nil {
		t.Fatal(e)
	}
	other := domain.Settings{DistanceUnit: "km", FuelUnit: "L", Currency: "USD", Timezone: "Europe/Berlin"}
	if e = s.SaveSettings(ctx, other); e == nil {
		t.Fatal("future schedule currency was reinterpreted")
	}
}
