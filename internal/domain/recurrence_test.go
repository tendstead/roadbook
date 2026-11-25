package domain

import (
	"testing"
	"time"
)

func date(s string) time.Time {
	d, e := time.Parse("2006-01-02", s)
	if e != nil {
		panic(e)
	}
	return d
}
func TestRecurrenceKeepsMonthEndAnchorAndInclusiveEnd(t *testing.T) {
	got := DueDates(date("2025-01-31"), date("2025-06-01"), date("2025-03-31"), 1)
	want := []string{"2025-01-31", "2025-02-28", "2025-03-31"}
	if len(got) != len(want) {
		t.Fatal(got)
	}
	for i, d := range got {
		if d.Format("2006-01-02") != want[i] {
			t.Fatal(got)
		}
	}
}
func TestAnnualLeapDayAndQuarterly(t *testing.T) {
	got := DueDates(date("2024-02-29"), date("2026-03-01"), time.Time{}, 12)
	if len(got) != 3 || got[1].Format("2006-01-02") != "2025-02-28" {
		t.Fatal(got)
	}
	got = DueDates(date("2025-01-31"), date("2025-07-31"), time.Time{}, 3)
	if len(got) != 3 || got[1].Format("2006-01-02") != "2025-04-30" {
		t.Fatal(got)
	}
}
