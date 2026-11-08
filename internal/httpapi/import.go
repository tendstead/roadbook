package httpapi

import (
	"github.com/tendstead/roadbook/internal/domain"
	"net/http"
	"slices"
)

func (a *application) preview(w http.ResponseWriter, r *http.Request) {
	state, p, ok := a.load(w, r)
	if !ok {
		return
	}
	var spec domain.ImportSpec
	if !readJSON(w, r, &spec) {
		return
	}
	if !allowed(w, state, p, spec.VehicleID) {
		return
	}
	spec.PayerID = p
	rows, e := domain.PreviewImport(spec)
	if e != nil {
		JSON(w, 400, map[string]string{"error": e.Error()})
		return
	}
	for i := range rows {
		rows[i].Entry.Currency = state.Settings.Currency
		for _, entry := range state.Records {
			if domain.RecordKey(entry) == domain.RecordKey(rows[i].Entry) {
				rows[i].Warnings = append(rows[i].Warnings, "Matching existing entry; review before importing")
				break
			}
		}
	}
	JSON(w, 200, map[string]any{"rows": rows, "fingerprint": spec.Fingerprint()})
}
func (a *application) commitImport(w http.ResponseWriter, r *http.Request) {
	state, p, ok := a.load(w, r)
	if !ok {
		return
	}
	var input struct {
		Spec         domain.ImportSpec  `json:"spec"`
		Rows         []domain.ImportRow `json:"rows"`
		AllowMatches bool               `json:"allow_matches"`
	}
	if !readJSON(w, r, &input) {
		return
	}
	if !allowed(w, state, p, input.Spec.VehicleID) {
		return
	}
	input.Spec.PayerID = p
	source, e := domain.PreviewImport(input.Spec)
	if e != nil {
		JSON(w, 400, map[string]string{"error": e.Error()})
		return
	}
	if len(input.Rows) == 0 {
		JSON(w, 400, map[string]string{"error": "Select at least one row"})
		return
	}
	for i := range input.Rows {
		row := &input.Rows[i]
		index := slices.IndexFunc(source, func(s domain.ImportRow) bool { return s.SourceRow == row.SourceRow })
		if index < 0 {
			JSON(w, 400, map[string]string{"error": "Unknown source row"})
			return
		}
		row.Entry.ID = ""
		row.Entry.VehicleID = input.Spec.VehicleID
		row.Entry.PayerID = p
		row.Entry.Extra = source[index].Entry.Extra
		for field := range source[index].FieldErrors {
			if field == "end_date" {
				if row.Schedule == nil {
					JSON(w, 400, map[string]string{"error": "Missing recurring schedule"})
					return
				}
				if !domain.ValidDate(row.Schedule.End) {
					if !slices.Contains(row.UnknownFields, field) {
						JSON(w, 400, map[string]string{"error": "Correct the invalid end date or explicitly choose no end date"})
						return
					}
					row.Schedule.End = ""
					row.Entry.Extra["import:end_date"] = "Invalid source explicitly accepted as an indefinite schedule"
				}
				continue
			}
			var value *int64
			switch field {
			case "amount_minor":
				value = row.Entry.AmountMinor
			case "volume_ml":
				value = row.Entry.VolumeML
			case "distance_m":
				value = row.Entry.DistanceM
			case "odometer_m":
				value = row.Entry.OdometerM
			}
			if value == nil {
				if !slices.Contains(row.UnknownFields, field) {
					JSON(w, 400, map[string]string{"error": "Correct invalid " + field + " or explicitly mark it unknown before importing"})
					return
				}
				row.Entry.Extra["import:"+field] = "Invalid source explicitly accepted as unknown"
			}
		}
		row.Errors = nil
		if input.Spec.Kind == "fuel" {
			row.Entry.Kind = "fuel"
			row.Schedule = nil
		} else {
			row.Entry.Kind = "expense"
		}
		if input.Spec.Kind == "schedule" {
			if row.Schedule == nil {
				JSON(w, 400, map[string]string{"error": "Missing schedule"})
				return
			}
			row.Schedule.Template = row.Entry
			row.Schedule.First = row.Entry.Date
		} else {
			row.Schedule = nil
		}
		if e = row.Entry.Validate(); e != nil {
			JSON(w, 400, map[string]string{"error": e.Error()})
			return
		}
	}
	count, e := a.store.Import(r.Context(), input.Spec.Fingerprint(), input.Rows, input.AllowMatches)
	if e != nil {
		JSON(w, 400, map[string]string{"error": e.Error()})
		return
	}
	JSON(w, 200, map[string]int{"imported": count})
}
