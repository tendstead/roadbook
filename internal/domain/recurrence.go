package domain

import "time"

func DueDates(first, through, end time.Time, months int) []time.Time {
	dates := []time.Time{}
	if months != 1 && months != 3 && months != 12 {
		return dates
	}
	for n := 0; n < 2400; n++ {
		anchor := time.Date(first.Year(), first.Month()+time.Month(n*months), 1, 0, 0, 0, 0, first.Location())
		last := anchor.AddDate(0, 1, -1).Day()
		day := first.Day()
		if day > last {
			day = last
		}
		due := time.Date(anchor.Year(), anchor.Month(), day, 0, 0, 0, 0, first.Location())
		if due.After(through) || (!end.IsZero() && due.After(end)) {
			break
		}
		dates = append(dates, due)
	}
	return dates
}
