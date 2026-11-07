package domain

import "math/big"

type FuelEntry struct {
	ID          string `json:"id"`
	Date        string `json:"date"`
	OdometerM   *int64 `json:"odometer_m"`
	DistanceM   *int64 `json:"distance_m"`
	VolumeML    *int64 `json:"volume_ml"`
	AmountMinor *int64 `json:"amount_minor"`
	Tank        string `json:"tank"`
	Gap         bool   `json:"gap"`
}
type Interval struct {
	Date        string `json:"date"`
	DistanceM   int64  `json:"distance_m"`
	VolumeML    int64  `json:"volume_ml"`
	AmountMinor *int64 `json:"amount_minor"`
}
type MeasuredDistance struct {
	Date   string `json:"date"`
	Metres int64  `json:"metres"`
}
type FuelStats struct {
	Consumption      string             `json:"consumption"`
	FuelCostPerKM    string             `json:"fuel_cost_per_km"`
	TotalDistanceM   int64              `json:"total_distance_m"`
	MatchedDistanceM int64              `json:"matched_distance_m"`
	PricedDistanceM  int64              `json:"priced_distance_m"`
	Intervals        []Interval         `json:"intervals"`
	Distances        []MeasuredDistance `json:"distances"`
	Warnings         []string           `json:"warnings"`
}

func Ratio(n, d int64, precision int) string {
	return RatioScaled(n, d, 1, 1, precision)
}
func RatioScaled(n, d, scaleN, scaleD int64, precision int) string {
	if d <= 0 {
		return ""
	}
	value := new(big.Rat).SetFrac(big.NewInt(n), big.NewInt(d))
	value.Mul(value, new(big.Rat).SetFrac(big.NewInt(scaleN), big.NewInt(scaleD)))
	return value.FloatString(precision)
}

func CalculateFuel(entries []FuelEntry, initial *int64) FuelStats {
	s := FuelStats{Intervals: []Interval{}, Distances: []MeasuredDistance{}, Warnings: []string{}}
	previous := initial
	open := false
	priced := true
	var metres, ml, minor, totalML, totalCost int64
	for _, e := range entries {
		distance := e.DistanceM
		if distance == nil && previous != nil && e.OdometerM != nil {
			d := *e.OdometerM - *previous
			if d >= 0 {
				distance = &d
			}
		}
		if e.DistanceM != nil && e.OdometerM != nil && previous != nil {
			difference := *e.DistanceM - (*e.OdometerM - *previous)
			if difference > 100 || difference < -100 {
				s.Warnings = append(s.Warnings, e.Date+": custom distance differs from odometer")
			}
		}
		previous = e.OdometerM
		if distance != nil && *distance > 0 {
			s.TotalDistanceM += *distance
			s.Distances = append(s.Distances, MeasuredDistance{e.Date, *distance})
		} else {
			s.Warnings = append(s.Warnings, e.Date+": distance unavailable or zero")
		}
		broken := e.Gap || e.Tank == "unknown" || distance == nil || *distance <= 0 || e.VolumeML == nil
		if open && !broken {
			metres += *distance
			ml += *e.VolumeML
			if e.AmountMinor == nil {
				priced = false
			} else {
				minor += *e.AmountMinor
			}
			if e.Tank == "full" {
				in := Interval{Date: e.Date, DistanceM: metres, VolumeML: ml}
				s.MatchedDistanceM += metres
				totalML += ml
				if priced {
					cost := minor
					in.AmountMinor = &cost
					totalCost += minor
					s.PricedDistanceM += metres
				} else {
					s.Warnings = append(s.Warnings, e.Date+": incomplete costs; interval excluded from fuel cost/km")
				}
				s.Intervals = append(s.Intervals, in)
			}
		} else if open {
			s.Warnings = append(s.Warnings, e.Date+": incomplete fuel interval; no consumption assumed")
			open = false
		}
		if e.Tank == "full" {
			open = true
			metres = 0
			ml = 0
			minor = 0
			priced = true
		}
	}
	s.Consumption = RatioScaled(totalML, s.MatchedDistanceM, 100, 1, 3)
	s.FuelCostPerKM = RatioScaled(totalCost, s.PricedDistanceM, 10, 1, 4)
	return s
}
