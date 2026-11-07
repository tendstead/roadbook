package domain

import "time"

type Summary struct {
	Fuel              FuelStats        `json:"fuel"`
	TotalMinor        int64            `json:"total_minor"`
	FuelMinor         int64            `json:"fuel_minor"`
	UpkeepMinor       int64            `json:"upkeep_minor"`
	UpkeepMonthly     string           `json:"upkeep_monthly"`
	MonthlyFuel       map[string]int64 `json:"monthly_fuel"`
	AnnualDistance    map[string]int64 `json:"annual_distance"`
	AnnualMode        string           `json:"annual_mode"`
	FirstDistanceDate string           `json:"first_distance_date"`
}

func Summarize(state State, today string) map[string]Summary {
	out := map[string]Summary{}
	now, _ := time.Parse("2006-01-02", today)
	for _, v := range state.Vehicles {
		sum := Summary{MonthlyFuel: map[string]int64{}, AnnualDistance: map[string]int64{}, AnnualMode: "total"}
		fuel := []FuelEntry{}
		for _, e := range state.Records {
			if e.VehicleID != v.ID || e.Date > today {
				continue
			}
			if e.AmountMinor != nil {
				sum.TotalMinor += *e.AmountMinor
				if e.Kind == "fuel" {
					sum.FuelMinor += *e.AmountMinor
					sum.MonthlyFuel[e.Date[:7]] += *e.AmountMinor
				} else if IsUpkeep(e.Category) {
					sum.UpkeepMinor += *e.AmountMinor
				}
			}
			if e.Kind == "fuel" {
				fuel = append(fuel, e.FuelEntry)
			}
		}
		sum.Fuel = CalculateFuel(fuel, v.InitialOdometerM)
		for _, d := range sum.Fuel.Distances {
			sum.AnnualDistance[d.Date[:4]] += d.Metres
			if sum.FirstDistanceDate == "" {
				sum.FirstDistanceDate = d.Date
			}
		}
		if sum.FirstDistanceDate != "" {
			first, _ := time.Parse("2006-01-02", sum.FirstDistanceDate)
			if now.After(first.AddDate(2, 0, 0)) {
				sum.AnnualMode = "graph"
			} else if !now.Before(first.AddDate(1, 0, 0)) {
				sum.AnnualMode = "years"
			}
		}
		if v.OwnershipStart != "" {
			start, _ := time.Parse("2006-01-02", v.OwnershipStart)
			end := now
			if v.OwnershipEnd != "" && v.OwnershipEnd < today {
				end, _ = time.Parse("2006-01-02", v.OwnershipEnd)
			}
			days := int64(end.Sub(start) / (24 * time.Hour))
			sum.UpkeepMonthly = RatioScaled(sum.UpkeepMinor, days, 30436875, 1000000, 0)
		}
		out[v.ID] = sum
	}
	return out
}
