package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/tendstead/roadbook/internal/attachments"
	"github.com/tendstead/roadbook/internal/domain"
	"github.com/tendstead/roadbook/internal/store"
	"image"
	"image/jpeg"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
)

func regressionApp(t *testing.T) (*store.Store, string, domain.Vehicle, string) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("isolated database required")
	}
	ctx := context.Background()
	s, e := store.Open(ctx, url)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(s.Close)
	state, e := s.Snapshot(ctx)
	if e != nil {
		t.Fatal(e)
	}
	p := state.Profiles[0].ID
	v := domain.Vehicle{ID: domain.NewID(), Name: "Regression fixture", Kind: "car", OwnerID: p}
	if e = s.SaveVehicle(ctx, v); e != nil {
		t.Fatal(e)
	}
	return s, p, v, t.TempDir()
}
func TestEntryDeletionRemovesOriginalAndPreview(t *testing.T) {
	s, p, v, dir := regressionApp(t)
	ctx := context.Background()
	amount := int64(1000)
	entry := domain.Record{FuelEntry: domain.FuelEntry{ID: domain.NewID(), Date: "2025-01-01", AmountMinor: &amount}, Kind: "expense", Category: "repair", PayerID: p, VehicleID: v.ID}
	if e := s.SaveRecord(ctx, entry); e != nil {
		t.Fatal(e)
	}
	var raw bytes.Buffer
	if e := jpeg.Encode(&raw, image.NewRGBA(image.Rect(0, 0, 32, 32)), nil); e != nil {
		t.Fatal(e)
	}
	at, e := attachments.Save(dir, raw.Bytes())
	if e != nil {
		t.Fatal(e)
	}
	at.EntryID = entry.ID
	at.Purpose = "bill"
	if e = s.SaveAttachment(ctx, at); e != nil {
		t.Fatal(e)
	}
	r := httptest.NewRequest("DELETE", "/api/entries/"+entry.ID, nil)
	r.Header.Set("X-Roadbook-Request", "1")
	r.Header.Set("X-Roadbook-Profile", p)
	w := httptest.NewRecorder()
	Application(s, fstest.MapFS{}, dir).ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	for _, suffix := range []string{".original", ".thumb.jpg"} {
		if _, e = os.Stat(filepath.Join(dir, at.ID+suffix)); !os.IsNotExist(e) {
			t.Fatalf("deleted attachment remains: %s (%v)", suffix, e)
		}
	}
}
func TestImportRejectsUncorrectedInvalidFuelAmount(t *testing.T) {
	s, p, v, dir := regressionApp(t)
	spec := domain.ImportSpec{CSV: "Date,Paid\n2025-01-01,not-a-number", Delimiter: ",", Decimal: ".", DateFormat: "YYYY-MM-DD", Kind: "fuel", VehicleID: v.ID, PayerID: p, DistanceUnit: "km", FuelUnit: "L", StartRow: 2, Columns: map[string]int{"date": 0, "amount_minor": 1}}
	rows, e := domain.PreviewImport(spec)
	if e != nil {
		t.Fatal(e)
	}
	h := Application(s, fstest.MapFS{}, dir)
	send := func() int {
		body, _ := json.Marshal(map[string]any{"spec": spec, "rows": rows, "allow_matches": false})
		r := httptest.NewRequest("POST", "/api/import/commit", bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Roadbook-Request", "1")
		r.Header.Set("X-Roadbook-Profile", p)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w.Code
	}
	if got := send(); got != 400 {
		t.Fatalf("invalid source amount accepted: %d", got)
	}
	amount := int64(1000)
	rows[0].Entry.AmountMinor = &amount
	if got := send(); got != 200 {
		t.Fatalf("explicit correction rejected: %d", got)
	}
}

func TestImportRejectsInvalidRecurringEndDate(t *testing.T) {
	s, p, v, dir := regressionApp(t)
	spec := domain.ImportSpec{CSV: "Date,Paid,End,Frequency\n2099-01-01,10,not-a-date,monthly", Delimiter: ",", Decimal: ".", DateFormat: "YYYY-MM-DD", Kind: "schedule", VehicleID: v.ID, PayerID: p, DistanceUnit: "km", FuelUnit: "L", StartRow: 2, Columns: map[string]int{"date": 0, "amount_minor": 1, "end_date": 2, "frequency": 3}}
	rows, e := domain.PreviewImport(spec)
	if e != nil {
		t.Fatal(e)
	}
	body, _ := json.Marshal(map[string]any{"spec": spec, "rows": rows, "allow_matches": false})
	r := httptest.NewRequest("POST", "/api/import/commit", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-Roadbook-Request", "1")
	r.Header.Set("X-Roadbook-Profile", p)
	w := httptest.NewRecorder()
	Application(s, fstest.MapFS{}, dir).ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatalf("invalid end date silently became an indefinite schedule: %d", w.Code)
	}
}
