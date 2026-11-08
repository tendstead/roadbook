package domain

import (
	"strings"
	"testing"
)

func TestFillOverridePreservesMaximumWidthCSV(t *testing.T) {
	spec := ImportSpec{CSV: "date," + strings.Repeat("source,", 98) + "last\n2025-01-01," + strings.Repeat("value,", 98) + "last value", Delimiter: ",", Decimal: ".", DateFormat: "YYYY-MM-DD", Kind: "fuel", VehicleID: NewID(), PayerID: NewID(), DistanceUnit: "km", FuelUnit: "L", StartRow: 2, Columns: map[string]int{"date": 0}, TankOverride: "full"}
	rows, err := PreviewImport(spec)
	if err != nil || len(rows) != 1 || len(rows[0].Errors) != 0 || len(rows[0].Entry.Extra) != 101 || rows[0].Entry.Extra["100:last"] != "last value" {
		t.Fatalf("maximum-width source rejected or lost: %+v %v", rows, err)
	}
}

func TestImportFillOverrideIsExplicitAndPreservesSource(t *testing.T) {
	spec := ImportSpec{CSV: "date,litres,km,fill\n2025-01-01,40,500,partial", Delimiter: ",", Decimal: ".", DateFormat: "YYYY-MM-DD", Kind: "fuel", DistanceUnit: "km", FuelUnit: "L", VehicleID: NewID(), PayerID: NewID(), StartRow: 2, Columns: map[string]int{"date": 0, "volume_ml": 1, "distance_m": 2, "tank": 3}}
	before := spec.Fingerprint()
	spec.TankOverride = "full"
	rows, err := PreviewImport(spec)
	if err != nil || rows[0].Entry.Tank != "full" || rows[0].Entry.Extra["4:fill"] != "partial" || rows[0].Entry.Extra["import:tank_override"] != "full" || before == spec.Fingerprint() {
		t.Fatalf("override/source/fingerprint mismatch: %+v %v", rows, err)
	}
	delete(spec.Columns, "tank")
	spec.TankOverride = ""
	rows, err = PreviewImport(spec)
	if err != nil || rows[0].Entry.Tank != "unknown" {
		t.Fatal("unmapped fullness must remain unknown", err)
	}
	spec.TankOverride = "guessed"
	if _, err = PreviewImport(spec); err == nil {
		t.Fatal("invalid override accepted")
	}
}

func TestImportExplicitAdditionalDateFormats(t *testing.T) {
	for _, tc := range []struct{ value, format, want string }{
		{"04/05/2025", "DD/MM/YYYY", "2025-05-04"},
		{"04/05/2025", "MM/DD/YYYY", "2025-04-05"},
		{"2026.10.31", "YYYY.MM.DD", "2026-10-31"},
	} {
		got, err := importDate(tc.value, tc.format)
		if err != nil || got != tc.want {
			t.Errorf("%s %s: got %s, %v", tc.value, tc.format, got, err)
		}
	}
	if _, err := importDate("31/02/2025", "DD/MM/YYYY"); err == nil {
		t.Fatal("invalid calendar date accepted")
	}
}

func TestImportLocalizedValuesAndPreserveUnmappedCells(t *testing.T) {
	spec := ImportSpec{CSV: "Date;Volume;Distance;Paid;Memo\n01.01.2025;30,25;500,1;54,45 €;keep this\n02.02.0200;-;200;20;bad date", Delimiter: ";", Decimal: ",", DateFormat: "DD.MM.YYYY", Kind: "fuel", VehicleID: NewID(), PayerID: NewID(), DistanceUnit: "km", FuelUnit: "L", StartRow: 2, Columns: map[string]int{"date": 0, "volume_ml": 1, "distance_m": 2, "amount_minor": 3}}
	rows, e := PreviewImport(spec)
	if e != nil {
		t.Fatal(e)
	}
	if len(rows) != 2 {
		t.Fatal(rows)
	}
	first := rows[0]
	if len(first.Errors) > 0 || *first.Entry.VolumeML != 30250 || *first.Entry.DistanceM != 500100 || *first.Entry.AmountMinor != 5445 || first.Entry.Tank != "unknown" {
		t.Fatal(first)
	}
	if first.Entry.Extra["5:Memo"] != "keep this" {
		t.Fatal(first.Entry.Extra)
	}
	if len(rows[1].Errors) == 0 {
		t.Fatal("invalid historical year silently accepted")
	}
}
func TestImportDoesNotInterpretSummaryAsExpense(t *testing.T) {
	spec := ImportSpec{CSV: "date,amount,category\n2025-01-01,10,repair\nTotal,10,", Delimiter: ",", Decimal: ".", DateFormat: "YYYY-MM-DD", Kind: "expense", DistanceUnit: "km", FuelUnit: "L", VehicleID: NewID(), PayerID: NewID(), StartRow: 2, Columns: map[string]int{"date": 0, "amount_minor": 1, "category": 2}}
	rows, e := PreviewImport(spec)
	if e != nil {
		t.Fatal(e)
	}
	if len(rows[1].Errors) == 0 {
		t.Fatal("summary interpreted as record")
	}
}
