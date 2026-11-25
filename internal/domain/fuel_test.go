package domain

import "testing"

func ptr(n int64) *int64 { return &n }
func TestFuelIntervals(t *testing.T) {
	for _, tc := range []struct {
		name               string
		entries            []FuelEntry
		consumption, price string
		distance           int64
	}{
		{"full interval", []FuelEntry{{Tank: "full", VolumeML: ptr(40000), AmountMinor: ptr(9000)}, {Tank: "full", VolumeML: ptr(30000), AmountMinor: ptr(6000), DistanceM: ptr(500000)}}, "6.000", "0.1200", 500000},
		{"partial fills", []FuelEntry{{Tank: "full"}, {Tank: "partial", VolumeML: ptr(10000), AmountMinor: ptr(2000), DistanceM: ptr(200000)}, {Tank: "full", VolumeML: ptr(20000), AmountMinor: ptr(4000), DistanceM: ptr(300000)}}, "6.000", "0.1200", 500000},
		{"unknown volume", []FuelEntry{{Tank: "full"}, {Tank: "full", DistanceM: ptr(500000)}}, "", "", 500000},
		{"weighted", []FuelEntry{{Tank: "full"}, {Tank: "full", VolumeML: ptr(30000), AmountMinor: ptr(6000), DistanceM: ptr(500000)}, {Tank: "full", VolumeML: ptr(60000), AmountMinor: ptr(12000), DistanceM: ptr(500000)}}, "9.000", "0.1800", 1000000},
		{"missing cost complete subset", []FuelEntry{{Tank: "full"}, {Tank: "full", VolumeML: ptr(30000), DistanceM: ptr(500000)}, {Tank: "full", VolumeML: ptr(60000), AmountMinor: ptr(12000), DistanceM: ptr(500000)}}, "9.000", "0.2400", 1000000},
		{"custom overrides rounded odometer", []FuelEntry{{Tank: "full", OdometerM: ptr(1000000)}, {Tank: "full", OdometerM: ptr(1500000), DistanceM: ptr(500100), VolumeML: ptr(30000), AmountMinor: ptr(6000)}}, "5.999", "0.1200", 500100},
		{"unknown fullness", []FuelEntry{{Tank: "full"}, {Tank: "unknown", DistanceM: ptr(100000), VolumeML: ptr(10000)}, {Tank: "full", DistanceM: ptr(400000), VolumeML: ptr(20000)}}, "", "", 500000},
		{"missed fill", []FuelEntry{{Tank: "full"}, {Tank: "full", Gap: true, DistanceM: ptr(500000), VolumeML: ptr(30000)}}, "", "", 500000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := CalculateFuel(tc.entries, nil)
			if got.Consumption != tc.consumption || got.FuelCostPerKM != tc.price || got.TotalDistanceM != tc.distance {
				t.Fatalf("got %+v want %s %s %d", got, tc.consumption, tc.price, tc.distance)
			}
		})
	}
}
func TestOdometerGapIsNotNegativeDistance(t *testing.T) {
	got := CalculateFuel([]FuelEntry{{Tank: "full", OdometerM: ptr(1500000)}, {Tank: "full", OdometerM: ptr(1000000), VolumeML: ptr(30000)}}, nil)
	if got.TotalDistanceM != 0 || len(got.Warnings) == 0 || got.Consumption != "" {
		t.Fatal(got)
	}
}

func TestFuelBreakDatesDoNotInferMissingFillsFromElapsedTime(t *testing.T) {
	entries := []FuelEntry{
		{Date: "2025-01-01", Tank: "full"},
		{Date: "2025-03-01", Tank: "full", DistanceM: ptr(500000), VolumeML: ptr(30000)},
		{Date: "2025-06-01", Tank: "partial", DistanceM: ptr(200000), VolumeML: ptr(10000)},
		{Date: "2025-07-01", Tank: "full", DistanceM: ptr(300000), VolumeML: ptr(20000)},
	}
	stats := CalculateFuel(entries, nil)
	if len(stats.BreakDates) != 0 || len(stats.Intervals) != 2 {
		t.Fatalf("ordinary months without fills broke continuity: %+v", stats)
	}
	entries = append(entries, FuelEntry{Date: "2025-08-01", Tank: "full", Gap: true, DistanceM: ptr(500000), VolumeML: ptr(30000)})
	stats = CalculateFuel(entries, nil)
	if len(stats.BreakDates) != 1 || stats.BreakDates[0] != "2025-08-01" {
		t.Fatalf("explicit missing-record flag should break continuity: %+v", stats)
	}
	entries = append(entries, FuelEntry{Date: "2025-09-01", Tank: "full", DistanceM: ptr(500000)})
	stats = CalculateFuel(entries, nil)
	if len(stats.BreakDates) != 2 || stats.BreakDates[1] != "2025-09-01" {
		t.Fatalf("missing volume should break continuity: %+v", stats)
	}
}
