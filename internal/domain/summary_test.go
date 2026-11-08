package domain

import "testing"

func TestUpkeepAverageDoesNotOverflowAtAllowedMonetaryLimit(t *testing.T) {
	v := Vehicle{ID: NewID(), OwnershipStart: "2025-01-01"}
	amount := int64(1000000000000)
	state := State{Vehicles: []Vehicle{v}, Records: []Record{{FuelEntry: FuelEntry{Date: "2025-01-01", AmountMinor: &amount}, Kind: "expense", Category: "repair", VehicleID: v.ID}}}
	// 30 days of ownership: 1e12 cents * 30.436875 days/month / 30 days.
	if got := Summarize(state, "2025-01-31")[v.ID].UpkeepMonthly; got != "1014562500000" {
		t.Fatal(got)
	}
}

func TestAnnualDistanceUsesClosingDateAndTotalIncludesAllCostsOnce(t *testing.T) {
	v := Vehicle{ID: NewID(), OwnershipStart: "2024-01-01"}
	p := NewID()
	state := State{Vehicles: []Vehicle{v}}
	state.Records = []Record{
		{FuelEntry: FuelEntry{Date: "2024-12-31", Tank: "full", AmountMinor: ptr(5000)}, VehicleID: v.ID, PayerID: p, Kind: "fuel"},
		{FuelEntry: FuelEntry{Date: "2025-01-02", Tank: "full", DistanceM: ptr(500100), VolumeML: ptr(30000), AmountMinor: ptr(6000)}, VehicleID: v.ID, PayerID: p, Kind: "fuel"},
		{FuelEntry: FuelEntry{Date: "2024-01-01", AmountMinor: ptr(1000000)}, VehicleID: v.ID, PayerID: p, Kind: "expense", Category: "purchase"},
		{FuelEntry: FuelEntry{Date: "2025-01-03", AmountMinor: ptr(12000)}, VehicleID: v.ID, PayerID: p, Kind: "expense", Category: "service"},
		{FuelEntry: FuelEntry{Date: "2025-01-03", AmountMinor: ptr(-2000)}, VehicleID: v.ID, PayerID: p, Kind: "expense", Category: "service"},
		{FuelEntry: FuelEntry{Date: "2025-01-03", AmountMinor: ptr(30000)}, VehicleID: v.ID, PayerID: p, Kind: "expense", Category: "insurance"},
	}
	got := Summarize(state, "2026-02-01")[v.ID]
	if got.AnnualDistance["2025"] != 500100 || got.AnnualDistance["2024"] != 0 || got.TotalMinor != 1051000 || got.UpkeepMinor != 10000 || got.AnnualMode != "years" {
		t.Fatal(got)
	}
}
