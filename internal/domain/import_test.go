package domain

import "testing"

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
